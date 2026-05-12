import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { getCityLabel, normalizeCityValue } from '../constants/palestinianCities.js';
import AiGeneratedInsight from '../models/AiGeneratedInsight.js';
import Product from '../models/Product.js';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import {
  getAiToolAnalytics,
  getDateRange as getAnalyticsDateRange,
  getOverviewAnalytics,
  getSearchAnalytics,
  getWarehouseAnalytics,
} from './adminAnalyticsService.js';
import {
  generateBusinessSummary,
  generateCampaignSuggestions,
} from './geminiAdvancedAiService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const EVENT_WEIGHTS = {
  product_view: 1,
  favorite_add: 3,
  add_to_cart: 5,
  purchase: 10,
  review_create: 2,
  try_on_generate: 4,
  visual_search: 3,
};

const normalizeRange = (range = '7d') => {
  const value = String(range || '7d').trim().toLowerCase();
  return ['today', '7d', '30d', 'all'].includes(value) ? value : '7d';
};

export const getAdvancedDateRange = (range = '7d') => {
  const dateRange = getAnalyticsDateRange({ range: normalizeRange(range) });
  const match = {};

  if (dateRange.from || dateRange.to) {
    match.createdAt = {};
    if (dateRange.from) match.createdAt.$gte = dateRange.from;
    if (dateRange.to) match.createdAt.$lte = dateRange.to;
  }

  return {
    key: dateRange.key,
    from: dateRange.from,
    to: dateRange.to,
    match,
  };
};

const eventWeightExpression = {
  $switch: {
    branches: Object.entries(EVENT_WEIGHTS).map(([eventType, weight]) => ({
      case: { $eq: ['$eventType', eventType] },
      then: weight,
    })),
    default: 0,
  },
};

const eventCountField = (eventType) => ({
  $sum: {
    $cond: [{ $eq: ['$eventType', eventType] }, 1, 0],
  },
});

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const createFingerprint = (payload) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const getCachedInsight = async ({ type, range, fingerprint }) => {
  return AiGeneratedInsight.findOne({
    type,
    range,
    fingerprint,
    expiresAt: { $gt: new Date() },
  })
    .sort({ updatedAt: -1 })
    .lean();
};

