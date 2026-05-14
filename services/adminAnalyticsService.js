import mongoose from 'mongoose';
import { getCityLabel, normalizeCityValue } from '../constants/palestinianCities.js';
import Product from '../models/Product.js';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { buildImageAssetUrlFromReference } from './assets/imageAssetService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const EVENT_WEIGHTS = {
  product_view: 1,
  favorite_add: 3,
  add_to_cart: 5,
  checkout_started: 7,
  purchase: 10,
  review_create: 2,
  try_on_generate: 4,
  visual_search: 3,
  search: 2,
};

const normalizeRange = (range = '7d') => {
  const value = String(range || '7d').trim().toLowerCase();
  return ['today', '7d', '30d', 'all'].includes(value) ? value : '7d';
};

const parseDate = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

export const getDateRange = ({ range = '7d', from = '', to = '' } = {}) => {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (fromDate || toDate) {
    return {
      key: 'custom',
      from: fromDate,
      to: toDate,
    };
  }

  const key = normalizeRange(range);
  const now = new Date();

  if (key === 'all') {
    return { key, from: null, to: null };
  }

  if (key === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { key, from: start, to: now };
  }

  const days = key === '30d' ? 30 : 7;
  return { key, from: new Date(now.getTime() - days * DAY_MS), to: now };
};

