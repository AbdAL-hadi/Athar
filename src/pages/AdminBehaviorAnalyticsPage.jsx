import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/admin/AdminNavigation';
import SectionTitle from '../components/SectionTitle';
import { PALESTINIAN_CITIES, getCityLabel, normalizeCityValue } from '../data/palestinianCities';
import { apiRequest } from '../utils/api';

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
  <div className="rounded-[22px] bg-[#fffaf8] px-5 py-6 text-sm leading-6 text-ink-soft">{children}</div>
);

const MetricCard = ({ label, value, helper = '' }) => (
  <div className="rounded-[24px] border border-line bg-white px-5 py-5 shadow-card">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
    <p className="mt-3 font-display text-4xl text-ink">{value}</p>
    {helper ? <p className="mt-2 text-sm leading-6 text-ink-soft">{helper}</p> : null}
  </div>
);

const SectionCard = ({ id, title, description = '', children }) => (
  <section id={id} className="rounded-[30px] bg-white p-5 shadow-card sm:p-6">
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-4xl text-ink">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{description}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

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

const AdminBehaviorAnalyticsPage = ({ authToken, authUser, authLoading }) => {
  const navigate = useNavigate();
  const [range, setRange] = useState('7d');
  const [eventType, setEventType] = useState('');
  const [city, setCity] = useState('');
  const [analytics, setAnalytics] = useState({
    overview: null,
    products: [],
    cities: [],
    warehouses: null,
    searches: null,
    aiTools: null,
  });
  const [events, setEvents] = useState([]);
  const [analyticsErrors, setAnalyticsErrors] = useState({});
  const [eventsError, setEventsError] = useState('');
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authToken || authUser?.role !== 'admin') {
      navigate('/auth');
    }
  }, [authLoading, authToken, authUser?.role, navigate]);

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
      };

      const results = await Promise.allSettled(
        Object.entries(endpoints).map(async ([key, endpoint]) => {
          const response = await apiRequest(endpoint, { token: authToken });
          return [key, response?.data ?? null];
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
      };
      const nextErrors = {};

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [key, value] = result.value;
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
  }, [authToken, authUser?.role, range]);

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

  const overviewCards = useMemo(() => {
    const overview = analytics.overview || {};
    return [
      { label: 'Product Views', value: formatNumber(overview.productViews), helper: `${formatNumber(overview.totalEvents)} total events` },
      { label: 'Add to Cart', value: formatNumber(overview.addToCartCount), helper: 'Cart intent signals' },
      { label: 'Purchases', value: formatNumber(overview.purchasesCount), helper: `${formatPercent(overview.estimatedConversionRate)} conversion` },
      { label: 'Top City', value: overview.topCity?.cityLabel || 'None', helper: overview.topCity ? `${overview.topCity.count} events` : 'No city activity yet' },
      { label: 'Top Product', value: overview.topProduct?.title || 'None', helper: overview.topProduct ? `${overview.topProduct.count} signals` : 'No product signals yet' },
      { label: 'Try-On Uses', value: formatNumber(overview.tryOnCount), helper: 'AI try-on events' },
      { label: 'Visual Searches', value: formatNumber(overview.visualSearchCount), helper: 'Visual search events' },
      { label: 'Searches', value: formatNumber(overview.searchesCount), helper: overview.topCategory?.category ? `Top category: ${overview.topCategory.category}` : 'No search data yet' },
    ];
  }, [analytics.overview]);

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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle
          title="Admin Analytics"
          description="Track demand, customer behavior, product interest, and warehouse stock signals."
        />
        <AdminNavigation />
      </div>

      <section className="rounded-[30px] bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {['overview', 'products', 'cities', 'warehouses', 'searches', 'ai-tools', 'events'].map((section) => (
              <a
                key={section}
                href={`#${section}`}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold capitalize text-ink-soft transition hover:bg-blush/60 hover:text-ink"
              >
                {section === 'ai-tools' ? 'AI Tool Usage' : section.replace('-', ' ')}
              </a>
            ))}
          </div>

          <label className="min-w-[220px]">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Time range</span>
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
        </div>
      </section>

      <AnalyticsError message={analyticsErrors.general} />

      <SectionCard id="overview" title="Overview" description="General store performance and behavior volume for the selected time range.">
        {isAnalyticsLoading ? (
          <EmptyState>Loading overview analytics...</EmptyState>
        ) : analytics.overview?.totalEvents > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>
        ) : (
          <EmptyState>No analytics data for this time range yet.</EmptyState>
        )}
      </SectionCard>

      <SectionCard id="products" title="Product Demand" description="Rule-based demand ranking from views, favorites, cart adds, purchases, reviews, and AI tool events.">
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
      </SectionCard>

      <SectionCard id="cities" title="City Demand" description={cityInsight}>
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
      </SectionCard>

      <SectionCard id="warehouses" title="Warehouse Intelligence" description="Demand by city connected to each warehouse's local product stock. This is analytics only, not transfer recommendations.">
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
      </SectionCard>

      <SectionCard id="searches" title="Search Trends" description="Search terms help reveal product and marketing gaps. Zero-result searches are highlighted when result metadata exists.">
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
      </SectionCard>

      <SectionCard id="ai-tools" title="AI Tool Usage" description="Usage counters for Visual Search and Try-On. No user images or generated images are shown here.">
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
      </SectionCard>

      <SectionCard id="events" title="Behavior Events" description="Latest clean demand signals from Phase 2 tracking. Filters share the selected dashboard time range.">
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
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
      </SectionCard>
    </div>
  );
};

export default AdminBehaviorAnalyticsPage;
