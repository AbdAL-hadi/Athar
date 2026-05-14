import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { resolveApiAssetUrl } from '../../utils/api';

const timeRanges = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString();

const badgeClasses = {
  'Low Stock': 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]',
  'Out of Stock': 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]',
  'Restock Soon': 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]',
  Overstocked: 'border-[#cfd8e3] bg-[#f4f7fb] text-[#4b6078]',
  'Moving Fast': 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]',
  'In Stock': 'border-line bg-white text-ink-soft',
};

const EmptyState = ({ children }) => (
  <div className="rounded-[24px] border border-line/80 bg-[#fffaf8] px-5 py-7 text-sm leading-6 text-ink-soft">{children}</div>
);

const LoadingState = () => (
  <div className="grid gap-4 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => (
      <div key={index} className="animate-pulse rounded-[24px] border border-line/70 bg-white px-5 py-6 shadow-card">
        <div className="h-3 w-28 rounded-full bg-[#eaded6]" />
        <div className="mt-5 h-9 w-20 rounded-full bg-[#f2e8e2]" />
        <div className="mt-4 h-3 w-40 rounded-full bg-[#f2e8e2]" />
      </div>
    ))}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[18px] border border-line bg-white px-4 py-3 text-sm shadow-card">
      {label ? <p className="mb-2 font-semibold text-ink">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={`${entry.dataKey}-${entry.name}`} className="text-ink-soft">
            <span className="font-semibold text-ink">{entry.name || entry.dataKey}:</span> {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    </div>
  );
};

const ChartPanel = ({ title, description, isEmpty, emptyMessage, children }) => (
  <article className="rounded-[26px] border border-line/80 bg-white p-5 shadow-card">
    <div className="mb-5">
      <h3 className="font-display text-3xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
    </div>
    {isEmpty ? <EmptyState>{emptyMessage}</EmptyState> : <div className="h-72 min-w-0">{children}</div>}
  </article>
);

const MetricCard = ({ label, value, helper }) => (
  <div className="rounded-[24px] border border-line/80 bg-white px-5 py-5 shadow-card">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
    <p className="mt-3 font-display text-4xl text-ink">{value}</p>
    {helper ? <p className="mt-2 text-sm leading-6 text-ink-soft">{helper}</p> : null}
  </div>
);