const createDateMatch = (dateRange = {}) => {
  if (!dateRange.from && !dateRange.to) {
    return {};
  }

  const createdAt = {};
  if (dateRange.from) createdAt.$gte = dateRange.from;
  if (dateRange.to) createdAt.$lte = dateRange.to;
  return { createdAt };
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

const roundPercent = (value) => Math.round((Number(value) || 0) * 10) / 10;

const getEventLabel = (eventType = '') =>
  String(eventType)
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const safeCity = (city = '') => normalizeCityValue(city) || '';

const getStatusForProduct = ({ views = 0, purchases = 0, demandScore = 0, totalStock = 0 } = {}) => {
  if (totalStock <= 0) return 'Out of Stock';
  if (totalStock <= 3) return 'Low Stock';
  if (views >= 5 && purchases === 0) return 'High Interest / Low Purchase';
  if (demandScore >= 20) return 'Trending';
  return 'Normal';
};

const serializeImageReferences = (references = []) =>
  Array.isArray(references)
    ? references.map((reference) => buildImageAssetUrlFromReference(reference)).filter(Boolean)
    : [];

const getPressureLevel = (demandScore, quantity) => {
  if (demandScore >= 20 && quantity <= 1) return 'critical';
  if (demandScore >= 10 && quantity <= 3) return 'high';
  if (demandScore >= 5 && quantity <= 5) return 'medium';
  return 'normal';
};

const eventCountField = (eventType) => ({
  $sum: {
    $cond: [{ $eq: ['$eventType', eventType] }, 1, 0],
  },
});

const CUSTOMER_FUNNEL_STEPS = [
  {
    key: 'productViews',
    eventType: 'product_view',
    label: 'Product Views',
    insightLabel: 'view products',
    missingEventFallback: false,
  },
  {
    key: 'favorites',
    eventType: 'favorite_add',
    label: 'Favorites',
    insightLabel: 'save favorites',
    missingEventFallback: false,
  },
  {
    key: 'addToCart',
    eventType: 'add_to_cart',
    label: 'Add to Cart',
    insightLabel: 'add-to-cart',
    missingEventFallback: false,
  },
  {
    key: 'orderCompleted',
    eventType: 'purchase',
    label: 'Order Completed',
    insightLabel: 'complete orders',
    missingEventFallback: false,
  },
];

const safeRate = (numerator, denominator) => {
  const safeDenominator = Number(denominator || 0);

  if (safeDenominator <= 0) {
    return 0;
  }

  return roundPercent((Number(numerator || 0) / safeDenominator) * 100);
};

const getDropOffTitle = (fromStep, toStep) => {
  if (fromStep.eventType === 'product_view' && toStep.eventType === 'favorite_add') {
    return 'Many users view products but do not save favorites';
  }

  if (fromStep.eventType === 'favorite_add' && toStep.eventType === 'add_to_cart') {
    return 'Favorites are high but cart intent is lower';
  }

  if (fromStep.eventType === 'add_to_cart' && toStep.eventType === 'purchase') {
    return 'Many users add to cart but do not complete orders';
  }

  return `${fromStep.label} to ${toStep.label} drop-off`;
};

const getDropOffAction = (fromStep, toStep) => {
  if (fromStep.eventType === 'product_view' && toStep.eventType === 'favorite_add') {
    return 'Improve product photos, titles, trust cues, and above-the-fold product details.';
  }

  if (fromStep.eventType === 'favorite_add' && toStep.eventType === 'add_to_cart') {
    return 'Use wishlist reminders, availability messaging, and clearer product options to turn saved interest into cart intent.';
  }

  if (fromStep.eventType === 'add_to_cart' && toStep.eventType === 'purchase') {
    return 'Review cart clarity, delivery cost visibility, login friction, payment flow, and final order call-to-action.';
  }

  return 'Review this journey step for friction and unclear customer motivation.';
};

export const getCustomerBehaviorFunnelAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);
  const countRows = await UserBehaviorEvent.aggregate([
    { $match: { ...match, eventType: { $in: CUSTOMER_FUNNEL_STEPS.map((step) => step.eventType) } } },
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
  ]);
  const counts = countRows.reduce((lookup, row) => {
    lookup[row._id] = Number(row.count || 0);
    return lookup;
  }, {});

  const steps = CUSTOMER_FUNNEL_STEPS.map((step, index) => {
    const count = Number(counts[step.eventType] || 0);
    const previousCount = index > 0 ? Number(counts[CUSTOMER_FUNNEL_STEPS[index - 1].eventType] || 0) : count;
    const percentageFromPrevious = index === 0 ? 100 : safeRate(count, previousCount);
    const dropOffCount = index === 0 ? 0 : Math.max(previousCount - count, 0);
    const dropOffRate = index === 0 ? 0 : safeRate(dropOffCount, previousCount);

    return {
      ...step,
      count,
      previousStepKey: index > 0 ? CUSTOMER_FUNNEL_STEPS[index - 1].key : null,
      previousCount,
      percentageFromPrevious,
      dropOffCount,
      dropOffRate,
      tracked: true,
      note: '',
    };
  });

  const transitions = steps.slice(1).map((step, index) => {
    const previousStep = steps[index];
    return {
      key: `${previousStep.key}-to-${step.key}`,
      fromStepKey: previousStep.key,
      toStepKey: step.key,
      fromLabel: previousStep.label,
      toLabel: step.label,
      fromCount: previousStep.count,
      toCount: step.count,
      retainedRate: step.percentageFromPrevious,
      dropOffCount: step.dropOffCount,
      dropOffRate: step.dropOffRate,
      tracked: step.tracked,
      title: getDropOffTitle(previousStep, step),
      explanation:
        previousStep.count > 0
          ? `${step.label} kept ${formatNumberForAnalytics(step.count)} of ${formatNumberForAnalytics(previousStep.count)} ${previousStep.insightLabel} signal${previousStep.count === 1 ? '' : 's'}.`
          : `No ${previousStep.label.toLowerCase()} signals were tracked in this range, so this transition cannot show meaningful drop-off yet.`,
      suggestedAction: getDropOffAction(previousStep, step),
    };
  });

  const insights = transitions
    .filter((transition) => transition.fromCount > 0)
    .sort((left, right) => right.dropOffRate - left.dropOffRate || right.dropOffCount - left.dropOffCount)
    .slice(0, 3);

  return {
    steps,
    transitions,
    insights,
    hasData: steps.some((step) => step.count > 0),
    calculationNote:
      'Percentage from previous step = current step count divided by previous step count. Drop-off rate = max(previous count - current count, 0) divided by previous step count.',
  };
};

const formatNumberForAnalytics = (value) => Number(value || 0).toLocaleString();

