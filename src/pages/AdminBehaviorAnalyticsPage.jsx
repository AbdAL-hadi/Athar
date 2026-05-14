import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/admin/AdminNavigation';
import {
  AiInsightsWorkspace,
  DemandForecastPanel,
  MarketingIntelligencePipeline,
  useAdvancedAiInsightsData,
} from '../components/admin/AdvancedAiInsightsSection';
import CustomerBehaviorFunnelSection from '../components/admin/CustomerBehaviorFunnelSection';
import SectionTitle from '../components/SectionTitle';
import { PALESTINIAN_CITIES, getCityLabel, normalizeCityValue } from '../data/palestinianCities';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';

const timeRanges = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const eventTypes = [
  '',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'favorite_add',
  'favorite_remove',
  'search',
  'visual_search',
  'try_on_generate',
  'checkout_started',
  'purchase',
  'review_create',
];

const formatEventType = (value = '') =>
  String(value)
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatNumber = (value) => Number(value || 0).toLocaleString();

const productSortOptions = [
  { value: 'sales', label: 'Top Sales' },
  { value: 'views', label: 'Top Views' },
  { value: 'cart', label: 'Top Cart Adds' },
  { value: 'tryOn', label: 'Top Try-On' },
  { value: 'lowStock', label: 'Low Stock' },
];

const dashboardSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'demand', label: 'Demand' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'ai-insights', label: 'AI Insights' },
];

const getRecommendationId = (recommendation) => recommendation?._id || recommendation?.id;

const getWarehouseName = (warehouse, fallback = '') => warehouse?.name || fallback || '-';

const getProductTitle = (product, fallback = '') => product?.title || fallback || 'Unknown product';

const getStatusClass = (status = '') => {
  const normalized = status.toLowerCase();

  if (normalized.includes('out') || normalized.includes('critical')) {
    return 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]';
  }

  if (normalized.includes('low') || normalized.includes('high')) {
    return 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]';
  }

  if (normalized.includes('trending') || normalized.includes('medium')) {
    return 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]';
  }

  return 'border-line bg-white text-ink-soft';
};

const EmptyState = ({ children }) => (
  <div className="rounded-[22px] border border-line/70 bg-[#fffaf8] px-5 py-6 text-sm leading-6 text-ink-soft">{children}</div>
);

const LoadingBlock = ({ label = 'Loading analytics...' }) => (
  <div className="animate-pulse rounded-[24px] border border-line/70 bg-white px-5 py-6 shadow-card">
    <div className="h-3 w-32 rounded-full bg-[#eaded6]" />
    <div className="mt-5 h-9 w-44 rounded-full bg-[#f2e8e2]" />
    <div className="mt-4 h-3 w-56 max-w-full rounded-full bg-[#f2e8e2]" />
    <span className="sr-only">{label}</span>
  </div>
);

const MiniIcon = ({ name }) => {
  const paths = {
    sales: 'M5 12h14M7 8h10M9 16h6',
    orders: 'M7 7h10v12H7z M9 11h6 M9 15h4',
    customers: 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c.7-3 2.5-5 5-5s4.3 2 5 5 M17 11a2.5 2.5 0 1 0 0-5 M15 15c2.1.2 3.5 1.8 4 5',
    conversion: 'M5 19 19 5 M7 8h.01 M17 16h.01',
    stock: 'M5 8 12 4l7 4v8l-7 4-7-4z M12 12v8 M5 8l7 4 7-4',
    revenue: 'M12 5v14 M8 8.5c0-1.7 1.6-3 4-3s4 1.1 4 2.8c0 4.2-8 1.6-8 5.7 0 1.7 1.6 3 4 3s4-1.2 4-3',
    activity: 'M4 13h4l2-6 4 12 2-6h4',
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.activity} />
    </svg>
  );
};

const MetricCard = ({ label, value, helper = '' }) => (
  <div className="rounded-[24px] border border-line bg-white px-5 py-5 shadow-card">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
    <p className="mt-3 font-display text-4xl text-ink">{value}</p>
    {helper ? <p className="mt-2 text-sm leading-6 text-ink-soft">{helper}</p> : null}
  </div>
);

const DashboardKpiCard = ({ title, value, trend, icon, tone = 'neutral', helper = '' }) => {
  const valueIsLong = String(value || '').length > 16;
  const trendClass =
    tone === 'good'
      ? 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]'
      : tone === 'warn'
        ? 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]'
        : tone === 'bad'
          ? 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]'
          : 'border-line bg-[#fffaf8] text-ink-soft';

  const trendMark = tone === 'bad' ? '-' : tone === 'good' ? '+' : tone === 'warn' ? '!' : '*';

  return (
    <article className="heritage-metric-card group min-h-[178px] overflow-hidden rounded-[22px] p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{title}</p>
          <p className={`mt-4 break-words font-display leading-tight text-ink ${valueIsLong ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}>
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-line bg-white/80 text-[#8f5f45] shadow-card">
          <MiniIcon name={icon} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${trendClass}`}>
          <span aria-hidden="true">{trendMark}</span>
          {trend}
        </span>
        {helper ? <span className="text-xs text-ink-soft">{helper}</span> : null}
      </div>
    </article>
  );
};

const SectionCard = ({ id, title, description = '', children }) => (
  <section id={id} className="scroll-mt-[180px] rounded-[24px] border border-line/80 bg-white p-5 shadow-card sm:p-6 lg:scroll-mt-[150px]">
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-3xl text-ink sm:text-4xl">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{description}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

const DashboardHeroStat = ({ label, value, helper, tone = 'neutral' }) => {
  const accentClass =
    tone === 'good'
      ? 'bg-[#54715f]'
      : tone === 'warn'
        ? 'bg-[#b88746]'
        : tone === 'bad'
          ? 'bg-[#9b3f31]'
          : 'bg-[#8f5f45]';

  return (
    <article className="rounded-[18px] border border-line/80 bg-white/80 px-4 py-4 shadow-card">
      <div className={`mb-3 h-1.5 w-10 rounded-full ${accentClass}`} />
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 truncate font-display text-3xl leading-tight text-ink">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-ink-soft">{helper}</p> : null}
    </article>
  );
};

