import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveApiAssetUrl } from '../../utils/api';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const severityStyles = {
  Opportunity: 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]',
  Warning: 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]',
  Critical: 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]',
  Informational: 'border-line bg-white text-ink-soft',
};

const severityRank = {
  Critical: 4,
  Warning: 3,
  Opportunity: 2,
  Informational: 1,
};

const getProductKey = (product = {}) => product.productId || product._id || product.slug || product.productTitle;

const getProductImage = (product = {}) => resolveApiAssetUrl(product.images?.[0] || product.image || '');

const getProductTitle = (product = {}) => product.productTitle || product.title || 'Unknown product';

const getLowStockThreshold = (product = {}) => Math.max(Number(product.lowStockThreshold || 3), 1);

const getDashboardProductKey = (product = {}) => product.productId || product.id || product._id || product.productName;

const getDashboardProductTitle = (product = {}) => product.productName || product.productTitle || product.title || 'Unknown product';

const isLowStock = (product = {}) => {
  const stock = Number(product.totalStock ?? product.stock ?? 0);
  const status = String(product.inventoryStatus || product.status || '').toLowerCase();

  return stock <= getLowStockThreshold(product) || ['critical', 'low', 'out of stock'].some((value) => status.includes(value));
};

const addRecommendation = (items, recommendation) => {
  if (!recommendation?.id || items.some((item) => item.id === recommendation.id)) {
    return;
  }

  items.push(recommendation);
};

const summarizeCategoryPerformance = (products = []) => {
  const categories = products.reduce((lookup, product) => {
    const category = product.productCategory || product.category || 'Uncategorized';
    const current = lookup.get(category) || {
      category,
      views: 0,
      addToCart: 0,
      purchases: 0,
      tryOns: 0,
      demandScore: 0,
      products: 0,
    };

    current.views += Number(product.views || 0);
    current.addToCart += Number(product.addToCart || 0);
    current.purchases += Number(product.purchases || 0);
    current.tryOns += Number(product.tryOns || 0);
    current.demandScore += Number(product.demandScore || 0);
    current.products += 1;
    lookup.set(category, current);
    return lookup;
  }, new Map());

  return Array.from(categories.values()).sort(
    (left, right) =>
      Number(right.purchases || 0) - Number(left.purchases || 0) ||
      Number(right.demandScore || 0) - Number(left.demandScore || 0) ||
      Number(right.views || 0) - Number(left.views || 0),
  );
};

const buildConfirmedSalesLookup = (dashboardSnapshot = null) => {
  const dashboardProducts = Array.isArray(dashboardSnapshot?.topProducts) ? dashboardSnapshot.topProducts : [];

  return dashboardProducts.reduce((lookup, product) => {
    const keys = [getDashboardProductKey(product), getDashboardProductTitle(product)]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);

    keys.forEach((key) => {
      lookup.set(key, product);
    });

    return lookup;
  }, new Map());
};

const getConfirmedSalesProduct = (lookup, product = {}) => {
  const keys = [getProductKey(product), getProductTitle(product)]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  return keys.map((key) => lookup.get(key)).find(Boolean) || null;
};

const normalizeDashboardProductRecommendationBase = (product = {}) => ({
  product: {
    productId: product.productId,
    productTitle: getDashboardProductTitle(product),
    productCategory: product.category || '',
    totalStock: Number(product.currentStock || 0),
    inventoryStatus: product.inventoryStatus || '',
  },
  relatedType: 'Product',
  relatedLabel: product.category ? `${getDashboardProductTitle(product)} / ${product.category}` : getDashboardProductTitle(product),
});