export const getOverviewAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);

  const [typeCounts, topCities, topProducts, topCategories, activeCities, activeUsers, activeSessions] = await Promise.all([
    UserBehaviorEvent.aggregate([
      { $match: match },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, userCity: { $nin: [null, ''] } } },
      { $group: { _id: '$userCity', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, productTitle: { $nin: [null, ''] } } },
      { $group: { _id: '$productTitle', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, productCategory: { $nin: [null, ''] } } },
      { $group: { _id: '$productCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    UserBehaviorEvent.distinct('userCity', { ...match, userCity: { $nin: [null, ''] } }),
    UserBehaviorEvent.distinct('user', { ...match, user: { $ne: null } }),
    UserBehaviorEvent.distinct('sessionId', { ...match, sessionId: { $nin: [null, ''] } }),
  ]);

  const counts = typeCounts.reduce((lookup, item) => {
    lookup[item._id] = item.count;
    return lookup;
  }, {});

  const productViews = counts.product_view || 0;
  const purchasesCount = counts.purchase || 0;

  return {
    totalEvents: Object.values(counts).reduce((sum, count) => sum + count, 0),
    productViews,
    addToCartCount: counts.add_to_cart || 0,
    favoritesCount: counts.favorite_add || 0,
    checkoutStartedCount: counts.checkout_started || 0,
    purchasesCount,
    searchesCount: counts.search || 0,
    visualSearchCount: counts.visual_search || 0,
    tryOnCount: counts.try_on_generate || 0,
    reviewsCount: counts.review_create || 0,
    estimatedConversionRate: productViews > 0 ? roundPercent((purchasesCount / productViews) * 100) : 0,
    activeCustomersCount: activeUsers.length,
    activeSessionsCount: activeSessions.length,
    activeCitiesCount: activeCities.length,
    topCity: topCities[0]?._id
      ? { city: safeCity(topCities[0]._id), cityLabel: getCityLabel(topCities[0]._id), count: topCities[0].count }
      : null,
    topProduct: topProducts[0]?._id ? { title: topProducts[0]._id, count: topProducts[0].count } : null,
    topCategory: topCategories[0]?._id ? { category: topCategories[0]._id, count: topCategories[0].count } : null,
  };
};

export const getProductDemandAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);
  const productRows = await UserBehaviorEvent.aggregate([
    { $match: { ...match, product: { $ne: null } } },
    {
      $group: {
        _id: '$product',
        productTitle: { $last: '$productTitle' },
        productCategory: { $last: '$productCategory' },
        productPrice: { $last: '$productPrice' },
        views: eventCountField('product_view'),
        addToCart: eventCountField('add_to_cart'),
        favorites: eventCountField('favorite_add'),
        purchases: eventCountField('purchase'),
        reviews: eventCountField('review_create'),
        tryOns: eventCountField('try_on_generate'),
        visualSearches: eventCountField('visual_search'),
        demandScore: { $sum: eventWeightExpression },
      },
    },
    { $sort: { demandScore: -1, views: -1 } },
    { $limit: 100 },
  ]);

  const productIds = productRows.map((row) => row._id).filter((id) => mongoose.isValidObjectId(id));
  const [products, stockRows] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('title category price stock slug images inventoryStatus lowStockThreshold').lean(),
    WarehouseStock.find({ product: { $in: productIds } }).populate('warehouse', 'name city cityLabel').lean(),
  ]);

  const productLookup = new Map(products.map((product) => [String(product._id), product]));
  const stockLookup = stockRows.reduce((lookup, stock) => {
    const key = String(stock.product);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push({
      warehouseId: stock.warehouse?._id?.toString?.() || '',
      warehouseName: stock.warehouse?.name || '',
      city: safeCity(stock.warehouse?.city || ''),
      cityLabel: stock.warehouse?.cityLabel || getCityLabel(stock.warehouse?.city || ''),
      quantity: stock.quantity || 0,
      lowStockThreshold: stock.lowStockThreshold || 3,
    });
    return lookup;
  }, new Map());

  return productRows.map((row) => {
    const product = productLookup.get(String(row._id));
    const warehouseStockSummary = stockLookup.get(String(row._id)) || [];
    const totalStock = Number(product?.stock ?? warehouseStockSummary.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0));
    const conversionRate = row.views > 0 ? roundPercent((row.purchases / row.views) * 100) : 0;

    return {
      productId: String(row._id),
      productTitle: product?.title || row.productTitle || 'Unknown product',
      productCategory: product?.category || row.productCategory || '',
      productPrice: Number(product?.price ?? row.productPrice ?? 0),
      slug: product?.slug || '',
      images: serializeImageReferences(product?.images),
      views: row.views || 0,
      addToCart: row.addToCart || 0,
      favorites: row.favorites || 0,
      purchases: row.purchases || 0,
      reviews: row.reviews || 0,
      tryOns: row.tryOns || 0,
      visualSearches: row.visualSearches || 0,
      demandScore: row.demandScore || 0,
      conversionRate,
      totalStock,
      lowStockThreshold: Number(product?.lowStockThreshold ?? 3),
      inventoryStatus: product?.inventoryStatus || '',
      warehouseStockSummary,
      status: getStatusForProduct({ views: row.views, purchases: row.purchases, demandScore: row.demandScore, totalStock }),
    };
  });
};