const Badge = ({ children }) => (
  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${badgeClasses[children] || badgeClasses['In Stock']}`}>
    {children}
  </span>
);

const ProductImagePlaceholder = () => (
  <div className="flex h-full min-h-[180px] w-full items-center justify-center bg-[#fffaf8] text-xs font-bold uppercase tracking-[0.16em] text-muted">
    Athar
  </div>
);

const InventoryProductCard = ({ product }) => {
  const imageUrl = resolveApiAssetUrl(product.image || '');
  const topWarehouseStock = (product.warehouseStock || [])
    .filter((stock) => Number(stock.quantity || 0) > 0)
    .sort((left, right) => Number(right.quantity || 0) - Number(left.quantity || 0))
    .slice(0, 3);

  return (
    <article className="overflow-hidden rounded-[26px] border border-line/80 bg-white shadow-card">
      <div className="grid sm:grid-cols-[150px_1fr]">
        <div className="min-h-[180px] bg-[#fffaf8]">
          {imageUrl ? (
            <img src={imageUrl} alt={product.title} loading="lazy" decoding="async" className="h-full min-h-[180px] w-full object-cover" />
          ) : (
            <ProductImagePlaceholder />
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-display text-3xl leading-tight text-ink">{product.title}</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">{product.category || 'Uncategorized'}</p>
            </div>
            <p className="font-display text-3xl text-ink">{formatNumber(product.totalStock)}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(product.badges?.length ? product.badges : [product.stockStatus]).map((badge) => (
              <Badge key={badge}>{badge}</Badge>
            ))}
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Current Stock</p>
              <p className="mt-1 font-semibold text-ink">{formatNumber(product.totalStock)} units</p>
            </div>
            <div className="rounded-[18px] bg-[#fffaf8] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Sales Velocity</p>
              <p className="mt-1 font-semibold text-ink">{product.salesVelocityLabel || '0 units/day'}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-line/70 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Warehouse Stock</p>
            {topWarehouseStock.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-soft">
                {topWarehouseStock.map((stock) => (
                  <span key={stock.warehouseId} className="rounded-full bg-[#fffaf8] px-3 py-1">
                    {stock.cityLabel || stock.warehouseName}: {formatNumber(stock.quantity)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">No warehouse stock available.</p>
            )}
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-ink">{product.reorderSuggestion}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {product.slug || product.productId ? (
              <Link className="button-secondary min-h-10 px-4 py-2 text-sm" to={`/products/${product.slug || product.productId}`}>
                View Product
              </Link>
            ) : null}
            <Link className="button-primary min-h-10 px-4 py-2 text-sm" to="/employee-dashboard">
              Edit Stock
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};

const productMatchesFilters = (product, filters) => {
  if (filters.category && product.category !== filters.category) return false;
  if (filters.status && product.stockStatus !== filters.status && !product.badges?.includes(filters.status)) return false;
  if (filters.warehouseId) {
    return (product.warehouseStock || []).some(
      (stock) => stock.warehouseId === filters.warehouseId && Number(stock.quantity || 0) > 0,
    );
  }
  return true;
};

const InventoryAnalysisSection = ({ analysis, isLoading, errorMessage, range, onRangeChange }) => {
  const [filters, setFilters] = useState({ category: '', warehouseId: '', status: '' });
  const filteredProducts = useMemo(
    () => (analysis?.products || []).filter((product) => productMatchesFilters(product, filters)),
    [analysis?.products, filters],
  );
  const lowStockProducts = useMemo(
    () =>
      filteredProducts
        .filter((product) => ['Out of Stock', 'Low Stock', 'Restock Soon'].includes(product.stockStatus))
        .sort((left, right) => Number(left.totalStock || 0) - Number(right.totalStock || 0) || Number(right.salesVelocity || 0) - Number(left.salesVelocity || 0))
        .slice(0, 8),
    [filteredProducts],
  );
  const highDemandProducts = useMemo(
    () =>
      filteredProducts
        .filter((product) => Number(product.salesVelocity || 0) > 0)
        .sort((left, right) => Number(right.salesVelocity || 0) - Number(left.salesVelocity || 0))
        .slice(0, 6),
    [filteredProducts],
  );

  const stockByCategory = useMemo(() => {
    const rows = filteredProducts.reduce((lookup, product) => {
      lookup.set(product.category, (lookup.get(product.category) || 0) + Number(product.totalStock || 0));
      return lookup;
    }, new Map());
    return Array.from(rows.entries()).map(([category, stock]) => ({ category, stock }));
  }, [filteredProducts]);

  const stockByWarehouse = useMemo(() => {
    const warehouseRows = new Map((analysis?.filters?.warehouses || []).map((warehouse) => [
      warehouse.warehouseId,
      { ...warehouse, stock: 0, lowStockItems: 0 },
    ]));

    filteredProducts.forEach((product) => {
      (product.warehouseStock || []).forEach((stock) => {
        const row = warehouseRows.get(stock.warehouseId);
        if (!row) return;
        row.stock += Number(stock.quantity || 0);
        if (Number(stock.quantity || 0) > 0 && Number(stock.quantity || 0) <= Number(stock.lowStockThreshold || product.lowStockThreshold || 3)) {
          row.lowStockItems += 1;
        }
      });
    });

    return Array.from(warehouseRows.values()).filter((row) => (filters.warehouseId ? row.warehouseId === filters.warehouseId : true));
  }, [analysis?.filters?.warehouses, filteredProducts, filters.warehouseId]);

  const lowStockChartRows = lowStockProducts.map((product) => ({
    name: product.title,
    stock: Number(product.totalStock || 0),
    velocity: Number(product.salesVelocity || 0),
  }));

  return (
    <section id="inventory-analysis" className="rounded-[32px] border border-line/80 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Stock health</p>
          <h2 className="mt-2 font-display text-4xl text-ink">Inventory Analysis</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-soft">
            Visual stock health, warehouse distribution, movement trends, and restock priorities for business decisions.
          </p>
        </div>
        <label className="min-w-[220px]">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Time range</span>
          <select
            value={range}
            onChange={(event) => onRangeChange(event.target.value)}
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

      {errorMessage ? (
        <div className="mb-5 rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : !analysis?.hasData ? (
        <EmptyState>No inventory data is available yet.</EmptyState>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Total Stock" value={formatNumber(analysis.summary?.totalStock)} helper="All product units" />
            <MetricCard label="Products" value={formatNumber(analysis.summary?.productCount)} helper="Catalog items" />
            <MetricCard label="Warehouses" value={formatNumber(analysis.summary?.warehouseCount)} helper="Stock locations" />
            <MetricCard label="Low Stock" value={formatNumber(analysis.summary?.lowStockCount)} helper="At threshold" />
            <MetricCard label="Out of Stock" value={formatNumber(analysis.summary?.outOfStockCount)} helper="Needs action" />
            <MetricCard label="Restock Soon" value={formatNumber(analysis.summary?.restockSoonCount)} helper="Velocity pressure" />
          </div>

          <div className="mb-5 grid gap-4 rounded-[24px] border border-line bg-[#fffaf8] p-4 md:grid-cols-3">
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Category</span>
              <select
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
              >
                <option value="">All categories</option>
                {(analysis.filters?.categories || []).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Warehouse</span>
              <select
                value={filters.warehouseId}
                onChange={(event) => setFilters((current) => ({ ...current, warehouseId: event.target.value }))}
                className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
              >
                <option value="">All warehouses</option>
                {(analysis.filters?.warehouses || []).map((warehouse) => (
                  <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                    {warehouse.cityLabel || warehouse.warehouseName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Stock status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                className="mt-2 min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-rose"
              >
                <option value="">All statuses</option>
                {(analysis.filters?.stockStatuses || []).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
                <option value="Moving Fast">Moving Fast</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartPanel
              title="Stock by Category"
              description="Current stock grouped by product category after filters."
              isEmpty={stockByCategory.length === 0}
              emptyMessage="No category stock matches these filters."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockByCategory} margin={{ top: 8, right: 18, bottom: 32, left: 0 }}>
                  <CartesianGrid stroke="#efe3dc" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="category" stroke="#a38373" tickLine={false} axisLine={false} angle={-18} textAnchor="end" height={58} tick={{ fontSize: 11 }} />
                  <YAxis stroke="#a38373" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="stock" name="Stock" fill="#54715f" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Stock by Warehouse"
              description="Available units by warehouse, with low-stock item count available in tooltips."
              isEmpty={stockByWarehouse.length === 0}
              emptyMessage="No warehouse stock matches these filters."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockByWarehouse} margin={{ top: 8, right: 18, bottom: 32, left: 0 }}>
                  <CartesianGrid stroke="#efe3dc" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="cityLabel" stroke="#a38373" tickLine={false} axisLine={false} angle={-18} textAnchor="end" height={58} tick={{ fontSize: 11 }} />
                  <YAxis stroke="#a38373" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="stock" name="Stock" fill="#8f5f45" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="lowStockItems" name="Low-stock items" fill="#d7a996" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Low Stock Products"
              description="Products nearest to stockout, compared with recent sales velocity."
              isEmpty={lowStockChartRows.length === 0}
              emptyMessage="No low-stock products match these filters."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lowStockChartRows} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 32 }}>
                  <CartesianGrid stroke="#efe3dc" strokeDasharray="4 4" horizontal={false} />
                  <XAxis type="number" stroke="#a38373" tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#a38373" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="stock" name="Current stock" fill="#b88746" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Inventory Movement Trends"
              description="Transfer quantities from inventory recommendations and net stock changes from stock logs."
              isEmpty={(analysis.charts?.movementTrends || []).length === 0}
              emptyMessage="No inventory movement data is available for this range."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.charts?.movementTrends || []} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#efe3dc" strokeDasharray="4 4" />
                  <XAxis dataKey="label" stroke="#a38373" tickLine={false} axisLine={false} />
                  <YAxis stroke="#a38373" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="transfers" name="Transfers" stroke="#8f5f45" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="netStockChange" name="Net stock change" stroke="#54715f" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <div className="mt-7">
            <h3 className="font-display text-3xl text-ink">Low-Stock Product Cards</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Restock priorities with images, warehouse distribution, reorder guidance, and recent sales velocity.
            </p>
            {lowStockProducts.length > 0 ? (
              <div className="mt-4 grid gap-5 xl:grid-cols-2">
                {lowStockProducts.map((product) => (
                  <InventoryProductCard key={product.productId} product={product} />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState>No low-stock products match the selected filters.</EmptyState>
              </div>
            )}
          </div>

          <div className="mt-7">
            <h3 className="font-display text-3xl text-ink">High-Demand Products</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Products moving fastest in the selected time range, useful for deciding what to reorder or feature.
            </p>
            {highDemandProducts.length > 0 ? (
              <div className="mt-4 grid gap-5 xl:grid-cols-2">
                {highDemandProducts.map((product) => (
                  <InventoryProductCard key={product.productId} product={product} />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState>No high-demand products match the selected filters yet.</EmptyState>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default InventoryAnalysisSection;
