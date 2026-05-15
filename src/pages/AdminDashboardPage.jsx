import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle';
import { API_BASE_URL, apiRequest } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

const insightClasses = {
  critical: 'border-[#e0a3a3] bg-[#fff1f1] text-[#7e3030]',
  warning: 'border-[#ead7a0] bg-[#fff8e5] text-[#7a5a11]',
  success: 'border-[#b8d9b8] bg-[#effaf0] text-[#2b6d39]',
  info: 'border-line bg-white text-ink',
};

const alertClasses = {
  critical: 'border-[#e0a3a3] bg-[#fff1f1] text-[#7e3030]',
  warning: 'border-[#ead7a0] bg-[#fff8e5] text-[#7a5a11]',
  success: 'border-[#b8d9b8] bg-[#effaf0] text-[#2b6d39]',
  info: 'border-[#c8d8e7] bg-[#f4f9ff] text-[#315d83]',
};

const stockBadgeClasses = {
  OK: 'bg-[#eef7ef] text-[#2b6d39]',
  Low: 'bg-[#fff6df] text-[#9b7108]',
  Critical: 'bg-[#fff1f1] text-[#9b2f2f]',
  'Out of Stock': 'bg-[#ffe5e5] text-[#7e2020]',
};

const donutPalette = ['#e7c8c8', '#d7b494', '#d8d4a5', '#aebf9d', '#9bb6d3', '#d8b4d8'];

// Downloads the generated workbook through the protected backend route.
const downloadExportFile = async (token, fallbackMessage) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/dashboard/export`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch (_error) {
      // Keep the fallback message when the payload is not JSON.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = 'sales_data.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};

// Renders one KPI card with a compact trend summary.
const KpiCard = ({ item, t }) => {
  const deltaTone =
    item.delta?.direction === 'up'
      ? 'text-[#2b6d39]'
      : item.delta?.direction === 'down'
        ? 'text-[#9b2f2f]'
        : 'text-ink-soft';

  return (
    <div className="rounded-[28px] bg-white p-6 shadow-card">
      <p className="text-sm uppercase tracking-[0.16em] text-muted">{t(`admin.kpi.${item.id}`, item.label)}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="font-display text-5xl text-ink">
          {item.value}
          {item.suffix}
        </p>
        <div className={`text-sm font-semibold ${deltaTone}`}>{item.delta?.value || '0%'}</div>
      </div>
    </div>
  );
};

// Draws a lightweight bar chart without adding another charting dependency.
const SalesBarChart = ({ series, t }) => {
  const highestRevenue = Math.max(...series.map((point) => point.revenue), 1);

  return (
    <div className="space-y-4">
      <div className="flex h-56 items-end gap-3">
        {series.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-44 w-full items-end rounded-[20px] bg-[#f8efe9] px-2 py-2">
              <div
                className="w-full rounded-[18px] bg-gradient-to-t from-[#d7a996] to-[#e7c8c8] transition-all"
                style={{ height: `${Math.max((point.revenue / highestRevenue) * 100, 8)}%` }}
                title={`${point.label}: ${formatCurrency(point.revenue)}`}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-ink">{point.label}</p>
              <p className="text-[11px] text-ink-soft">{t('admin.ordersCount', '{{count}} orders', { count: point.orders })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Renders a simple SVG donut from the category revenue split.
const CategoryDonutChart = ({ items }) => {
  const total = items.reduce((sum, item) => sum + item.revenue, 0) || 1;
  let cumulativeRatio = 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <svg viewBox="0 0 42 42" className="mx-auto h-56 w-56 -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f3e7e2" strokeWidth="7" />
        {items.map((item, index) => {
          const ratio = item.revenue / total;
          const dashArray = `${(ratio * 100).toFixed(3)} ${(100 - ratio * 100).toFixed(3)}`;
          const dashOffset = `${(25 - cumulativeRatio * 100).toFixed(3)}`;
          cumulativeRatio += ratio;

          return (
            <circle
              key={item.category}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={donutPalette[index % donutPalette.length]}
              strokeWidth="7"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.category} className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: donutPalette[index % donutPalette.length] }} />
            <div className="flex items-center gap-3 text-sm text-ink">
              <span className="font-medium">{item.category}</span>
              <span className="text-ink-soft">{formatCurrency(item.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Shows the persisted stock state as a color-coded badge.
const StockBadge = ({ status, t }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stockBadgeClasses[status] || stockBadgeClasses.OK}`}>
    {t(`admin.stockStatus.${status}`, status)}
  </span>
);