export const getCityDemandAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);

  const [cityRows, productRows, categoryRows] = await Promise.all([
    UserBehaviorEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$userCity', ''] },
          totalEvents: { $sum: 1 },
          views: eventCountField('product_view'),
          addToCart: eventCountField('add_to_cart'),
          favorites: eventCountField('favorite_add'),
          purchases: eventCountField('purchase'),
          searches: eventCountField('search'),
          demandScore: { $sum: eventWeightExpression },
        },
      },
      { $sort: { demandScore: -1, totalEvents: -1 } },
      { $limit: 50 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, productTitle: { $nin: [null, ''] } } },
      { $group: { _id: { city: { $ifNull: ['$userCity', ''] }, productTitle: '$productTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, productCategory: { $nin: [null, ''] } } },
      { $group: { _id: { city: { $ifNull: ['$userCity', ''] }, category: '$productCategory' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const topByCity = (rows, keyName) =>
    rows.reduce((lookup, row) => {
      const city = row._id.city || '';
      if (!lookup.has(city)) lookup.set(city, []);
      if (lookup.get(city).length < 3) {
        lookup.get(city).push({ [keyName]: row._id[keyName], count: row.count });
      }
      return lookup;
    }, new Map());

  const productLookup = topByCity(productRows, 'productTitle');
  const categoryLookup = topByCity(categoryRows, 'category');

  return cityRows.map((row) => {
    const city = safeCity(row._id);
    return {
      city,
      cityLabel: city ? getCityLabel(city) : 'Unknown city',
      totalEvents: row.totalEvents || 0,
      views: row.views || 0,
      addToCart: row.addToCart || 0,
      favorites: row.favorites || 0,
      purchases: row.purchases || 0,
      searches: row.searches || 0,
      topProducts: productLookup.get(row._id || '') || [],
      topCategories: categoryLookup.get(row._id || '') || [],
      demandScore: row.demandScore || 0,
    };
  });
};

export const getWarehouseAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);
  const [warehouses, stockRows, demandRows] = await Promise.all([
    Warehouse.find().sort({ cityLabel: 1, name: 1 }).lean(),
    WarehouseStock.find().populate('warehouse', 'name city cityLabel isActive').populate('product', 'title category stock').lean(),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, product: { $ne: null }, userCity: { $nin: [null, ''] } } },
      {
        $group: {
          _id: { city: '$userCity', product: '$product' },
          productTitle: { $last: '$productTitle' },
          category: { $last: '$productCategory' },
          demandScore: { $sum: eventWeightExpression },
          views: eventCountField('product_view'),
          purchases: eventCountField('purchase'),
        },
      },
      { $sort: { demandScore: -1 } },
      { $limit: 500 },
    ]),
  ]);

  const stockByWarehouseProduct = new Map();
  const totalStockByProduct = new Map();
  const stocksByWarehouse = new Map();

  stockRows.forEach((stock) => {
    const warehouseId = String(stock.warehouse?._id || stock.warehouse || '');
    const productId = String(stock.product?._id || stock.product || '');
    const quantity = Number(stock.quantity || 0);
    stockByWarehouseProduct.set(`${warehouseId}:${productId}`, stock);
    totalStockByProduct.set(productId, (totalStockByProduct.get(productId) || 0) + quantity);
    if (!stocksByWarehouse.has(warehouseId)) stocksByWarehouse.set(warehouseId, []);
    stocksByWarehouse.get(warehouseId).push(stock);
  });

  const demandByCity = demandRows.reduce((lookup, row) => {
    const city = safeCity(row._id.city);
    if (!lookup.has(city)) lookup.set(city, []);
    lookup.get(city).push(row);
    return lookup;
  }, new Map());

  const warehouseSummaries = warehouses.map((warehouse) => {
    const warehouseId = String(warehouse._id);
    const city = safeCity(warehouse.city);
    const warehouseStocks = stocksByWarehouse.get(warehouseId) || [];
    const cityDemandRows = demandByCity.get(city) || [];

    const stockPressureItems = cityDemandRows
      .map((demand) => {
        const productId = String(demand._id.product);
        const stock = stockByWarehouseProduct.get(`${warehouseId}:${productId}`);
        const warehouseQuantity = Number(stock?.quantity || 0);
        const cityDemandScore = Number(demand.demandScore || 0);

        return {
          productId,
          productTitle: stock?.product?.title || demand.productTitle || 'Unknown product',
          category: stock?.product?.category || demand.category || '',
          cityDemandScore,
          views: demand.views || 0,
          purchases: demand.purchases || 0,
          warehouseQuantity,
          totalStockAcrossWarehouses: Number(stock?.product?.stock ?? totalStockByProduct.get(productId) ?? 0),
          pressureLevel: getPressureLevel(cityDemandScore, warehouseQuantity),
        };
      })
      .filter((item) => item.pressureLevel !== 'normal')
      .sort((a, b) => b.cityDemandScore - a.cityDemandScore || a.warehouseQuantity - b.warehouseQuantity)
      .slice(0, 20);

    return {
      warehouseId,
      warehouseName: warehouse.name,
      city,
      cityLabel: warehouse.cityLabel || getCityLabel(city),
      totalStock: warehouseStocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0),
      lowStockProducts: warehouseStocks.filter((stock) => Number(stock.quantity || 0) > 0 && Number(stock.quantity || 0) <= Number(stock.lowStockThreshold || 3)).length,
      outOfStockProducts: warehouseStocks.filter((stock) => Number(stock.quantity || 0) <= 0).length,
      topDemandProductsInCity: cityDemandRows.slice(0, 5).map((row) => ({
        productId: String(row._id.product),
        productTitle: row.productTitle || 'Unknown product',
        category: row.category || '',
        demandScore: row.demandScore || 0,
      })),
      stockPressureItems,
    };
  });

  const totalWarehouseStock = warehouseSummaries.reduce((sum, warehouse) => sum + warehouse.totalStock, 0);
  const lowStockItems = warehouseSummaries.reduce((sum, warehouse) => sum + warehouse.lowStockProducts, 0);
  const criticalStockPressure = warehouseSummaries.reduce(
    (sum, warehouse) => sum + warehouse.stockPressureItems.filter((item) => item.pressureLevel === 'critical').length,
    0,
  );
  const topDemandCity = warehouseSummaries
    .map((warehouse) => ({
      city: warehouse.city,
      cityLabel: warehouse.cityLabel,
      demandScore: (demandByCity.get(warehouse.city) || []).reduce((sum, row) => sum + Number(row.demandScore || 0), 0),
    }))
    .sort((a, b) => b.demandScore - a.demandScore)[0] || null;

  return {
    summary: {
      totalWarehouseStock,
      lowStockItems,
      criticalStockPressure,
      topDemandCity,
    },
    warehouses: warehouseSummaries,
  };
};