const storeInsight = async ({ type, range, fingerprint, payloadSummary, output, usedAI, fallback }) => {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

  return AiGeneratedInsight.findOneAndUpdate(
    { type, range, fingerprint },
    {
      $set: {
        payloadSummary,
        output,
        usedAI,
        fallback,
        expiresAt,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
};

const getProductLookup = async (productIds) => {
  const validIds = [...new Set(productIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ _id: { $in: validIds } })
    .select('title slug category stock description material motifTags inspiredByCity images patternStoryId accessibilityDescription tryOnEligible')
    .lean();
  return new Map(products.map((product) => [String(product._id), product]));
};

const getCityWarehouseStockLookup = async (productIds) => {
  const [warehouses, stockRows] = await Promise.all([
    Warehouse.find({ isActive: { $ne: false } }).select('name city cityLabel').lean(),
    WarehouseStock.find({ product: { $in: productIds } }).select('product warehouse quantity').lean(),
  ]);
  const warehouseCityLookup = new Map(warehouses.map((warehouse) => [String(warehouse._id), normalizeCityValue(warehouse.city)]));
  const stockByProductCity = new Map();

  stockRows.forEach((stock) => {
    const city = warehouseCityLookup.get(String(stock.warehouse));
    const productId = String(stock.product);
    if (!city || !productId) return;
    const key = `${productId}:${city}`;
    stockByProductCity.set(key, (stockByProductCity.get(key) || 0) + Number(stock.quantity || 0));
  });

  return stockByProductCity;
};

const aggregateDemandByProductCity = (match = {}) =>
  UserBehaviorEvent.aggregate([
    {
      $match: {
        ...match,
        eventType: { $in: Object.keys(EVENT_WEIGHTS) },
        product: { $ne: null },
        userCity: { $nin: [null, ''] },
      },
    },
    {
      $group: {
        _id: { product: '$product', city: '$userCity' },
        productTitle: { $last: '$productTitle' },
        category: { $last: '$productCategory' },
        demandScore: { $sum: eventWeightExpression },
        views: eventCountField('product_view'),
        addToCart: eventCountField('add_to_cart'),
        purchases: eventCountField('purchase'),
        tryOns: eventCountField('try_on_generate'),
      },
    },
  ]);

export const getDemandForecast = async ({ range = '7d' } = {}) => {
  const now = new Date();
  const currentMatch = { createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS), $lte: now } };
  const previousMatch = {
    createdAt: {
      $gte: new Date(now.getTime() - 14 * DAY_MS),
      $lt: new Date(now.getTime() - 7 * DAY_MS),
    },
  };

  if (normalizeRange(range) === 'today') {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    currentMatch.createdAt = { $gte: todayStart, $lte: now };
    previousMatch.createdAt = { $gte: new Date(todayStart.getTime() - DAY_MS), $lt: todayStart };
  }

  const [currentRows, previousRows] = await Promise.all([
    aggregateDemandByProductCity(currentMatch),
    aggregateDemandByProductCity(previousMatch),
  ]);
  const previousLookup = new Map();

  previousRows.forEach((row) => {
    previousLookup.set(`${String(row._id.product)}:${normalizeCityValue(row._id.city)}`, Number(row.demandScore || 0));
  });

  const productIds = currentRows.map((row) => row._id.product).filter(Boolean);
  const [productLookup, stockLookup] = await Promise.all([
    getProductLookup(productIds),
    getCityWarehouseStockLookup(productIds),
  ]);

  return currentRows
    .map((row) => {
      const productId = String(row._id.product);
      const city = normalizeCityValue(row._id.city);
      const currentScore = Number(row.demandScore || 0);
      const previousScore = Number(previousLookup.get(`${productId}:${city}`) || 0);
      const rawGrowthRate = previousScore > 0 ? (currentScore - previousScore) / previousScore : currentScore > 0 ? 1 : 0;
      const growthRate = clamp(rawGrowthRate, -1, 1);
      const projectedDemandScore = round(currentScore * (1 + Math.max(growthRate, 0)));
      const estimatedUnitsNeeded = Math.ceil(projectedDemandScore / 10);
      const cityWarehouseStock = Number(stockLookup.get(`${productId}:${city}`) || 0);
      const product = productLookup.get(productId);
      let shortageRisk = 'low';

      if (estimatedUnitsNeeded > cityWarehouseStock && cityWarehouseStock <= 1) shortageRisk = 'critical';
      else if (estimatedUnitsNeeded > cityWarehouseStock) shortageRisk = 'high';
      else if (estimatedUnitsNeeded >= cityWarehouseStock * 0.75) shortageRisk = 'medium';

      return {
        productId,
        productTitle: product?.title || row.productTitle || 'Unknown product',
        category: product?.category || row.category || '',
        city,
        cityLabel: getCityLabel(city),
        currentScore,
        previousScore,
        growthRate: round(growthRate * 100),
        projectedDemandScore,
        estimatedUnitsNeeded,
        cityWarehouseStock,
        shortageRisk,
      };
    })
    .filter((row) => row.currentScore > 0)
    .sort((a, b) => {
      const riskRank = { critical: 4, high: 3, medium: 2, low: 1 };
      return riskRank[b.shortageRisk] - riskRank[a.shortageRisk] || b.projectedDemandScore - a.projectedDemandScore;
    })
    .slice(0, 100);
};

const getProductBehaviorRows = async (range = '7d') => {
  const { match } = getAdvancedDateRange(range);

  return UserBehaviorEvent.aggregate([
    { $match: { ...match, product: { $ne: null } } },
    {
      $group: {
        _id: '$product',
        productTitle: { $last: '$productTitle' },
        category: { $last: '$productCategory' },
        views: eventCountField('product_view'),
        addToCart: eventCountField('add_to_cart'),
        purchases: eventCountField('purchase'),
        tryOns: eventCountField('try_on_generate'),
        demandScore: { $sum: eventWeightExpression },
      },
    },
    { $sort: { demandScore: -1, views: -1 } },
    { $limit: 200 },
  ]);
};

export const getMarketingOpportunities = async ({ range = '7d' } = {}) => {
  const { match } = getAdvancedDateRange(range);
  const [productRows, searchRows, cityCategoryRows] = await Promise.all([
    getProductBehaviorRows(range),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'search', searchQuery: { $nin: [null, ''] }, 'metadata.resultsCount': 0 } },
      { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, productCategory: { $nin: [null, ''] }, userCity: { $nin: [null, ''] } } },
      {
        $group: {
          _id: { city: '$userCity', category: '$productCategory' },
          demandScore: { $sum: eventWeightExpression },
        },
      },
      { $match: { demandScore: { $gte: 20 } } },
      { $sort: { demandScore: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const productLookup = await getProductLookup(productRows.map((row) => row._id));
  const opportunities = [];

  productRows.forEach((row) => {
    const product = productLookup.get(String(row._id));
    const productTitle = product?.title || row.productTitle || 'Unknown product';
    const category = product?.category || row.category || '';

    if (row.views >= 10 && row.purchases === 0) {
      opportunities.push({
        type: 'high_interest_low_conversion',
        title: 'High interest, low conversion',
        description: `${productTitle} has ${row.views} views but no purchases in this range.`,
        relatedProduct: { productId: String(row._id), title: productTitle, slug: product?.slug || '' },
        category,
        severity: 'high',
        suggestedAction: 'Improve product photos, strengthen the product story, and add a limited-stock message.',
      });
    }

    if (row.addToCart >= 5 && row.purchases === 0) {
      opportunities.push({
        type: 'cart_drop_off',
        title: 'Add-to-cart drop-off',
        description: `${productTitle} is being added to carts but not purchased.`,
        relatedProduct: { productId: String(row._id), title: productTitle, slug: product?.slug || '' },
        category,
        severity: 'high',
        suggestedAction: 'Review price, shipping clarity, checkout friction, and product trust signals.',
      });
    }

    if (row.tryOns >= 5 && row.purchases <= 1) {
      opportunities.push({
        type: 'try_on_low_purchase',
        title: 'Try-On interest with low purchase',
        description: `${productTitle} has strong Try-On usage but low purchase activity.`,
        relatedProduct: { productId: String(row._id), title: productTitle, slug: product?.slug || '' },
        category,
        severity: 'medium',
        suggestedAction: 'Promote Try-On examples and clarify sizing, fit, or styling details.',
      });
    }
  });

  searchRows.forEach((row) => {
    opportunities.push({
      type: 'search_demand_gap',
      title: 'Search demand gap',
      description: `Customers searched for "${row._id}" ${row.count} times with no results.`,
      severity: row.count >= 6 ? 'high' : 'medium',
      suggestedAction: 'Improve search tags, add matching products, or feature alternatives.',
    });
  });

  cityCategoryRows.forEach((row) => {
    const city = normalizeCityValue(row._id.city);
    opportunities.push({
      type: 'city_trend',
      title: `${getCityLabel(city)} category trend`,
      description: `${row._id.category} is gaining demand in ${getCityLabel(city)}.`,
      city,
      cityLabel: getCityLabel(city),
      category: row._id.category,
      severity: row.demandScore >= 40 ? 'high' : 'medium',
      suggestedAction: 'Create a city-specific collection or homepage feature.',
    });
  });

  return opportunities.slice(0, 50);
};

const getCompactBusinessContext = async (range = '7d') => {
  const dateRange = getAnalyticsDateRange({ range: normalizeRange(range) });
  const [overview, warehouse, search, aiTools, risks] = await Promise.all([
    getOverviewAnalytics(dateRange),
    getWarehouseAnalytics(dateRange),
    getSearchAnalytics(dateRange),
    getAiToolAnalytics(dateRange),
    getRiskAlerts({ range }),
  ]);
  const pressureItems = (warehouse.warehouses || []).flatMap((item) => item.stockPressureItems || []);
  const warehousePressureCount = pressureItems.length;
  const criticalPressureCount = pressureItems.filter((item) => item.pressureLevel === 'critical').length;
  const topRisk = risks[0] || null;
  const inventoryStatusText =
    criticalPressureCount > 0
      ? 'Critical warehouse pressure detected.'
      : warehousePressureCount > 0
        ? 'Warehouse pressure detected.'
        : 'No warehouse pressure detected.';

  return {
    range: normalizeRange(range),
    totalEvents: overview.totalEvents || 0,
    productViews: overview.productViews || 0,
    addToCartCount: overview.addToCartCount || 0,
    purchasesCount: overview.purchasesCount || 0,
    conversionRate: overview.estimatedConversionRate || 0,
    topCity: overview.topCity?.cityLabel || null,
    topProduct: overview.topProduct?.title || null,
    topCategory: overview.topCategory?.category || null,
    warehousePressureCount,
    criticalPressureCount,
    riskAlertsCount: risks.length,
    hasWarehousePressure: warehousePressureCount > 0,
    hasCriticalRisk: criticalPressureCount > 0 || risks.some((risk) => risk.severity === 'critical'),
    topRiskTitle: topRisk?.title || null,
    inventoryStatusText,
    criticalRisksCount: risks.filter((risk) => risk.severity === 'critical').length,
    topSearches: (search.topSearchQueries || []).slice(0, 5).map((item) => item.query),
    tryOnCount: aiTools.tryOnCount || 0,
    visualSearchCount: aiTools.visualSearchCount || 0,
  };
};

export const buildFallbackBusinessSummary = (context = {}) =>
  `During this period, Athar recorded ${context.totalEvents || 0} tracked events. The strongest activity came from ${context.topCity || 'available customer activity'}, with ${context.topProduct || 'no single leading product'} as the top product and ${context.topCategory || 'no leading category'} as the leading category. ${context.inventoryStatusText || 'No warehouse pressure detected.'} Current conversion is ${context.conversionRate || 0}%. ${context.topRiskTitle ? `Top risk alert: ${context.topRiskTitle}. ` : ''}Review demand and marketing opportunities before planning campaigns.`;

const validateBusinessSummary = (summary = '', context = {}) => {
  const text = String(summary || '').trim();
  const inventoryStatusText = String(context.inventoryStatusText || '').trim();
  const lowerText = text.toLowerCase();

  if (!text || (inventoryStatusText && !text.includes(inventoryStatusText))) {
    return null;
  }

  if (!context.hasCriticalRisk && /\bcritical\b/i.test(text)) {
    return null;
  }

  if (context.criticalPressureCount > 0 && /no\s+warehouse\s+pressure/i.test(lowerText)) {
    return null;
  }

  return text;
};

export const getBusinessSummary = async ({ range = '7d', forceRegenerate = false } = {}) => {
  const safeRange = normalizeRange(range);
  const context = await getCompactBusinessContext(safeRange);
  const fingerprint = createFingerprint(context);

  if (!forceRegenerate) {
    const cached = await getCachedInsight({ type: 'business_summary', range: safeRange, fingerprint });
    if (cached) {
      return {
        summary: cached.output?.summary || String(cached.output || ''),
        usedAI: Boolean(cached.usedAI),
        fallback: Boolean(cached.fallback),
        cached: true,
        generatedAt: cached.updatedAt || cached.createdAt,
      };
    }
  }

  const aiSummary = validateBusinessSummary(await generateBusinessSummary(context), context);
  const output = {
    summary: aiSummary || buildFallbackBusinessSummary(context),
  };
  const stored = await storeInsight({
    type: 'business_summary',
    range: safeRange,
    fingerprint,
    payloadSummary: context,
    output,
    usedAI: Boolean(aiSummary),
    fallback: !aiSummary,
  });

  return {
    summary: output.summary,
    usedAI: Boolean(aiSummary),
    fallback: !aiSummary,
    cached: false,
    generatedAt: stored.updatedAt || stored.createdAt,
  };
};

const campaignCategoryLabels = {
  Bags: 'Bag',
  Rings: 'Ring',
  Wallets: 'Wallet',
  Watches: 'Watch',
  Bracelets: 'Bracelet',
  Accessories: 'Accessory',
};

const campaignCategoryTypeRules = {
  Bags: {
    disallowed: ['ring', 'rings', 'watch', 'watches', 'wallet', 'wallets', 'bracelet', 'bracelets', 'jewelry', 'jewellery', 'necklace', 'necklaces', 'sunglasses'],
  },
  Rings: {
    disallowed: ['bag', 'bags', 'tote', 'handbag', 'watch', 'watches', 'wallet', 'wallets', 'bracelet', 'bracelets', 'sunglasses'],
  },
  Wallets: {
    disallowed: ['bag', 'bags', 'tote', 'handbag', 'ring', 'rings', 'watch', 'watches', 'bracelet', 'bracelets', 'sunglasses'],
  },
  Watches: {
    disallowed: ['bag', 'bags', 'tote', 'handbag', 'ring', 'rings', 'wallet', 'wallets', 'bracelet', 'bracelets', 'sunglasses'],
  },
  Bracelets: {
    disallowed: ['bag', 'bags', 'tote', 'handbag', 'ring', 'rings', 'watch', 'watches', 'wallet', 'wallets', 'sunglasses'],
  },
};

const normalizeCampaignText = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasWholeWord = (text, term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

const getFeaturedItemsText = (candidate = {}) =>
  `${candidate.productTitle || 'Athar product'} — ${candidate.productCategory || candidate.category || 'Product'}`;

const fallbackCampaignFromCandidate = (candidate = {}, index = 0) => {
  const cityLabel = candidate.cityLabel || candidate.city || 'Athar';
  const productCategory = candidate.productCategory || candidate.category || 'Accessories';
  const categoryLabel = campaignCategoryLabels[productCategory] || productCategory.replace(/s$/i, '') || 'Product';
  const productTitle = candidate.productTitle || 'Athar favorites';

  return {
    title: `${cityLabel} ${categoryLabel} Favorites`,
    target: `Customers in ${cityLabel}`,
    featuredItems: getFeaturedItemsText({ productTitle, productCategory }),
    message: `Explore the ${categoryLabel.toLowerCase()} styles customers in ${cityLabel} are viewing and saving most.`,
    cta: `Shop ${productCategory}`,
    reason: candidate.reasonData?.demandScore
      ? `Based on a demand score of ${candidate.reasonData.demandScore} for ${productTitle} in ${cityLabel}.`
      : `Based on recent tracked activity for ${productTitle}.`,
  };
};

const campaignHasCategoryMismatch = (campaign = {}, candidate = {}) => {
  const productCategory = candidate.productCategory || candidate.category || '';
  const rules = campaignCategoryTypeRules[productCategory];

  if (!rules) {
    return false;
  }

  const productTitle = normalizeCampaignText(candidate.productTitle || '');
  let text = normalizeCampaignText(
    [
      campaign.title,
      campaign.target,
      campaign.message,
      campaign.cta,
      campaign.reason,
    ].join(' '),
  );

  if (productTitle) {
    text = text.replace(productTitle, ' ');
  }

  return rules.disallowed.some((term) => hasWholeWord(text, term));
};

const validateCampaigns = (aiCampaigns, context = {}) => {
  const candidates = Array.isArray(context.campaignCandidates) ? context.campaignCandidates.slice(0, 3) : [];
  const fallbackList = fallbackCampaigns(context);
  const normalizedAiCampaigns = Array.isArray(aiCampaigns) ? aiCampaigns.slice(0, 3) : [];
  let validAiCount = 0;

  const campaigns = (candidates.length ? candidates : fallbackList).slice(0, 3).map((candidateOrFallback, index) => {
    const candidate = candidates[index] || null;
    const fallback = candidate ? fallbackCampaignFromCandidate(candidate, index) : fallbackList[index];
    const aiCampaign = normalizedAiCampaigns[index];

    if (!aiCampaign || !candidate || campaignHasCategoryMismatch(aiCampaign, candidate)) {
      return fallback;
    }

    validAiCount += 1;
    return {
      title: aiCampaign.title || fallback.title,
      target: aiCampaign.target || fallback.target,
      featuredItems: getFeaturedItemsText(candidate),
      message: aiCampaign.message || fallback.message,
      cta: aiCampaign.cta || fallback.cta,
      reason: aiCampaign.reason || fallback.reason,
    };
  });

  return {
    campaigns,
    usedAI: validAiCount > 0,
    fallback: validAiCount < campaigns.length,
  };
};

const getCampaignCandidates = async (range = '7d') => {
  const { match } = getAdvancedDateRange(range);
  const [productRows, searchRows] = await Promise.all([
    UserBehaviorEvent.aggregate([
      { $match: { ...match, product: { $ne: null }, userCity: { $nin: [null, ''] } } },
      {
        $group: {
          _id: { city: '$userCity', product: '$product' },
          productTitle: { $last: '$productTitle' },
          productCategory: { $last: '$productCategory' },
          demandScore: { $sum: eventWeightExpression },
          views: eventCountField('product_view'),
          addToCart: eventCountField('add_to_cart'),
          favorites: eventCountField('favorite_add'),
          purchases: eventCountField('purchase'),
          tryOns: eventCountField('try_on_generate'),
        },
      },
      { $sort: { demandScore: -1, views: -1 } },
      { $limit: 30 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'search', userCity: { $nin: [null, ''] }, searchQuery: { $nin: [null, ''] } } },
      { $group: { _id: { city: '$userCity', query: '$searchQuery' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);
  const productLookup = await getProductLookup(productRows.map((row) => row._id.product));
  const topSearchByCity = new Map();

  searchRows.forEach((row) => {
    const city = normalizeCityValue(row._id.city);
    if (!topSearchByCity.has(city)) topSearchByCity.set(city, row._id.query);
  });

  const candidates = [];
  const usedCities = new Set();
  const usedCandidateKeys = new Set();
  const addCandidate = (row) => {
    const city = normalizeCityValue(row._id.city);
    const productId = String(row._id.product);
    const candidateKey = `${city}:${productId}`;
    const product = productLookup.get(productId);
    const productCategory = product?.category || row.productCategory || '';
    const productTitle = product?.title || row.productTitle || '';

    if (!city || !productTitle || !productCategory || usedCandidateKeys.has(candidateKey)) return false;

    usedCandidateKeys.add(candidateKey);
    candidates.push({
      city,
      cityLabel: getCityLabel(city),
      category: productCategory,
      productTitle,
      productCategory,
      topSearchQuery: topSearchByCity.get(city) || '',
      reasonData: {
        demandScore: Number(row.demandScore || 0),
        views: Number(row.views || 0),
        addToCart: Number(row.addToCart || 0),
        favorites: Number(row.favorites || 0),
        purchases: Number(row.purchases || 0),
        tryOns: Number(row.tryOns || 0),
      },
    });
    return true;
  };

  productRows.forEach((row) => {
    const city = normalizeCityValue(row._id.city);
    if (candidates.length >= 3 || usedCities.has(city)) return;
    if (addCandidate(row)) usedCities.add(city);
  });

  productRows.forEach((row) => {
    if (candidates.length >= 3) return;
    addCandidate(row);
  });

  return candidates.slice(0, 3);
};

const getCampaignContext = async (range = '7d') => {
  const dateRange = getAnalyticsDateRange({ range: normalizeRange(range) });
  const [overview, search, opportunities, cityIdeas, campaignCandidates] = await Promise.all([
    getOverviewAnalytics(dateRange),
    getSearchAnalytics(dateRange),
    getMarketingOpportunities({ range }),
    getCityPersonalizationIdeas({ range }),
    getCampaignCandidates(range),
  ]);

  return {
    range: normalizeRange(range),
    topCity: overview.topCity?.cityLabel || null,
    topCategory: overview.topCategory?.category || null,
    topProduct: overview.topProduct?.title || null,
    topSearchQueries: (search.topSearchQueries || []).slice(0, 5).map((item) => item.query),
    marketingOpportunities: opportunities.slice(0, 5).map((item) => ({
      type: item.type,
      title: item.title,
      severity: item.severity,
      product: item.relatedProduct?.title,
      city: item.cityLabel,
      category: item.category,
    })),
    cityTrends: cityIdeas.slice(0, 5).map((item) => ({
      city: item.cityLabel,
      topCategory: item.topCategory,
      topProduct: item.topProduct,
    })),
    campaignCandidates,
  };
};

const fallbackCampaigns = (context = {}) => {
  const candidates = Array.isArray(context.campaignCandidates) ? context.campaignCandidates.slice(0, 3) : [];

  if (candidates.length > 0) {
    return candidates.map(fallbackCampaignFromCandidate);
  }

  const city = context.topCity || 'Athar';
  const category = context.topCategory || 'Accessories';
  const product = context.topProduct || 'Athar favorites';

  return [
    {
      title: `${city} Favorites`,
      target: `Customers in ${city}`,
      featuredItems: `${product} — ${category}`,
      message: `Explore the ${String(category).toLowerCase()} styles customers in ${city} are viewing and saving most.`,
      cta: `Shop ${category}`,
      reason: `Based on recent activity from ${city}.`,
    },
    {
      title: `${category} Spotlight`,
      target: `Customers interested in ${category}`,
      featuredItems: `${product} — ${category}`,
      message: `Bring heritage-inspired detail into everyday styling with standout ${category.toLowerCase()}.`,
      cta: `Explore ${category}`,
      reason: `Based on category demand signals in this period.`,
    },
    {
      title: 'Heritage Picks of the Week',
      target: 'All customers',
      featuredItems: 'Athar accessories',
      message: 'Discover thoughtful pieces inspired by Palestinian cities, motifs, and everyday elegance.',
      cta: 'Discover Athar Pieces',
      reason: 'A broad fallback campaign for current store activity.',
    },
  ];
};

export const getCampaignSuggestions = async ({ range = '7d', forceRegenerate = false } = {}) => {
  const safeRange = normalizeRange(range);
  const context = await getCampaignContext(safeRange);
  const fingerprint = createFingerprint(context);

  if (!forceRegenerate) {
    const cached = await getCachedInsight({ type: 'campaign_suggestions', range: safeRange, fingerprint });
    if (cached) {
      return {
        campaigns: Array.isArray(cached.output?.campaigns) ? cached.output.campaigns : [],
        usedAI: Boolean(cached.usedAI),
        fallback: Boolean(cached.fallback),
        cached: true,
        generatedAt: cached.updatedAt || cached.createdAt,
      };
    }
  }

  const aiCampaigns = await generateCampaignSuggestions(context);
  const validation = validateCampaigns(aiCampaigns, context);
  const campaigns = validation.campaigns;
  const stored = await storeInsight({
    type: 'campaign_suggestions',
    range: safeRange,
    fingerprint,
    payloadSummary: context,
    output: { campaigns },
    usedAI: validation.usedAI,
    fallback: validation.fallback,
  });

  return {
    campaigns,
    usedAI: validation.usedAI,
    fallback: validation.fallback,
    cached: false,
    generatedAt: stored.updatedAt || stored.createdAt,
  };
};

export const getProductContentAudit = async () => {
  const products = await Product.find()
    .select('title slug category description material motifTags inspiredByCity images patternStoryId accessibilityDescription tryOnEligible')
    .sort({ title: 1 })
    .lean();

  return products.map((product) => {
    let contentScore = 0;
    const missingFields = [];
    const improvementSuggestions = [];

    if (String(product.description || '').trim().length > 80) contentScore += 20;
    else {
      missingFields.push('Long description');
      improvementSuggestions.push('Add a richer product story with heritage and styling context.');
    }

    if (String(product.material || '').trim()) contentScore += 10;
    else missingFields.push('Material');

    if (Array.isArray(product.motifTags) && product.motifTags.length > 0) contentScore += 15;
    else missingFields.push('Motif tags');

    if (String(product.inspiredByCity || '').trim()) contentScore += 15;
    else missingFields.push('Inspired city');

    if (Array.isArray(product.images) && product.images.length >= 2) contentScore += 15;
    else {
      missingFields.push('Image variety');
      improvementSuggestions.push('Add at least two product images.');
    }

    if (product.patternStoryId) contentScore += 10;
    else missingFields.push('Pattern story');

    if (String(product.accessibilityDescription || '').trim()) contentScore += 10;
    else missingFields.push('Accessibility description');

    if (product.tryOnEligible) contentScore += 5;

    if (!String(product.material || '').trim()) improvementSuggestions.push('Add clear material details.');
    if (!String(product.inspiredByCity || '').trim()) improvementSuggestions.push('Connect the product to a city or motif when appropriate.');

    return {
      productId: String(product._id),
      productTitle: product.title,
      slug: product.slug,
      category: product.category,
      contentScore,
      missingFields,
      improvementSuggestions,
      priority: contentScore < 50 ? 'high' : contentScore < 75 ? 'medium' : 'low',
    };
  });
};

export const getCityPersonalizationIdeas = async ({ range = '7d' } = {}) => {
  const { match } = getAdvancedDateRange(range);
  const [categoryRows, productRows, searchRows] = await Promise.all([
    UserBehaviorEvent.aggregate([
      { $match: { ...match, userCity: { $nin: [null, ''] }, productCategory: { $nin: [null, ''] } } },
      { $group: { _id: { city: '$userCity', category: '$productCategory' }, score: { $sum: eventWeightExpression } } },
      { $sort: { score: -1 } },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, userCity: { $nin: [null, ''] }, productTitle: { $nin: [null, ''] } } },
      { $group: { _id: { city: '$userCity', productTitle: '$productTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, userCity: { $nin: [null, ''] }, eventType: 'search', searchQuery: { $nin: [null, ''] } } },
      { $group: { _id: { city: '$userCity', query: '$searchQuery' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const cities = new Map();
  const ensureCity = (value) => {
    const city = normalizeCityValue(value);
    if (!cities.has(city)) {
      cities.set(city, { city, cityLabel: getCityLabel(city) });
    }
    return cities.get(city);
  };

  categoryRows.forEach((row) => {
    const item = ensureCity(row._id.city);
    if (!item.topCategory) item.topCategory = row._id.category;
  });
  productRows.forEach((row) => {
    const item = ensureCity(row._id.city);
    if (!item.topProduct) item.topProduct = row._id.productTitle;
  });
  searchRows.forEach((row) => {
    const item = ensureCity(row._id.city);
    if (!item.topSearchQuery) item.topSearchQuery = row._id.query;
  });

  return [...cities.values()]
    .filter((item) => item.city)
    .map((item) => ({
      ...item,
      topCategory: item.topCategory || '',
      topProduct: item.topProduct || '',
      topSearchQuery: item.topSearchQuery || '',
      suggestedCollectionTitle: `Popular in ${item.cityLabel}`,
      suggestedCopy: `Explore pieces customers in ${item.cityLabel} are viewing and saving most.`,
      suggestedCTA: `Shop ${item.cityLabel} Picks`,
    }))
    .slice(0, 30);
};

const addAlert = (alerts, alert) => {
  alerts.push(alert);
};

export const getRiskAlerts = async ({ range = '7d' } = {}) => {
  const { match } = getAdvancedDateRange(range);
  const alerts = [];
  const [demandRows, productRows, searchRows, toolRows] = await Promise.all([
    aggregateDemandByProductCity(match),
    getProductBehaviorRows(range),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'search', searchQuery: { $nin: [null, ''] }, 'metadata.resultsCount': 0 } },
      { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    UserBehaviorEvent.aggregate([
      {
        $match: {
          ...match,
          eventType: { $in: ['visual_search', 'try_on_generate'] },
          'metadata.status': { $regex: /^failed?$/i },
        },
      },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
  ]);

  const productIds = [...demandRows.map((row) => row._id.product), ...productRows.map((row) => row._id)];
  const [productLookup, stockLookup] = await Promise.all([
    getProductLookup(productIds),
    getCityWarehouseStockLookup(productIds),
  ]);

  demandRows.forEach((row) => {
    const productId = String(row._id.product);
    const product = productLookup.get(productId);
    const city = normalizeCityValue(row._id.city);
    const cityLabel = getCityLabel(city);
    const cityWarehouseStock = Number(stockLookup.get(`${productId}:${city}`) || 0);
    const cityDemandScore = Number(row.demandScore || 0);
    const productTitle = product?.title || row.productTitle || 'Unknown product';

    if (cityDemandScore >= 15 && cityWarehouseStock <= 3) {
      addAlert(alerts, {
        alertType: 'low_stock_high_demand',
        severity: cityWarehouseStock <= 1 ? 'critical' : 'high',
        title: 'Low stock with high city demand',
        description: `${productTitle} has strong demand in ${cityLabel}, but local stock is ${cityWarehouseStock}.`,
        relatedProduct: { productId, title: productTitle, slug: product?.slug || '' },
        city,
        cityLabel,
        recommendedAction: 'Review inventory recommendations and consider a manual stock transfer.',
      });
    }

    if (cityDemandScore >= 10 && cityWarehouseStock <= 0) {
      addAlert(alerts, {
        alertType: 'city_demand_no_local_stock',
        severity: 'high',
        title: 'City demand with no local stock',
        description: `${cityLabel} demand exists for ${productTitle}, but the local warehouse has no stock.`,
        relatedProduct: { productId, title: productTitle, slug: product?.slug || '' },
        city,
        cityLabel,
        recommendedAction: 'Transfer stock into the city warehouse or adjust fulfillment messaging.',
      });
    }
  });

  productRows.forEach((row) => {
    const productId = String(row._id);
    const product = productLookup.get(productId);
    const productTitle = product?.title || row.productTitle || 'Unknown product';

    if (row.views >= 10 && row.purchases === 0) {
      addAlert(alerts, {
        alertType: 'high_views_zero_purchases',
        severity: 'high',
        title: 'High views with zero purchases',
        description: `${productTitle} has ${row.views} views and no purchases.`,
        relatedProduct: { productId, title: productTitle, slug: product?.slug || '' },
        recommendedAction: 'Audit product content, pricing, and product images.',
      });
    }

    if (row.addToCart >= 5 && row.purchases === 0) {
      addAlert(alerts, {
        alertType: 'high_cart_zero_purchases',
        severity: 'high',
        title: 'Cart adds with zero purchases',
        description: `${productTitle} has ${row.addToCart} cart adds and no purchases.`,
        relatedProduct: { productId, title: productTitle, slug: product?.slug || '' },
        recommendedAction: 'Check checkout friction, shipping clarity, and trust signals.',
      });
    }

    if (Number(product?.stock || 0) <= 0 && Number(row.demandScore || 0) >= 5) {
      addAlert(alerts, {
        alertType: 'out_of_stock_recent_demand',
        severity: 'critical',
        title: 'Out of stock with recent demand',
        description: `${productTitle} is out of stock while demand is still active.`,
        relatedProduct: { productId, title: productTitle, slug: product?.slug || '' },
        recommendedAction: 'Restock or hide purchase actions until inventory is available.',
      });
    }
  });

  searchRows.forEach((row) => {
    addAlert(alerts, {
      alertType: 'search_no_results',
      severity: row.count >= 6 ? 'high' : 'medium',
      title: 'Search terms with no results',
      description: `Customers searched for "${row._id}" ${row.count} times with no results.`,
      recommendedAction: 'Improve search tags or add matching products.',
    });
  });

  toolRows.forEach((row) => {
    if (row.count < 3) return;
    const isTryOn = row._id === 'try_on_generate';
    addAlert(alerts, {
      alertType: isTryOn ? 'try_on_failures_increasing' : 'visual_search_failures_increasing',
      severity: row.count >= 6 ? 'high' : 'medium',
      title: isTryOn ? 'Try-On failures increasing' : 'Visual Search failures increasing',
      description: `${row.count} ${isTryOn ? 'Try-On' : 'Visual Search'} failures were tracked in this range.`,
      recommendedAction: 'Check AI service health, quotas, and image upload constraints.',
    });
  });

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  return alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, 80);
};