// Displays one smart alert with severity styling.
const AlertCard = ({ alert }) => (
  <div className={`rounded-[22px] border px-4 py-4 ${alertClasses[alert.level] || alertClasses.info}`}>
    <p className="font-semibold">{alert.title}</p>
    <p className="mt-2 text-sm leading-7">{alert.message}</p>
  </div>
);

const AdminDashboardPage = ({ authToken, authUser, authLoading }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartWindow, setChartWindow] = useState(7);
  const [isDownloading, setIsDownloading] = useState(false);

  // Redirects unauthorized visitors away from the dashboard.
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authToken || authUser?.role !== 'admin') {
      navigate('/auth');
    }
  }, [authLoading, authToken, authUser?.role, navigate]);

  // Loads and periodically refreshes the admin dashboard snapshot.
  useEffect(() => {
    if (!authToken || authUser?.role !== 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await apiRequest('/api/admin/dashboard', { token: authToken });

        if (!isCancelled) {
          setDashboard(response?.data ?? null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || t('admin.loadDashboardError', 'Failed to load the admin dashboard.'));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 60000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authToken, authUser?.role]);

  // Chooses the currently active chart dataset from the fetched dashboard payload.
  const activeSeries = useMemo(() => {
    if (!dashboard?.charts) {
      return [];
    }

    return chartWindow === 7 ? dashboard.charts.sales7Days : dashboard.charts.sales30Days;
  }, [chartWindow, dashboard]);

  // Downloads the latest protected workbook for the export CTA.
  const handleDownload = async () => {
    if (!authToken) {
      return;
    }

    try {
      setIsDownloading(true);
      await downloadExportFile(authToken, t('admin.downloadSalesExportError', 'Failed to download the sales export.'));
    } catch (downloadError) {
      setError(downloadError.message || t('admin.downloadExportError', 'Failed to download the export file.'));
    } finally {
      setIsDownloading(false);
    }
  };

  if (authLoading) {
    return <div className="section-shell py-12 text-lg text-ink-soft">{t('admin.checkingDashboardAccess', 'Checking dashboard access...')}</div>;
  }

  if (!authUser || authUser.role !== 'admin') {
    return <div className="section-shell py-12 text-lg text-ink-soft">{t('admin.redirectingLogin', 'Redirecting to the login page...')}</div>;
  }

  return (
    <div className="section-shell space-y-8 pb-10 pt-8">
      <SectionTitle
        title={t('admin.adminDashboard', 'Admin Dashboard')}
        description={t('admin.dashboardDescription', 'Track sales, stock health, customer momentum, and export-ready reporting from one place.')}
      />

      {dashboard?.insight ? (
        <section className={`rounded-[32px] border px-6 py-6 shadow-card ${insightClasses[dashboard.insight.severity] || insightClasses.info}`}>
          <p className="text-sm uppercase tracking-[0.18em]">{t('admin.aiInsight', 'AI Insight')}</p>
          <h2 className="mt-3 font-display text-4xl">{dashboard.insight.title}</h2>
          <p className="mt-3 max-w-4xl text-base leading-8">{dashboard.insight.message}</p>
        </section>
      ) : null}

      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-4 rounded-[24px] border border-line bg-[#fffaf8] p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-3xl text-ink">{t('admin.productAiAssist', 'Product AI Assist')}</h2>
              <p className="mt-2 text-sm text-ink-soft">
                {t('admin.productAiAssistDescription', 'Open product management to improve descriptions, metadata, SEO, and website promo text.')}
              </p>
            </div>
            <Link to="/employee-dashboard" className="button-primary whitespace-nowrap">
              {t('admin.manageProducts', 'Manage products')}
            </Link>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-[24px] border border-line bg-white p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-3xl text-ink">{t('admin.commentModeration', 'Comment Moderation')}</h2>
              <p className="mt-2 text-sm text-ink-soft">
                {t('admin.commentModerationDescription', 'Review product comments flagged by local AI-assisted moderation before they appear publicly.')}
              </p>
            </div>
            <Link to="/admin/comments" className="button-primary whitespace-nowrap">
              {t('admin.openModeration', 'Open moderation')}
            </Link>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-[28px] bg-white px-6 py-10 text-lg text-ink-soft shadow-card">{t('admin.loadingLiveData', 'Loading live admin data...')}</div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-[#e7c8c8] bg-white px-6 py-5 text-[#8c6546] shadow-card">{error}</div>
      ) : null}

      {dashboard ? (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.kpis.map((item) => (
              <KpiCard key={item.id} item={item} t={t} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-[32px] bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-4xl text-ink">{t('admin.salesOverTime', 'Sales over time')}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{t('admin.salesOverTimeDescription', 'Revenue trend for the latest confirmed orders.')}</p>
                </div>

                <div className="inline-flex rounded-full bg-[#f4e7e2] p-1">
                  {[7, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setChartWindow(days)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        chartWindow === days ? 'bg-white text-ink shadow-card' : 'text-ink-soft'
                      }`}
                    >
                      {t('admin.lastDays', 'Last {{count}} days', { count: days })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <SalesBarChart series={activeSeries} t={t} />
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-6 shadow-card">
              <h3 className="font-display text-4xl text-ink">{t('admin.categoryBreakdown', 'Category breakdown')}</h3>
              <p className="mt-2 text-sm text-ink-soft">{t('admin.categoryBreakdownDescription', 'Revenue split by product category.')}</p>
              <div className="mt-6">
                <CategoryDonutChart items={dashboard.charts.categoryBreakdown} />
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-[32px] bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-4xl text-ink">{t('admin.topProducts', 'Top products')}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{t('admin.topProductsDescription', 'Sorted by revenue, with live stock state.')}</p>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="button-primary disabled:opacity-60"
                >
                  {isDownloading ? t('admin.preparingExport', 'Preparing export...') : t('admin.downloadExcel', 'Download Excel')}
                </button>
              </div>

              <p className="mt-3 text-sm text-ink-soft">
                {t('admin.lastUpdated', 'Last updated:')} {dashboard.export.lastUpdatedAt ? formatDate(dashboard.export.lastUpdatedAt) : t('admin.notGeneratedYet', 'Not generated yet')}
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="pb-3 pr-4">{t('common.product', 'Product')}</th>
                      <th className="pb-3 pr-4">{t('admin.unitsSold', 'Units sold')}</th>
                      <th className="pb-3 pr-4">{t('admin.revenue', 'Revenue')}</th>
                      <th className="pb-3 pr-4">{t('common.stock', 'Stock')}</th>
                      <th className="pb-3">{t('common.status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topProducts.map((product) => (
                      <tr key={product.productId} className="border-b border-line/60 align-top text-sm text-ink">
                        <td className="py-4 pr-4">
                          <p className="font-semibold">{product.productName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-soft">{product.category}</p>
                        </td>
                        <td className="py-4 pr-4">{product.unitsSold}</td>
                        <td className="py-4 pr-4">{formatCurrency(product.revenueGenerated)}</td>
                        <td className="py-4 pr-4">{product.currentStock}</td>
                        <td className="py-4">
                          <StockBadge status={product.inventoryStatus} t={t} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-6 shadow-card">
              <h3 className="font-display text-4xl text-ink">{t('admin.smartAlerts', 'Smart alerts')}</h3>
              <p className="mt-2 text-sm text-ink-soft">{t('admin.smartAlertsDescription', 'Operational signals sorted by urgency.')}</p>
              <div className="mt-6 space-y-4">
                {dashboard.alerts.length > 0 ? (
                  dashboard.alerts.map((alert, index) => <AlertCard key={`${alert.title}-${index}`} alert={alert} />)
                ) : (
                  <div className="rounded-[22px] border border-line bg-[#fcf8f6] px-4 py-4 text-sm text-ink-soft">
                    {t('admin.noAlerts', 'No alerts right now. Inventory and sales momentum look healthy.')}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default AdminDashboardPage;