export const getSearchAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);

  const [queryRows, cityRows, zeroResultRows] = await Promise.all([
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'search', searchQuery: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$searchQuery',
          count: { $sum: 1 },
          resultsCountAverage: { $avg: '$metadata.resultsCount' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'search', searchQuery: { $nin: [null, ''] }, userCity: { $nin: [null, ''] } } },
      { $group: { _id: { query: '$searchQuery', city: '$userCity' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'search', searchQuery: { $nin: [null, ''] }, 'metadata.resultsCount': 0 } },
      { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const topCityByQuery = cityRows.reduce((lookup, row) => {
    const query = row._id.query || '';
    if (!lookup.has(query)) {
      lookup.set(query, {
        city: safeCity(row._id.city),
        cityLabel: getCityLabel(row._id.city),
        count: row.count,
      });
    }
    return lookup;
  }, new Map());

  return {
    topSearchQueries: queryRows.map((row) => ({
      query: row._id,
      count: row.count,
      topCity: topCityByQuery.get(row._id) || null,
      resultsCountAverage: Number.isFinite(row.resultsCountAverage) ? roundPercent(row.resultsCountAverage) : null,
      hasZeroResultSearches: zeroResultRows.some((zeroRow) => zeroRow._id === row._id),
    })),
    searchesWithNoResults: zeroResultRows.map((row) => ({ query: row._id, count: row.count })),
  };
};

export const getAiToolAnalytics = async (dateRange) => {
  const match = createDateMatch(dateRange);
  const statusCondition = (eventType, status) => ({
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ['$eventType', eventType] },
            { $eq: [{ $toLower: { $ifNull: ['$metadata.status', ''] } }, status] },
          ],
        },
        1,
        0,
      ],
    },
  });

  const [countsRows, tryOnByProduct, tryOnByStyle, visualTags] = await Promise.all([
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: { $in: ['visual_search', 'try_on_generate'] } } },
      {
        $group: {
          _id: null,
          visualSearchCount: eventCountField('visual_search'),
          visualSearchSuccessCount: statusCondition('visual_search', 'success'),
          visualSearchFailedCount: statusCondition('visual_search', 'failed'),
          averageVisualSearchResults: {
            $avg: {
              $cond: [{ $eq: ['$eventType', 'visual_search'] }, '$metadata.resultsCount', null],
            },
          },
          tryOnCount: eventCountField('try_on_generate'),
          tryOnSuccessCount: statusCondition('try_on_generate', 'success'),
          tryOnFailedCount: statusCondition('try_on_generate', 'failed'),
        },
      },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'try_on_generate', productTitle: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$productTitle',
          count: { $sum: 1 },
          success: statusCondition('try_on_generate', 'success'),
          failure: statusCondition('try_on_generate', 'failed'),
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'try_on_generate' } },
      { $group: { _id: { $ifNull: ['$metadata.style', '$metadata.selectedStyle'] }, count: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    UserBehaviorEvent.aggregate([
      { $match: { ...match, eventType: 'visual_search', 'metadata.detectedTags': { $type: 'array' } } },
      { $unwind: '$metadata.detectedTags' },
      { $group: { _id: '$metadata.detectedTags', count: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const counts = countsRows[0] || {};
  const tryOnSuccessRate = counts.tryOnCount > 0 ? roundPercent((counts.tryOnSuccessCount / counts.tryOnCount) * 100) : 0;

  return {
    visualSearchCount: counts.visualSearchCount || 0,
    visualSearchSuccessCount: counts.visualSearchSuccessCount || 0,
    visualSearchFailedCount: counts.visualSearchFailedCount || 0,
    averageVisualSearchResults: Number.isFinite(counts.averageVisualSearchResults) ? roundPercent(counts.averageVisualSearchResults) : null,
    tryOnCount: counts.tryOnCount || 0,
    tryOnSuccessCount: counts.tryOnSuccessCount || 0,
    tryOnFailedCount: counts.tryOnFailedCount || 0,
    tryOnSuccessRate,
    tryOnByProduct: tryOnByProduct.map((row) => ({
      productTitle: row._id,
      count: row.count,
      success: row.success || 0,
      failure: row.failure || 0,
    })),
    tryOnByStyle: tryOnByStyle.map((row) => ({ style: row._id, count: row.count })),
    visualSearchTopDetectedTags: visualTags.map((row) => ({ tag: row._id, count: row.count })),
  };
};

export const formatEventLabel = getEventLabel;