const DashboardToolbar = ({ range, onRangeChange }) => (
  <section className="sticky top-[84px] z-30 rounded-[22px] border border-line/80 bg-white/95 p-3 shadow-card backdrop-blur lg:top-[76px]">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
        {dashboardSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="min-h-10 shrink-0 whitespace-nowrap rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-blush/60 hover:text-ink"
          >
            {section.label}
          </a>
        ))}
      </div>

      <label className="w-full min-w-0 xl:w-[220px] xl:shrink-0">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Time range</span>
        <select
          value={range}
          onChange={(event) => onRangeChange(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-[16px] border border-line bg-white px-4 py-3 text-sm font-semibold text-ink outline-none focus:border-rose"
        >
          {timeRanges.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  </section>
);

const DataTable = ({ columns, children }) => (
  <div className="overflow-x-auto rounded-[24px] border border-line/80">
    <table className="min-w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
          {columns.map((column) => (
            <th key={column} className="px-4 py-3">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-10 rounded-full border px-4 py-2 text-sm font-bold transition ${
      active ? 'border-ink bg-ink text-white shadow-card' : 'border-line bg-white text-ink-soft hover:bg-blush/60 hover:text-ink'
    }`}
  >
    {children}
  </button>
);

const DetailPanel = ({ title, description = '', children, defaultOpen = false }) => (
  <details className="rounded-[24px] border border-line bg-white p-5" open={defaultOpen}>
    <summary className="cursor-pointer list-none">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-3xl text-ink">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-ink-soft">{description}</p> : null}
        </div>
        <span className="rounded-full border border-line bg-[#fffaf8] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
          Open
        </span>
      </div>
    </summary>
    <div className="mt-5">{children}</div>
  </details>
);

const ProgressRow = ({ label, value, max, meta = '' }) => {
  const percentage = Math.min((Number(value || 0) / Math.max(Number(max || 0), 1)) * 100, 100);

  return (
    <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-ink-soft">{meta || formatNumber(value)}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#f0e3dc]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#8f5f45] via-[#b88746] to-[#54715f]" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const StatusBadge = ({ children }) => (
  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(String(children))}`}>
    {children}
  </span>
);

const AnalyticsError = ({ message }) =>
  message ? (
    <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
      {message}
    </div>
  ) : null;

const ProductImagePlaceholder = () => (
  <div className="flex h-full min-h-[220px] w-full items-center justify-center bg-[#f8f2ee]">
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#dfbd79]/50 bg-white text-[#8f5f45]">
        <MiniIcon name="stock" />
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-muted">Athar</p>
    </div>
  </div>
);

const getProductAnalyticsBadges = (product, context) => {
  const views = Number(product.views || 0);
  const sales = Number(product.purchases || 0);
  const cartAdds = Number(product.addToCart || 0);
  const tryOns = Number(product.tryOns || 0);
  const stock = Number(product.totalStock || 0);
  const threshold = Math.max(Number(product.lowStockThreshold || 3), 1);
  const lowStock = stock <= threshold || ['Low', 'Critical', 'Out of Stock'].includes(product.inventoryStatus);
  const conversionRate = views > 0 ? sales / views : 0;
  const badges = [];

  if (sales > 0 && sales >= Math.max(context.maxSales, 1)) badges.push({ label: 'Best Seller', tone: 'good' });
  if (sales >= 2 && lowStock) badges.push({ label: 'Restock Soon', tone: 'warn' });
  if (views >= Math.max(8, context.maxViews * 0.6)) badges.push({ label: 'High Views', tone: 'neutral' });
  if (tryOns >= Math.max(3, context.maxTryOns * 0.6)) badges.push({ label: 'Popular Try-On', tone: 'good' });
  if ((views >= 8 || cartAdds >= 4 || tryOns >= 4) && conversionRate < 0.08) badges.push({ label: 'Needs Attention', tone: 'bad' });
  if (lowStock && sales < 2) badges.push({ label: 'Low Stock', tone: 'warn' });

  return badges.slice(0, 3);
};

const ProductAnalyticsCard = ({ product, badges }) => {
  const imageUrl = resolveApiAssetUrl(product.images?.[0] || product.image || '');
  const stockLabel = product.inventoryStatus || product.status || (Number(product.totalStock || 0) <= Number(product.lowStockThreshold || 3) ? 'Low Stock' : 'In Stock');
  const badgeClass = {
    good: 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]',
    warn: 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]',
    bad: 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]',
    neutral: 'border-line bg-white text-ink-soft',
  };

  return (
    <article className="group overflow-hidden rounded-[28px] border border-line/80 bg-white shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.productTitle}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <ProductImagePlaceholder />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge.label} className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${badgeClass[badge.tone]}`}>
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-3xl leading-tight text-ink">{product.productTitle}</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">{product.productCategory || 'Uncategorized'}</p>
          </div>
          <p className="whitespace-nowrap text-sm font-bold text-[#8f5f45]">{formatCurrency(product.productPrice)}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge>{stockLabel}</StatusBadge>
          <span className="rounded-full border border-line bg-[#fffaf8] px-3 py-1 text-xs font-semibold text-ink-soft">
            {formatNumber(product.totalStock)} in stock
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {[
            ['Views', product.views],
            ['Cart Adds', product.addToCart],
            ['Favorites', product.favorites],
            ['Try-On', product.tryOns],
            ['Sales', product.purchases],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[18px] bg-[#fffaf8] px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl text-ink">{formatNumber(value)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="button-secondary min-h-10 px-4 py-2 text-sm" to={`/products/${product.slug || product.productId}`}>
            View Product
          </Link>
          <Link className="button-primary min-h-10 px-4 py-2 text-sm" to="/admin/inventory">
            Manage Stock
          </Link>
        </div>
      </div>
    </article>
  );
};

const getRestockSuggestion = (product) => {
  const stock = Number(product.totalStock || 0);
  const threshold = Math.max(Number(product.lowStockThreshold || 3), 1);
  const purchases = Number(product.purchases || 0);
  const cartAdds = Number(product.addToCart || 0);
  const tryOns = Number(product.tryOns || 0);
  const demandUnits = Math.max(purchases + Math.ceil(cartAdds * 0.5) + Math.ceil(tryOns * 0.25), threshold);
  const targetStock = Math.max(threshold * 2, demandUnits + threshold);
  const suggestedQuantity = Math.max(targetStock - stock, threshold);

  if (stock <= 0) {
    return `Restock at least ${formatNumber(suggestedQuantity)} units before featuring this product again.`;
  }

  if (purchases > 0 || cartAdds > 0 || tryOns > 0) {
    return `Restock ${formatNumber(suggestedQuantity)} units to cover recent purchase, cart, and Try-On demand.`;
  }

  return `Restock ${formatNumber(suggestedQuantity)} units to rebuild the safety buffer above the ${formatNumber(threshold)} unit threshold.`;
};

const LowStockProductCard = ({ product }) => {
  const imageUrl = resolveApiAssetUrl(product.images?.[0] || product.image || '');
  const threshold = Math.max(Number(product.lowStockThreshold || 3), 1);
  const stock = Number(product.totalStock || 0);
  const warehouseStock = (product.warehouseStockSummary || [])
    .filter((stockRow) => Number(stockRow.quantity || 0) > 0)
    .sort((left, right) => Number(right.quantity || 0) - Number(left.quantity || 0))
    .slice(0, 3);

  return (
    <article className="overflow-hidden rounded-[28px] border border-line/80 bg-white shadow-card">
      <div className="grid min-h-full sm:grid-cols-[180px_1fr]">
        <div className="bg-[#fffaf8]">
          {imageUrl ? (
            <img src={imageUrl} alt={product.productTitle} loading="lazy" decoding="async" className="h-full min-h-[220px] w-full object-cover" />
          ) : (
            <ProductImagePlaceholder />
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{product.productCategory || 'Uncategorized'}</p>
              <h3 className="mt-2 font-display text-3xl leading-tight text-ink">{product.productTitle}</h3>
            </div>
            <StatusBadge>{stock <= 0 ? 'Out of Stock' : 'Low Stock'}</StatusBadge>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Stock</p>
              <p className="mt-1 font-display text-2xl text-ink">{formatNumber(stock)}</p>
            </div>
            <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Threshold</p>
              <p className="mt-1 font-display text-2xl text-ink">{formatNumber(threshold)}</p>
            </div>
            <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Sales</p>
              <p className="mt-1 font-display text-2xl text-ink">{formatNumber(product.purchases)}</p>
            </div>
          </div>

          <p className="mt-4 rounded-[18px] border border-[#ead3a6] bg-[#fff8e9] px-4 py-3 text-sm font-semibold leading-6 text-[#7a5a11]">
            {getRestockSuggestion(product)}
          </p>

          <div className="mt-4 rounded-[18px] border border-line/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Warehouse availability</p>
            {warehouseStock.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-soft">
                {warehouseStock.map((stockRow) => (
                  <span key={stockRow.warehouseId} className="rounded-full bg-[#fffaf8] px-3 py-1">
                    {stockRow.cityLabel || stockRow.warehouseName}: {formatNumber(stockRow.quantity)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">No warehouse has available stock for this product.</p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="button-secondary min-h-10 px-4 py-2 text-sm" to={`/products/${product.slug || product.productId}`}>
              View Product
            </Link>
            <Link className="button-primary min-h-10 px-4 py-2 text-sm" to="/admin/inventory">
              Manage Stock
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};

const AdminBehaviorAnalyticsPage = ({ authToken, authUser, authLoading }) => {
  const navigate = useNavigate();
  const [range, setRange] = useState('7d');
  const [eventType, setEventType] = useState('');
  const [city, setCity] = useState('');
  const [productSort, setProductSort] = useState('sales');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [activeDemandTab, setActiveDemandTab] = useState('products');
  const [activeInventoryTab, setActiveInventoryTab] = useState('stock');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [analytics, setAnalytics] = useState({
    overview: null,
    products: [],
    cities: [],
    warehouses: null,
    searches: null,
    aiTools: null,
    customerFunnel: null,
  });
  const [events, setEvents] = useState([]);
  const [analyticsErrors, setAnalyticsErrors] = useState({});
  const [eventsError, setEventsError] = useState('');
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [movements, setMovements] = useState([]);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [recommendationsMessage, setRecommendationsMessage] = useState('');
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(true);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [activeRecommendationAction, setActiveRecommendationAction] = useState('');
  const [dashboardSnapshot, setDashboardSnapshot] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const advancedAi = useAdvancedAiInsightsData(authToken, range);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authToken || authUser?.role !== 'admin') {
      navigate('/auth');
    }
  }, [authLoading, authToken, authUser?.role, navigate]);

  const loadRecommendationData = useCallback(
    async ({ quiet = false } = {}) => {
      if (!authToken || authUser?.role !== 'admin') {
        return;
      }

      try {
        if (!quiet) {
          setIsRecommendationsLoading(true);
        }
        setRecommendationsError('');
        const [recommendationsResponse, movementsResponse] = await Promise.all([
          apiRequest(`/api/admin/inventory-recommendations?status=all&range=${encodeURIComponent(range)}`, {
            token: authToken,
          }),
          apiRequest('/api/admin/inventory-movements?limit=50', { token: authToken }),
        ]);

        setRecommendations(Array.isArray(recommendationsResponse?.data) ? recommendationsResponse.data : []);
        setMovements(Array.isArray(movementsResponse?.data) ? movementsResponse.data : []);
      } catch (error) {
        setRecommendationsError(error.message || 'Failed to load inventory recommendations.');
      } finally {
        if (!quiet) {
          setIsRecommendationsLoading(false);
        }
      }
    },
    [authToken, authUser?.role, range],
  );

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadDashboardSnapshot = async () => {
      try {
        setIsDashboardLoading(true);
        setDashboardError('');
        const response = await apiRequest('/api/admin/dashboard', { token: authToken });

        if (!isCancelled) {
          setDashboardSnapshot(response?.data ?? null);
        }
      } catch (error) {
        if (!isCancelled) {
          setDashboardError(error.message || 'Failed to load sales KPI data.');
        }
      } finally {
        if (!isCancelled) {
          setIsDashboardLoading(false);
        }
      }
    };

    loadDashboardSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [analyticsRefreshKey, authToken, authUser?.role]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadAnalytics = async () => {
      setIsAnalyticsLoading(true);
      setAnalyticsErrors({});

      const endpoints = {
        overview: `/api/admin/analytics/overview?range=${encodeURIComponent(range)}`,
        products: `/api/admin/analytics/products?range=${encodeURIComponent(range)}`,
        cities: `/api/admin/analytics/cities?range=${encodeURIComponent(range)}`,
        warehouses: `/api/admin/analytics/warehouses?range=${encodeURIComponent(range)}`,
        searches: `/api/admin/analytics/searches?range=${encodeURIComponent(range)}`,
        aiTools: `/api/admin/analytics/ai-tools?range=${encodeURIComponent(range)}`,
        customerFunnel: `/api/admin/analytics/customer-funnel?range=${encodeURIComponent(range)}`,
      };

      const results = await Promise.allSettled(
        Object.entries(endpoints).map(async ([key, endpoint]) => {
          try {
            const response = await apiRequest(endpoint, { token: authToken });
            return [key, response?.data ?? null, null];
          } catch (error) {
            return [key, null, error];
          }
        }),
      );

      if (isCancelled) {
        return;
      }

      const nextAnalytics = {
        overview: null,
        products: [],
        cities: [],
        warehouses: null,
        searches: null,
        aiTools: null,
        customerFunnel: null,
      };
      const nextErrors = {};

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [key, value, error] = result.value;
          if (error) {
            nextErrors[key] = error.message || `Failed to load ${key} analytics.`;
            nextErrors.general = nextErrors.general || 'Some analytics sections could not be loaded.';
            return;
          }
          nextAnalytics[key] = value;
          return;
        }

        nextErrors.general = result.reason?.message || 'Some analytics sections could not be loaded.';
      });

      setAnalytics(nextAnalytics);
      setAnalyticsErrors(nextErrors);
      setIsAnalyticsLoading(false);
    };

    loadAnalytics();

    return () => {
      isCancelled = true;
    };
  }, [analyticsRefreshKey, authToken, authUser?.role, range]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadEvents = async () => {
      const params = new URLSearchParams({ range, limit: '100' });
      if (eventType) params.set('eventType', eventType);
      if (city) params.set('city', normalizeCityValue(city));

      try {
        setIsEventsLoading(true);
        setEventsError('');
        const response = await apiRequest(`/api/admin/behavior/events?${params.toString()}`, { token: authToken });

        if (!isCancelled) {
          setEvents(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (error) {
        if (!isCancelled) {
          setEventsError(error.message || 'Failed to load behavior events.');
        }
      } finally {
        if (!isCancelled) {
          setIsEventsLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      isCancelled = true;
    };
  }, [authToken, authUser?.role, city, eventType, range]);

  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return;
    }

    void loadRecommendationData();
  }, [authToken, authUser?.role, loadRecommendationData]);

  const dashboardKpiLookup = useMemo(
    () =>
      (dashboardSnapshot?.kpis || []).reduce((lookup, item) => {
        lookup[item.id] = item;
        return lookup;
      }, {}),
    [dashboardSnapshot],
  );

  const commerceKpis = useMemo(() => {
    const overview = analytics.overview || {};
    const products = Array.isArray(analytics.products) ? analytics.products : [];
    const commerceSummary = dashboardSnapshot?.summary || {};
    const revenueKpi = dashboardKpiLookup.revenue;
    const ordersKpi = dashboardKpiLookup.orders;
    const estimatedRevenue = products.reduce(
      (sum, product) => sum + Number(product.productPrice || 0) * Number(product.purchases || 0),
      0,
    );
    const salesCount =
      Number(commerceSummary.totalSales || 0) ||
      products.reduce((sum, product) => sum + Number(product.purchases || 0), 0) ||
      Number(overview.purchasesCount || 0);
    const lowStockCount =
      Number(commerceSummary.lowStockProducts || 0) ||
      Number(analytics.warehouses?.summary?.lowStockItems || 0) ||
      products.filter((product) => Number(product.totalStock || 0) > 0 && Number(product.totalStock || 0) <= 3).length;
    const activeCustomers =
      Number(overview.activeCustomersCount || overview.activeUsersCount || overview.activeSessionsCount || 0) ||
      Number(commerceSummary.activeCustomers || 0) ||
      Number(overview.activeCitiesCount || 0);
    const conversionRate = Number(overview.estimatedConversionRate || 0);
    const totalOrders = Number(commerceSummary.totalOrders || 0) || Number(ordersKpi?.value ?? overview.purchasesCount ?? 0);
    const totalRevenue = Number(commerceSummary.totalRevenue || 0) || Number(revenueKpi?.value ?? estimatedRevenue ?? 0);

    return [
      {
        title: 'Total Sales',
        value: formatNumber(salesCount),
        trend: salesCount > 0 ? 'Live demand' : 'No sales yet',
        tone: salesCount > 0 ? 'good' : 'neutral',
        icon: 'sales',
        helper: 'Purchase signals',
      },
      {
        title: 'Total Orders',
        value: formatNumber(totalOrders),
        trend: ordersKpi?.delta?.value || 'Range total',
        tone: ordersKpi?.delta?.direction === 'down' ? 'bad' : ordersKpi?.delta?.direction === 'up' ? 'good' : 'neutral',
        icon: 'orders',
        helper: commerceSummary.totalOrders ? 'Confirmed orders' : ordersKpi ? 'This month' : 'From analytics events',
      },
      {
        title: 'Active Customers',
        value: formatNumber(activeCustomers),
        trend: activeCustomers > 0 ? 'Active now' : 'Awaiting data',
        tone: activeCustomers > 0 ? 'good' : 'neutral',
        icon: 'customers',
        helper: overview.activeCustomersCount || overview.activeUsersCount ? 'Unique customers' : 'Safe activity fallback',
      },
      {
        title: 'Conversion Rate',
        value: formatPercent(conversionRate),
        trend: conversionRate > 0 ? 'Views to sales' : 'Needs traffic',
        tone: conversionRate >= 3 ? 'good' : conversionRate > 0 ? 'warn' : 'neutral',
        icon: 'conversion',
        helper: `${formatNumber(overview.productViews)} product views`,
      },
      {
        title: 'Low Stock Products',
        value: formatNumber(lowStockCount),
        trend: lowStockCount > 0 ? 'Needs review' : 'Healthy stock',
        tone: lowStockCount > 0 ? 'warn' : 'good',
        icon: 'stock',
        helper: 'Across warehouses',
      },
      {
        title: 'Total Revenue',
        value: formatCurrency(totalRevenue),
        trend: revenueKpi?.delta?.value || (estimatedRevenue > 0 ? 'Estimated' : 'No revenue yet'),
        tone: revenueKpi?.delta?.direction === 'down' ? 'bad' : revenueKpi?.delta?.direction === 'up' ? 'good' : 'neutral',
        icon: 'revenue',
        helper: commerceSummary.totalRevenue ? 'Confirmed revenue' : revenueKpi ? 'This month' : 'From product sales',
      },
    ];
  }, [analytics.overview, analytics.products, analytics.warehouses, dashboardKpiLookup, dashboardSnapshot?.summary]);

  const dashboardHighlights = useMemo(() => {
    const overview = analytics.overview || {};
    const commerceSummary = dashboardSnapshot?.summary || {};
    const topProduct = commerceSummary.topProduct?.productName || overview.topProduct?.title || 'No product yet';
    const topProductHelper = commerceSummary.topProduct?.unitsSold
      ? `${formatNumber(commerceSummary.topProduct.unitsSold)} sold`
      : overview.topProduct?.count
        ? `${formatNumber(overview.topProduct.count)} tracked signals`
        : 'Awaiting sales and behavior data';
    const topCity = overview.topCity?.cityLabel || analytics.warehouses?.summary?.topDemandCity?.cityLabel || 'No city yet';
    const topCategory = overview.topCategory?.category || commerceSummary.topProduct?.category || 'No category yet';

    return [
      {
        label: 'Top product',
        value: topProduct,
        helper: topProductHelper,
        tone: topProduct === 'No product yet' ? 'neutral' : 'good',
      },
      {
        label: 'Top city',
        value: topCity,
        helper: overview.topCity?.count ? `${formatNumber(overview.topCity.count)} events in range` : 'Based on demand and warehouse pressure',
        tone: topCity === 'No city yet' ? 'neutral' : 'good',
      },
      {
        label: 'Top category',
        value: topCategory,
        helper: overview.topCategory?.count ? `${formatNumber(overview.topCategory.count)} signals` : 'Fallback from best-selling product',
        tone: topCategory === 'No category yet' ? 'neutral' : 'warn',
      },
    ];
  }, [analytics.overview, analytics.warehouses, dashboardSnapshot?.summary]);

  const overviewCards = useMemo(() => {
    const overview = analytics.overview || {};
    const urgentAlerts =
      Number(analytics.warehouses?.summary?.criticalStockPressure || 0) ||
      Number(analytics.warehouses?.summary?.lowStockItems || 0) ||
      0;
    return [
      { label: 'Product Views', value: formatNumber(overview.productViews), helper: `${formatNumber(overview.totalEvents)} total events` },
      { label: 'Add to Cart', value: formatNumber(overview.addToCartCount), helper: 'Cart intent signals' },
      { label: 'Purchases', value: formatNumber(overview.purchasesCount), helper: 'Completed purchase signals' },
      { label: 'Conversion Rate', value: formatPercent(overview.estimatedConversionRate), helper: 'Views to purchases' },
      { label: 'Top City', value: overview.topCity?.cityLabel || 'None', helper: overview.topCity ? `${overview.topCity.count} events` : 'No city activity yet' },
      { label: 'Top Product', value: overview.topProduct?.title || 'None', helper: overview.topProduct ? `${overview.topProduct.count} signals` : 'No product signals yet' },
      { label: 'Urgent Alerts', value: formatNumber(urgentAlerts), helper: 'Stock and warehouse pressure' },
    ];
  }, [analytics.overview, analytics.warehouses]);

  const topProductMaxDemand = useMemo(
    () => Math.max(...(analytics.products || []).slice(0, 5).map((product) => Number(product.demandScore || 0)), 1),
    [analytics.products],
  );

  const productCategories = useMemo(
    () =>
      Array.from(new Set((analytics.products || []).map((product) => product.productCategory).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [analytics.products],
  );

  const productBadgeContext = useMemo(
    () => ({
      maxSales: Math.max(...(analytics.products || []).map((product) => Number(product.purchases || 0)), 0),
      maxViews: Math.max(...(analytics.products || []).map((product) => Number(product.views || 0)), 0),
      maxTryOns: Math.max(...(analytics.products || []).map((product) => Number(product.tryOns || 0)), 0),
    }),
    [analytics.products],
  );

  const topPerformingProducts = useMemo(() => {
    const products = (analytics.products || []).filter((product) =>
      productCategoryFilter ? product.productCategory === productCategoryFilter : true,
    );

    const sorters = {
      sales: (left, right) => Number(right.purchases || 0) - Number(left.purchases || 0),
      views: (left, right) => Number(right.views || 0) - Number(left.views || 0),
      cart: (left, right) => Number(right.addToCart || 0) - Number(left.addToCart || 0),
      tryOn: (left, right) => Number(right.tryOns || 0) - Number(left.tryOns || 0),
      lowStock: (left, right) =>
        Number(left.totalStock || 0) - Number(right.totalStock || 0) ||
        Number(right.demandScore || 0) - Number(left.demandScore || 0),
    };

    return [...products].sort(sorters[productSort] || sorters.sales).slice(0, 12);
  }, [analytics.products, productCategoryFilter, productSort]);

  const lowStockProducts = useMemo(
    () =>
      (analytics.products || [])
        .filter((product) => {
          const stock = Number(product.totalStock || 0);
          const threshold = Math.max(Number(product.lowStockThreshold || 3), 1);
          const status = String(product.inventoryStatus || product.status || '').toLowerCase();
          return stock <= threshold || status.includes('low') || status.includes('critical') || status.includes('out');
        })
        .sort(
          (left, right) =>
            Number(left.totalStock || 0) - Number(right.totalStock || 0) ||
            Number(right.purchases || 0) - Number(left.purchases || 0) ||
            Number(right.demandScore || 0) - Number(left.demandScore || 0),
        )
        .slice(0, 8),
    [analytics.products],
  );

  const handleGenerateRecommendations = async () => {
    try {
      setIsGeneratingRecommendations(true);
      setRecommendationsError('');
      setRecommendationsMessage('');
      const response = await apiRequest('/api/admin/inventory-recommendations/generate', {
        method: 'POST',
        token: authToken,
        body: { range },
      });
      const generatedCount = Number(response?.generatedCount || 0);
      const updatedCount = Number(response?.updatedCount || 0);
      const skippedCount = Number(response?.skippedCount || 0);
      setRecommendationsMessage(
        response?.message ||
          `Generated ${generatedCount} recommendation${generatedCount === 1 ? '' : 's'}, updated ${updatedCount}, skipped ${skippedCount}.`,
      );
      await loadRecommendationData({ quiet: true });
    } catch (error) {
      setRecommendationsError(error.message || 'Failed to generate inventory recommendations.');
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const handleRecommendationAction = async (recommendationId, action) => {
    if (!recommendationId || activeRecommendationAction) {
      return;
    }

    try {
      setActiveRecommendationAction(`${action}:${recommendationId}`);
      setRecommendationsError('');
      setRecommendationsMessage('');
      const response = await apiRequest(`/api/admin/inventory-recommendations/${recommendationId}/${action}`, {
        method: 'PATCH',
        token: authToken,
      });
      setRecommendationsMessage(response?.message || 'Recommendation updated.');
      await loadRecommendationData({ quiet: true });
    } catch (error) {
      setRecommendationsError(error.message || 'Recommendation action failed.');
    } finally {
      setActiveRecommendationAction('');
    }
  };

  const pressureRows = useMemo(
    () =>
      (analytics.warehouses?.warehouses || []).flatMap((warehouse) =>
        (warehouse.stockPressureItems || []).map((item) => ({
          ...item,
          warehouseId: warehouse.warehouseId,
          warehouseName: warehouse.warehouseName,
          cityLabel: warehouse.cityLabel,
        })),
      ),
    [analytics.warehouses],
  );

  const cityInsight = analytics.cities?.[0]
    ? `${analytics.cities[0].cityLabel} is currently most active${
        analytics.cities[0].topCategories?.[0]?.category ? `, with high interest in ${analytics.cities[0].topCategories[0].category}.` : '.'
      }`
    : 'No city activity yet. Make sure users have a selected city.';

  if (authLoading) {
    return <div className="section-shell py-12 text-lg text-ink-soft">Checking analytics access...</div>;
  }

  if (!authUser || authUser.role !== 'admin') {
    return <div className="section-shell py-12 text-lg text-ink-soft">Redirecting to the login page...</div>;
  }

  return (
    <div className="section-shell space-y-8 pb-10 pt-8">
      <section className="heritage-surface rounded-[28px] border px-5 py-6 sm:px-7 lg:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <span className="heritage-pill">Commerce intelligence</span>
            <SectionTitle
              title="Admin Analytics"
              description="A decision dashboard for store performance, funnel drop-off, demand, marketing actions, inventory moves, and optional AI explanations."
            />
          </div>
          <AdminNavigation />
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {isAnalyticsLoading || isDashboardLoading
            ? Array.from({ length: 3 }, (_, index) => <LoadingBlock key={index} label="Loading dashboard highlights..." />)
            : dashboardHighlights.map((highlight) => <DashboardHeroStat key={highlight.label} {...highlight} />)}
        </div>
      </section>

      <DashboardToolbar range={range} onRangeChange={setRange} />

      <AnalyticsError message={analyticsErrors.general} />
      <AnalyticsError message={dashboardError} />

      <SectionCard id="overview" title="Executive Overview" description="Quick read on store health, conversion, and top demand signals.">
        {isAnalyticsLoading || isDashboardLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <LoadingBlock key={index} label="Loading executive overview..." />)}
          </div>
        ) : analytics.overview?.totalEvents > 0 || commerceKpis.some((card) => Number(String(card.value).replace(/[^0-9.-]/g, '')) > 0) ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewCards.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[24px] border border-line bg-[#fffaf8] p-5">
                <h3 className="font-display text-3xl text-ink">Commerce Pulse</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {commerceKpis.slice(0, 4).map((card) => (
                    <DashboardKpiCard key={card.title} {...card} />
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-3xl text-ink">Demand Leaders</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">Top products by weighted demand score. Open Demand for the full table.</p>
                  </div>
                  <span className="heritage-pill whitespace-nowrap">{timeRanges.find((option) => option.value === range)?.label || 'Range'}</span>
                </div>
                <div className="mt-5 space-y-3">
                  {(analytics.products || []).slice(0, 5).length > 0 ? (
                    (analytics.products || []).slice(0, 5).map((product) => (
                      <ProgressRow
                        key={product.productId}
                        label={product.productTitle}
                        value={product.demandScore}
                        max={topProductMaxDemand}
                        meta={`${formatNumber(product.demandScore)} score`}
                      />
                    ))
                  ) : (
                    <EmptyState>No product demand rows yet.</EmptyState>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>No analytics data for this time range yet.</EmptyState>
        )}
      </SectionCard>

      <CustomerBehaviorFunnelSection
        id="funnel"
        funnel={analytics.customerFunnel}
        isLoading={isAnalyticsLoading}
        errorMessage={analyticsErrors.customerFunnel}
      />

      <SectionCard
        id="demand"
        title="Demand Intelligence"
        description="Explore product, city, category, and search demand signals."
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <TabButton active={activeDemandTab === 'products'} onClick={() => setActiveDemandTab('products')}>Products</TabButton>
          <TabButton active={activeDemandTab === 'cities'} onClick={() => setActiveDemandTab('cities')}>Cities</TabButton>
          <TabButton active={activeDemandTab === 'search'} onClick={() => setActiveDemandTab('search')}>Search Demand</TabButton>
        </div>

        {activeDemandTab === 'products' ? (
          <>
        <div className="mb-5 grid gap-4 rounded-[24px] border border-line bg-[#fffaf8] p-4 md:grid-cols-[220px_220px_1fr]">
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Sort by</span>
            <select
              value={productSort}
              onChange={(event) => setProductSort(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
            >
              {productSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Category</span>
            <select
              value={productCategoryFilter}
              onChange={(event) => setProductCategoryFilter(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
            >
              <option value="">All categories</option>
              {productCategories.map((categoryOption) => (
                <option key={categoryOption} value={categoryOption}>
                  {categoryOption}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end text-sm leading-6 text-ink-soft">
            Badges highlight products that are selling well, attracting views or try-ons, running low on stock, or under-converting after strong traffic.
          </div>
        </div>

        {analyticsErrors.products ? <AnalyticsError message={analyticsErrors.products} /> : null}

        {isAnalyticsLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <LoadingBlock key={index} label="Loading top product cards..." />
            ))}
          </div>
        ) : topPerformingProducts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {topPerformingProducts.map((product) => (
              <ProductAnalyticsCard
                key={product.productId}
                product={product}
                badges={getProductAnalyticsBadges(product, productBadgeContext)}
              />
            ))}
          </div>
        ) : (
          <EmptyState>No product performance data matches this filter yet.</EmptyState>
        )}

        <div className="mt-6">
          <h3 className="font-display text-3xl text-ink">Detailed Product Demand</h3>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Full demand ranking with views, cart intent, purchases, conversion, stock, and status.
          </p>
          <div className="mt-4">
            {isAnalyticsLoading ? (
              <EmptyState>Loading product demand...</EmptyState>
            ) : analytics.products?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Views</th>
                      <th className="px-4 py-3">Cart Adds</th>
                      <th className="px-4 py-3">Purchases</th>
                      <th className="px-4 py-3">Demand Score</th>
                      <th className="px-4 py-3">Conversion</th>
                      <th className="px-4 py-3">Total Stock</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.products.map((product) => (
                      <tr key={product.productId} className="border-b border-line/60 align-top text-ink">
                        <td className="px-4 py-4 font-semibold">{product.productTitle}</td>
                        <td className="px-4 py-4">{product.productCategory || '-'}</td>
                        <td className="px-4 py-4">{formatNumber(product.views)}</td>
                        <td className="px-4 py-4">{formatNumber(product.addToCart)}</td>
                        <td className="px-4 py-4">{formatNumber(product.purchases)}</td>
                        <td className="px-4 py-4 font-bold">{formatNumber(product.demandScore)}</td>
                        <td className="px-4 py-4">{formatPercent(product.conversionRate)}</td>
                        <td className="px-4 py-4">{formatNumber(product.totalStock)}</td>
                        <td className="px-4 py-4"><StatusBadge>{product.status}</StatusBadge></td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link className="text-sm font-semibold text-[#8f5f45] underline" to={`/products/${product.slug || product.productId}`}>
                              View
                            </Link>
                            <Link className="text-sm font-semibold text-[#8f5f45] underline" to="/admin/inventory">
                              Edit Stock
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No product demand signals yet. Open products, add items to cart, or place orders to start collecting data.</EmptyState>
            )}
          </div>
        </div>
          </>
        ) : null}

        {activeDemandTab === 'cities' ? (
          <div>
            <p className="mb-4 text-sm leading-6 text-ink-soft">{cityInsight}</p>
            {isAnalyticsLoading ? (
              <EmptyState>Loading city demand...</EmptyState>
            ) : analytics.cities?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Total Activity</th>
                      <th className="px-4 py-3">Top Category</th>
                      <th className="px-4 py-3">Top Product</th>
                      <th className="px-4 py-3">Purchases</th>
                      <th className="px-4 py-3">Demand Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.cities.map((cityRow) => (
                      <tr key={cityRow.city || 'unknown'} className="border-b border-line/60 text-ink">
                        <td className="px-4 py-4 font-semibold">{cityRow.cityLabel}</td>
                        <td className="px-4 py-4">{formatNumber(cityRow.totalEvents)}</td>
                        <td className="px-4 py-4">{cityRow.topCategories?.[0]?.category || '-'}</td>
                        <td className="px-4 py-4">{cityRow.topProducts?.[0]?.productTitle || '-'}</td>
                        <td className="px-4 py-4">{formatNumber(cityRow.purchases)}</td>
                        <td className="px-4 py-4 font-bold">{formatNumber(cityRow.demandScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No city activity yet. Make sure users have a selected city.</EmptyState>
            )}
          </div>
        ) : null}

        {activeDemandTab === 'search' ? (
          <div>
            {isAnalyticsLoading ? (
              <EmptyState>Loading search trends...</EmptyState>
            ) : analytics.searches?.topSearchQueries?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="px-4 py-3">Search Query</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Top City</th>
                      <th className="px-4 py-3">Avg Results</th>
                      <th className="px-4 py-3">Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.searches.topSearchQueries.map((query) => (
                      <tr key={query.query} className="border-b border-line/60 text-ink">
                        <td className="px-4 py-4 font-semibold">{query.query}</td>
                        <td className="px-4 py-4">{formatNumber(query.count)}</td>
                        <td className="px-4 py-4">{query.topCity?.cityLabel || '-'}</td>
                        <td className="px-4 py-4">{query.resultsCountAverage ?? '-'}</td>
                        <td className="px-4 py-4 text-ink-soft">
                          {query.hasZeroResultSearches ? 'Customers are searching for this, but no products were found.' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No searches tracked yet.</EmptyState>
            )}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        id="marketing"
        title="Marketing Intelligence"
        description="Detected marketing opportunities with optional AI-generated campaign plans."
      >
        <MarketingIntelligencePipeline advancedAi={advancedAi} />
      </SectionCard>

      <SectionCard
        id="inventory"
        title="Inventory Intelligence"
        description="Stock pressure, warehouse distribution, restock recommendations, and demand forecast."
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <TabButton active={activeInventoryTab === 'stock'} onClick={() => setActiveInventoryTab('stock')}>Stock Pressure</TabButton>
          <TabButton active={activeInventoryTab === 'warehouses'} onClick={() => setActiveInventoryTab('warehouses')}>Warehouse Distribution</TabButton>
          <TabButton active={activeInventoryTab === 'recommendations'} onClick={() => setActiveInventoryTab('recommendations')}>AI Restock</TabButton>
          <TabButton active={activeInventoryTab === 'forecast'} onClick={() => setActiveInventoryTab('forecast')}>Demand Forecast</TabButton>
        </div>

        {activeInventoryTab === 'stock' ? (
          <>
        {analyticsErrors.products ? <AnalyticsError message={analyticsErrors.products} /> : null}

        {isAnalyticsLoading ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <LoadingBlock key={index} label="Loading low stock products..." />
            ))}
          </div>
        ) : lowStockProducts.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {lowStockProducts.map((product) => (
              <LowStockProductCard key={product.productId} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState>No low-stock products are visible for this range. Inventory looks healthy right now.</EmptyState>
        )}
          </>
        ) : null}

        {activeInventoryTab === 'warehouses' ? (
          <>
            {isAnalyticsLoading ? (
              <EmptyState>Loading warehouse intelligence...</EmptyState>
            ) : analytics.warehouses ? (
              <>
                <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Total Warehouse Stock" value={formatNumber(analytics.warehouses.summary?.totalWarehouseStock)} helper="Across all warehouses" />
                  <MetricCard label="Low Stock Items" value={formatNumber(analytics.warehouses.summary?.lowStockItems)} helper="Per-warehouse low inventory" />
                  <MetricCard label="Critical Pressure" value={formatNumber(analytics.warehouses.summary?.criticalStockPressure)} helper="High demand with very low city stock" />
                  <MetricCard label="Top Demand City" value={analytics.warehouses.summary?.topDemandCity?.cityLabel || 'None'} helper="Based on city demand score" />
                </div>

                <div className="mb-5 flex flex-col gap-3 rounded-[24px] border border-line bg-[#fffaf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-ink-soft">
                    Turn current warehouse pressure into reviewable stock transfer recommendations. Admin approval is still required before stock changes.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveInventoryTab('recommendations');
                      void handleGenerateRecommendations();
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-2 text-sm font-bold text-white transition hover:bg-rose"
                  >
                    Generate Recommendations
                  </button>
                </div>

                {pressureRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                          <th className="px-4 py-3">Warehouse</th>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">City Demand Score</th>
                          <th className="px-4 py-3">City Stock</th>
                          <th className="px-4 py-3">Total Stock</th>
                          <th className="px-4 py-3">Pressure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pressureRows.map((item) => (
                          <tr key={`${item.warehouseId}-${item.productId}`} className="border-b border-line/60 text-ink">
                            <td className="px-4 py-4">
                              <span className="font-semibold">{item.warehouseName}</span>
                              <span className="block text-xs text-ink-soft">{item.cityLabel}</span>
                            </td>
                            <td className="px-4 py-4">{item.productTitle}</td>
                            <td className="px-4 py-4 font-bold">{formatNumber(item.cityDemandScore)}</td>
                            <td className="px-4 py-4">{formatNumber(item.warehouseQuantity)}</td>
                            <td className="px-4 py-4">{formatNumber(item.totalStockAcrossWarehouses)}</td>
                            <td className="px-4 py-4"><StatusBadge>{item.pressureLevel}</StatusBadge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState>No warehouse pressure detected yet.</EmptyState>
                )}
              </>
            ) : (
              <EmptyState>No warehouse pressure detected yet.</EmptyState>
            )}
          </>
        ) : null}

        {activeInventoryTab === 'recommendations' ? (
          <>
            <div className="mb-5 grid gap-4 rounded-[24px] border border-line bg-[#fffaf8] p-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Recommendation range</span>
                <select
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
                >
                  {timeRanges.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm leading-6 text-ink-soft">
                AI explanation is based on tracked demand and warehouse stock. Admin approval is required before stock changes.
              </p>
              <button
                type="button"
                onClick={handleGenerateRecommendations}
                disabled={isGeneratingRecommendations}
                className="min-h-12 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-rose disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingRecommendations ? 'Generating...' : 'Generate AI Inventory Recommendations'}
              </button>
            </div>

            {recommendationsError ? <AnalyticsError message={recommendationsError} /> : null}
            {recommendationsMessage ? (
              <div className="mb-5 rounded-[24px] border border-[#d7e6d1] bg-[#f4fbf1] px-5 py-4 text-sm text-[#426b42]">
                {recommendationsMessage}
              </div>
            ) : null}

            {isRecommendationsLoading ? (
              <EmptyState>Loading inventory recommendations...</EmptyState>
            ) : recommendations.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.map((recommendation) => {
                  const recommendationId = getRecommendationId(recommendation);
                  const explanation = recommendation.aiExplanation || recommendation.reason || '';
                  const actionPrefix = (action) => `${action}:${recommendationId}`;
                  const isPending = recommendation.status === 'pending';
                  const isApproved = recommendation.status === 'approved';
                  const canApply = isPending || isApproved;
                  const canReject = isPending || isApproved;

                  return (
                    <article key={recommendationId} className="rounded-[24px] border border-line bg-white p-5 shadow-card">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {recommendation.productCategory || recommendation.product?.category || 'Product'}
                          </p>
                          <h3 className="mt-2 font-display text-3xl leading-tight text-ink">
                            {getProductTitle(recommendation.product, recommendation.productTitle)}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge>{recommendation.pressureLevel}</StatusBadge>
                          <StatusBadge>{recommendation.status}</StatusBadge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-ink sm:grid-cols-2">
                        <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
                          <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted">Demand City</span>
                          <span className="mt-1 block font-semibold">{recommendation.demandCityLabel || getCityLabel(recommendation.demandCity)}</span>
                        </div>
                        <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
                          <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted">Confidence</span>
                          <span className="mt-1 block font-semibold">{formatNumber(recommendation.confidence)}%</span>
                        </div>
                        <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
                          <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted">Current City Stock</span>
                          <span className="mt-1 block font-semibold">{formatNumber(recommendation.destinationStock)} units</span>
                        </div>
                        <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
                          <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted">Source Stock</span>
                          <span className="mt-1 block font-semibold">{formatNumber(recommendation.sourceStock)} units</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[18px] border border-line px-4 py-4 text-sm leading-6 text-ink">
                        <span className="font-bold">Move {formatNumber(recommendation.suggestedQuantity)} units</span> from{' '}
                        {getWarehouseName(recommendation.fromWarehouse, recommendation.fromWarehouseName)} to{' '}
                        {getWarehouseName(recommendation.toWarehouse, recommendation.toWarehouseName)}.
                      </div>

                      {explanation ? (
                        <div className="mt-4 rounded-[18px] bg-[#f7f1eb] px-4 py-4 text-sm leading-6 text-ink-soft">
                          {explanation}
                          {!recommendation.aiExplanation ? (
                            <span className="mt-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted">
                              Template explanation used
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {canApply || canReject ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleRecommendationAction(recommendationId, 'approve')}
                              disabled={Boolean(activeRecommendationAction)}
                              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-blush/60 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {activeRecommendationAction === actionPrefix('approve') ? 'Approving...' : 'Approve'}
                            </button>
                          ) : null}
                          {canReject ? (
                            <button
                              type="button"
                              onClick={() => handleRecommendationAction(recommendationId, 'reject')}
                              disabled={Boolean(activeRecommendationAction)}
                              className="rounded-full border border-[#e7c8c8] bg-white px-4 py-2 text-sm font-bold text-[#8c6546] transition hover:bg-[#fff4f1] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {activeRecommendationAction === actionPrefix('reject') ? 'Rejecting...' : 'Reject'}
                            </button>
                          ) : null}
                          {canApply ? (
                            <button
                              type="button"
                              onClick={() => handleRecommendationAction(recommendationId, 'apply')}
                              disabled={Boolean(activeRecommendationAction)}
                              className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-rose disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {activeRecommendationAction === actionPrefix('apply') ? 'Applying...' : 'Apply Transfer'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState>No inventory recommendations found for this range.</EmptyState>
            )}

            <div className="mt-8">
              <h3 className="font-display text-3xl text-ink">Movement History</h3>
              <div className="mt-4 overflow-x-auto rounded-[24px] border border-line">
                {movements.length > 0 ? (
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">From</th>
                        <th className="px-4 py-3">To</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement._id || movement.id} className="border-b border-line/60 align-top text-ink">
                          <td className="whitespace-nowrap px-4 py-4">{movement.createdAt ? new Date(movement.createdAt).toLocaleString() : '-'}</td>
                          <td className="px-4 py-4 font-semibold">{getProductTitle(movement.product)}</td>
                          <td className="px-4 py-4">{getWarehouseName(movement.fromWarehouse)}</td>
                          <td className="px-4 py-4">{getWarehouseName(movement.toWarehouse)}</td>
                          <td className="px-4 py-4 font-bold">{formatNumber(movement.quantity)}</td>
                          <td className="px-4 py-4 text-ink-soft">{movement.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-6 text-sm text-ink-soft">No stock transfers have been applied yet.</div>
                )}
              </div>
            </div>
          </>
        ) : null}

        {activeInventoryTab === 'forecast' ? <DemandForecastPanel advancedAi={advancedAi} /> : null}
      </SectionCard>

      <SectionCard id="ai-insights" title="AI Insights" description="Optional AI summaries and business explanations generated from analytics data.">
        <DetailPanel title="AI Tool Usage" description="Usage counters for Visual Search and Try-On. No user images or generated images are shown here.">
        {isAnalyticsLoading ? (
          <EmptyState>Loading AI tool usage...</EmptyState>
        ) : analytics.aiTools && (analytics.aiTools.visualSearchCount > 0 || analytics.aiTools.tryOnCount > 0) ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Visual Searches" value={formatNumber(analytics.aiTools.visualSearchCount)} helper={`${formatNumber(analytics.aiTools.visualSearchSuccessCount)} success`} />
              <MetricCard label="Visual Failures" value={formatNumber(analytics.aiTools.visualSearchFailedCount)} helper="Failed visual searches" />
              <MetricCard label="Try-On Generations" value={formatNumber(analytics.aiTools.tryOnCount)} helper={`${formatPercent(analytics.aiTools.tryOnSuccessRate)} success rate`} />
              <MetricCard label="Most Tried Product" value={analytics.aiTools.tryOnByProduct?.[0]?.productTitle || 'None'} helper={analytics.aiTools.tryOnByProduct?.[0] ? `${analytics.aiTools.tryOnByProduct[0].count} tries` : ''} />
              <MetricCard label="Top Visual Tag" value={analytics.aiTools.visualSearchTopDetectedTags?.[0]?.tag || 'None'} helper={analytics.aiTools.visualSearchTopDetectedTags?.[0] ? `${analytics.aiTools.visualSearchTopDetectedTags[0].count} detections` : ''} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[24px] border border-line p-4">
                <h3 className="font-display text-3xl text-ink">Try-On by Product</h3>
                <div className="mt-4 space-y-3">
                  {(analytics.aiTools.tryOnByProduct || []).length > 0 ? (
                    analytics.aiTools.tryOnByProduct.map((row) => (
                      <div key={row.productTitle} className="flex items-center justify-between gap-3 rounded-[18px] bg-[#fffaf8] px-4 py-3 text-sm">
                        <span className="font-semibold text-ink">{row.productTitle}</span>
                        <span className="text-ink-soft">{row.count} total / {row.success} success / {row.failure} failed</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState>No try-on product usage tracked yet.</EmptyState>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-line p-4">
                <h3 className="font-display text-3xl text-ink">Try-On by Style</h3>
                <div className="mt-4 space-y-3">
                  {(analytics.aiTools.tryOnByStyle || []).length > 0 ? (
                    analytics.aiTools.tryOnByStyle.map((row) => (
                      <div key={row.style} className="flex items-center justify-between gap-3 rounded-[18px] bg-[#fffaf8] px-4 py-3 text-sm">
                        <span className="font-semibold capitalize text-ink">{row.style}</span>
                        <span className="text-ink-soft">{row.count}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState>No try-on styles tracked yet.</EmptyState>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>No AI tool usage tracked yet.</EmptyState>
        )}
        </DetailPanel>

        <div className="mt-5">
          <DetailPanel title="Behavior Events" description="Latest clean demand signals from Phase 2 tracking. Filters share the selected dashboard time range.">
        <div className="mb-5 grid gap-4 rounded-[24px] border border-line bg-[#fffaf8] p-4 md:grid-cols-[220px_220px_1fr]">
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Event type</span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
            >
              {eventTypes.map((type) => (
                <option key={type || 'all'} value={type}>
                  {type ? formatEventType(type) : 'All events'}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">City</span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
            >
              <option value="">All cities</option>
              {PALESTINIAN_CITIES.map((cityOption) => (
                <option key={cityOption.value} value={cityOption.value}>
                  {cityOption.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end text-sm text-ink-soft">Showing the latest 100 matching behavior events.</div>
        </div>

        {eventsError ? <AnalyticsError message={eventsError} /> : null}

        {isEventsLoading ? (
          <EmptyState>Loading behavior events...</EmptyState>
        ) : events.length > 0 ? (
          <div className="max-h-[560px] overflow-auto rounded-[24px] border border-line">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">User City</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Search Query</th>
                  <th className="px-4 py-3">Source Page</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-line/60 align-top text-ink">
                    <td className="whitespace-nowrap px-4 py-4">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</td>
                    <td className="px-4 py-4">{formatEventType(event.eventType)}</td>
                    <td className="px-4 py-4">{event.userCity ? getCityLabel(event.userCity) : '-'}</td>
                    <td className="px-4 py-4">{event.productTitle || '-'}</td>
                    <td className="px-4 py-4">{event.productCategory || '-'}</td>
                    <td className="px-4 py-4">{event.quantity ?? '-'}</td>
                    <td className="px-4 py-4">{event.searchQuery || '-'}</td>
                    <td className="px-4 py-4">{event.sourcePage || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No behavior events found yet.</EmptyState>
        )}
          </DetailPanel>
        </div>

        <div className="mt-5">
          <DetailPanel title="Optional AI Summaries" description="Business summaries and secondary AI-only explanations kept collapsed until needed.">
            <AiInsightsWorkspace advancedAi={advancedAi} />
          </DetailPanel>
        </div>
      </SectionCard>
    </div>
  );
};

export default AdminBehaviorAnalyticsPage;