export const buildAtharAiRecommendations = ({ analytics = {}, dashboardSnapshot = null } = {}) => {
  const products = Array.isArray(analytics.products) ? analytics.products : [];
  const overview = analytics.overview || {};
  const aiTools = analytics.aiTools || {};
  const recommendations = [];

  if (products.length === 0 && !overview.totalEvents && !dashboardSnapshot) {
    return [];
  }

  const maxViews = Math.max(...products.map((product) => Number(product.views || 0)), 0);
  const maxCartAdds = Math.max(...products.map((product) => Number(product.addToCart || 0)), 0);
  const maxSales = Math.max(...products.map((product) => Number(product.purchases || 0)), 0);
  const maxTryOns = Math.max(...products.map((product) => Number(product.tryOns || 0)), 0);
  const meaningfulViews = Math.max(8, Math.ceil(maxViews * 0.55));
  const meaningfulCartAdds = Math.max(4, Math.ceil(maxCartAdds * 0.5));
  const meaningfulSales = Math.max(2, Math.ceil(maxSales * 0.5));
  const meaningfulTryOns = Math.max(3, Math.ceil(maxTryOns * 0.55));
  const confirmedSalesLookup = buildConfirmedSalesLookup(dashboardSnapshot);

  products.forEach((product) => {
    const confirmedProduct = getConfirmedSalesProduct(confirmedSalesLookup, product);
    const productKey = getProductKey(product);
    const productTitle = getProductTitle(product);
    const views = Number(product.views || 0);
    const cartAdds = Number(product.addToCart || 0);
    const purchases = Math.max(Number(product.purchases || 0), Number(confirmedProduct?.unitsSold || 0));
    const favorites = Number(product.favorites || 0);
    const tryOns = Number(product.tryOns || 0);
    const stock = Number(product.totalStock ?? product.stock ?? confirmedProduct?.currentStock ?? 0);
    const conversionRate = views > 0 ? (purchases / views) * 100 : 0;
    const cartCompletionRate = cartAdds > 0 ? (purchases / cartAdds) * 100 : 0;
    const relatedLabel = product.productCategory
      ? `${productTitle} / ${product.productCategory}`
      : productTitle;
    const base = {
      product,
      relatedType: 'Product',
      relatedLabel,
      imageUrl: getProductImage(product),
    };

    if (views >= meaningfulViews && conversionRate < 6 && purchases <= Math.max(1, Math.floor(views * 0.04))) {
      addRecommendation(recommendations, {
        ...base,
        id: `views-low-sales-${productKey}`,
        title: 'High views but low sales',
        severity: 'Warning',
        explanation: `${productTitle} has ${formatNumber(views)} views but only ${formatNumber(purchases)} sale${purchases === 1 ? '' : 's'} in this range (${formatPercent(conversionRate)} view-to-sale conversion).`,
        suggestedAction: 'Review product photos, price, description, sizing notes, and first-screen merchandising.',
      });
    }

    if (cartAdds >= meaningfulCartAdds && cartCompletionRate < 30) {
      addRecommendation(recommendations, {
        ...base,
        id: `cart-low-checkout-${productKey}`,
        title: 'Cart interest is not reaching checkout',
        severity: cartAdds >= 8 && purchases === 0 ? 'Critical' : 'Warning',
        explanation: `${productTitle} received ${formatNumber(cartAdds)} add-to-cart event${cartAdds === 1 ? '' : 's'}, but only ${formatNumber(purchases)} purchase${purchases === 1 ? '' : 's'} followed (${formatPercent(cartCompletionRate)} cart completion).`,
        suggestedAction: 'Check checkout friction, delivery cost, payment options, and whether the product remains available at checkout.',
      });
    }

    if (purchases >= meaningfulSales && isLowStock(product)) {
      addRecommendation(recommendations, {
        ...base,
        id: `high-sales-low-stock-${productKey}`,
        title: 'Best seller is running low',
        severity: stock <= 0 ? 'Critical' : 'Warning',
        explanation: `${productTitle} sold ${formatNumber(purchases)} unit${purchases === 1 ? '' : 's'} in tracked behavior or confirmed orders and has ${formatNumber(stock)} in stock.`,
        suggestedAction: 'Restock soon or move stock from a slower warehouse before demand spills over.',
      });
    }

    if (tryOns >= meaningfulTryOns) {
      addRecommendation(recommendations, {
        ...base,
        id: `try-on-opportunity-${productKey}`,
        title: 'Strong Try-On interest',
        severity: 'Opportunity',
        explanation: `${productTitle} generated ${formatNumber(tryOns)} Try-On use${tryOns === 1 ? '' : 's'}, showing high consideration even before purchase.`,
        suggestedAction: 'Feature it higher on product lists, campaigns, and visual search surfaces while interest is warm.',
      });
    }

    if (stock > getLowStockThreshold(product) && views + cartAdds + favorites + tryOns + purchases <= 1) {
      addRecommendation(recommendations, {
        ...base,
        id: `low-engagement-${productKey}`,
        title: 'Low engagement product',
        severity: 'Informational',
        explanation: `${productTitle} has available inventory but almost no tracked engagement in the selected range.`,
        suggestedAction: 'Refresh marketing placement, improve keywords, or pair it with a stronger category collection.',
      });
    }
  });

  (dashboardSnapshot?.topProducts || []).forEach((product) => {
    const productKey = getDashboardProductKey(product);
    const productTitle = getDashboardProductTitle(product);
    const unitsSold = Number(product.unitsSold || 0);
    const currentStock = Number(product.currentStock || 0);
    const inventoryStatus = String(product.inventoryStatus || '').toLowerCase();
    const lowStock = currentStock <= 3 || ['critical', 'low', 'out of stock'].some((value) => inventoryStatus.includes(value));

    if (unitsSold >= 2 && lowStock) {
      addRecommendation(recommendations, {
        ...normalizeDashboardProductRecommendationBase(product),
        id: `confirmed-sales-low-stock-${productKey}`,
        title: 'Confirmed sales are pressuring stock',
        severity: currentStock <= 0 || inventoryStatus.includes('critical') ? 'Critical' : 'Warning',
        explanation: `${productTitle} has ${formatNumber(unitsSold)} confirmed unit${unitsSold === 1 ? '' : 's'} sold and ${formatNumber(currentStock)} currently in stock.`,
        suggestedAction: 'Prioritize restock planning or rebalance warehouse stock before this item loses sales momentum.',
      });
    }
  });

  const categoryPerformance = summarizeCategoryPerformance(products);
  const topCategory = categoryPerformance[0];
  const secondCategory = categoryPerformance[1];
  const orderCategory = dashboardSnapshot?.charts?.categoryBreakdown?.[0];

  if (topCategory && (topCategory.purchases > 0 || topCategory.demandScore >= 10 || topCategory.views >= 10)) {
    const leadText = secondCategory
      ? ` It is ahead of ${secondCategory.category} by ${formatNumber(Math.max(topCategory.demandScore - secondCategory.demandScore, 0))} demand points.`
      : '';

    addRecommendation(recommendations, {
      id: `category-opportunity-${topCategory.category}`,
      title: 'Category momentum this month',
      severity: 'Opportunity',
      explanation: `${topCategory.category} is the strongest category in this range with ${formatNumber(topCategory.purchases)} sale${topCategory.purchases === 1 ? '' : 's'}, ${formatNumber(topCategory.views)} views, and ${formatNumber(topCategory.demandScore)} demand points.${leadText}`,
      suggestedAction: 'Give this category more homepage, search, and campaign visibility while demand is concentrated.',
      relatedType: 'Category',
      relatedLabel: topCategory.category,
    });
  }

  if (orderCategory?.category && Number(orderCategory.revenue || 0) > 0) {
    addRecommendation(recommendations, {
      id: `confirmed-category-opportunity-${orderCategory.category}`,
      title: 'Category is leading confirmed revenue',
      severity: 'Opportunity',
      explanation: `${orderCategory.category} is currently the strongest confirmed revenue category with ${formatNumber(orderCategory.revenue)} JD in sales.`,
      suggestedAction: 'Keep this category prominent in campaigns, product lists, and homepage merchandising this month.',
      relatedType: 'Category',
      relatedLabel: orderCategory.category,
    });
  }

  if (aiTools.tryOnByProduct?.[0]?.count > 0) {
    const row = aiTools.tryOnByProduct[0];
    addRecommendation(recommendations, {
      id: `ai-tools-top-try-on-${row.productId || row.productTitle}`,
      title: 'AI Try-On leader',
      severity: 'Opportunity',
      explanation: `${row.productTitle || 'A product'} is leading Try-On usage with ${formatNumber(row.count)} generation${Number(row.count) === 1 ? '' : 's'}.`,
      suggestedAction: 'Use it as a hero item in Try-On promotions and make sure stock and product content are ready.',
      relatedType: 'Product',
      relatedLabel: row.productTitle || 'Try-On product',
    });
  }

  if (Number(analytics.warehouses?.summary?.criticalStockPressure || 0) > 0) {
    addRecommendation(recommendations, {
      id: 'warehouse-critical-pressure',
      title: 'Warehouse pressure needs review',
      severity: 'Critical',
      explanation: `${formatNumber(analytics.warehouses.summary.criticalStockPressure)} high-demand stock pressure signal${Number(analytics.warehouses.summary.criticalStockPressure) === 1 ? '' : 's'} detected across warehouses.`,
      suggestedAction: 'Review transfer recommendations and approve only the movements that match real fulfillment capacity.',
      relatedType: 'Inventory',
      relatedLabel: analytics.warehouses.summary.topDemandCity?.cityLabel || 'Warehouses',
    });
  }

  return recommendations
    .sort((left, right) => (severityRank[right.severity] || 0) - (severityRank[left.severity] || 0))
    .slice(0, 10);
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${severityStyles[severity] || severityStyles.Informational}`}>
    {severity}
  </span>
);

const EmptyState = () => (
  <div className="rounded-[24px] border border-line/80 bg-[#fffaf8] px-5 py-7 text-sm leading-6 text-ink-soft">
    No recommendations found for this range yet. Once Athar has more product views, carts, purchases, Try-On events, or warehouse pressure, this panel will surface practical next steps.
  </div>
);

const LoadingState = () => (
  <div className="rounded-[24px] border border-line/80 bg-[#fffaf8] px-5 py-7 text-sm leading-6 text-ink-soft">
    Refreshing recommendation signals from behavior tracking, orders, product data, and inventory.
  </div>
);

const AtharAiRecommendationsSection = ({ analytics, dashboardSnapshot, isLoading, onRefresh }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const recommendations = useMemo(
    () => buildAtharAiRecommendations({ analytics, dashboardSnapshot }),
    [analytics, dashboardSnapshot, refreshKey],
  );

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      if (onRefresh) {
        await onRefresh();
      }
      setRefreshKey((value) => value + 1);
      setLastRefreshedAt(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section id="athar-ai" className="rounded-[30px] border border-line/80 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Rule-based insights</p>
          <h2 className="mt-2 font-display text-4xl text-ink">Athar AI Recommendations</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-soft">
            Practical admin recommendations from behavior tracking, orders, product performance, and inventory data. No external AI API is called from the frontend.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="min-h-11 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white transition hover:bg-rose disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading || isRefreshing ? 'Refreshing...' : 'Refresh Recommendations'}
          </button>
          <p className="text-xs text-ink-soft">Last refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {Object.keys(severityStyles).map((severity) => (
          <div key={severity} className="rounded-[18px] border border-line/70 bg-[#fffaf8] px-4 py-3">
            <SeverityBadge severity={severity} />
            <p className="mt-2 text-xs leading-5 text-ink-soft">
              {severity === 'Opportunity'
                ? 'Growth action'
                : severity === 'Warning'
                  ? 'Needs attention'
                  : severity === 'Critical'
                    ? 'Act soon'
                    : 'Monitor signal'}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : recommendations.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {recommendations.map((recommendation) => (
            <article key={recommendation.id} className="overflow-hidden rounded-[24px] border border-line bg-white shadow-card">
              <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
                <div className="min-h-[150px] bg-[#fffaf8]">
                  {recommendation.imageUrl ? (
                    <img
                      src={recommendation.imageUrl}
                      alt={recommendation.relatedLabel}
                      loading="lazy"
                      decoding="async"
                      className="h-full min-h-[150px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[150px] items-center justify-center px-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {recommendation.relatedType}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-display text-3xl leading-tight text-ink">{recommendation.title}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {recommendation.relatedType}: {recommendation.relatedLabel}
                      </p>
                    </div>
                    <SeverityBadge severity={recommendation.severity} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-ink-soft">{recommendation.explanation}</p>
                  <div className="mt-4 rounded-[18px] bg-[#fffaf8] px-4 py-3 text-sm font-semibold leading-6 text-ink">
                    {recommendation.suggestedAction}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {recommendation.product?.slug || recommendation.product?.productId ? (
                      <Link
                        className="button-secondary min-h-10 px-4 py-2 text-sm"
                        to={`/products/${recommendation.product.slug || recommendation.product.productId}`}
                      >
                        View Product
                      </Link>
                    ) : null}
                    {recommendation.relatedType === 'Product' || recommendation.relatedType === 'Inventory' ? (
                      <Link className="button-primary min-h-10 px-4 py-2 text-sm" to="/admin/inventory">
                        Review Inventory
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
};

export default AtharAiRecommendationsSection;
