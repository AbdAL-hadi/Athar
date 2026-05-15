import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatRate = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const severityClass = (severity = '') => {
  const normalized = String(severity).toLowerCase();

  if (normalized === 'critical') return 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]';
  if (normalized === 'high') return 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]';
  if (normalized === 'medium') return 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]';
  return 'border-line bg-white text-ink-soft';
};

const Badge = ({ children }) => (
  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${severityClass(children)}`}>
    {children}
  </span>
);

const CampaignTypeBadge = ({ type }) => {
  if (!type) return null;

  return (
    <span className="inline-flex rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
      {String(type).replace(/_/g, ' ')}
    </span>
  );
};

const campaignMetricLabels = {
  views: 'Views',
  addToCart: 'Cart adds',
  purchases: 'Purchases',
  tryOns: 'Try-ons',
  demandScore: 'Demand',
  conversionRate: 'Conversion',
  cartConversionRate: 'Cart conversion',
  stock: 'Stock',
  cityEvents: 'City events',
  cityPurchases: 'City purchases',
  cityViews: 'City views',
  cityAddToCart: 'City cart adds',
  averageCityEvents: 'Avg city events',
  cityCategoryDemandScore: 'City/category demand',
  globalCategoryDemandScore: 'Global category demand',
  cityCategoryShare: 'City/category share',
};

const formatCampaignMetric = (key, value) => {
  if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('share')) return formatRate(value);
  return formatNumber(value);
};

const CampaignMetrics = ({ metrics }) => {
  const entries = Object.entries(metrics || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.slice(0, 6).map(([key, value]) => (
        <span key={key} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-soft">
          {campaignMetricLabels[key] || key}: {formatCampaignMetric(key, value)}
        </span>
      ))}
    </div>
  );
};

const EmptyState = ({ children }) => (
  <div className="rounded-[22px] bg-[#fffaf8] px-5 py-6 text-sm leading-6 text-ink-soft">{children}</div>
);

const Panel = ({ title, description = '', children, actions = null }) => (
  <section className="rounded-[24px] border border-line bg-white p-5">
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h3 className="font-display text-3xl text-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-ink-soft">{description}</p> : null}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const TableShell = ({ children, maxHeight = '420px' }) => (
  <div className="overflow-auto rounded-[20px] border border-line" style={{ maxHeight }}>
    {children}
  </div>
);

const AiOutputMeta = ({ output }) => {
  if (!output) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
      {output.cached ? <span>Cached AI output</span> : null}
      {output.fallback ? <span>Fallback output</span> : null}
      {output.usedAI ? <span>Generated with AI</span> : <span>Template generated</span>}
    </div>
  );
};

export const useAdvancedAiInsightsData = (authToken, range) => {
  const [insights, setInsights] = useState({
    demandForecast: [],
    marketingOpportunities: [],
    productContentAudit: [],
    cityPersonalization: [],
    riskAlerts: [],
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [businessSummary, setBusinessSummary] = useState(null);
  const [campaignSuggestions, setCampaignSuggestions] = useState(null);
  const [aiError, setAiError] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingCampaigns, setGeneratingCampaigns] = useState(false);

  const loadRuleBasedInsights = useCallback(async () => {
    if (!authToken) return;

    setIsLoading(true);
    setErrors({});

    const endpoints = {
      demandForecast: `/api/admin/advanced-ai/demand-forecast?range=${encodeURIComponent(range)}`,
      marketingOpportunities: `/api/admin/advanced-ai/marketing-opportunities?range=${encodeURIComponent(range)}`,
      productContentAudit: `/api/admin/advanced-ai/product-content-audit?range=${encodeURIComponent(range)}`,
      cityPersonalization: `/api/admin/advanced-ai/city-personalization?range=${encodeURIComponent(range)}`,
      riskAlerts: `/api/admin/advanced-ai/risk-alerts?range=${encodeURIComponent(range)}`,
    };

    const results = await Promise.allSettled(
      Object.entries(endpoints).map(async ([key, endpoint]) => {
        const response = await apiRequest(endpoint, { token: authToken });
        return [key, response?.data || []];
      }),
    );

    const nextInsights = {
      demandForecast: [],
      marketingOpportunities: [],
      productContentAudit: [],
      cityPersonalization: [],
      riskAlerts: [],
    };
    const nextErrors = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [key, value] = result.value;
        nextInsights[key] = Array.isArray(value) ? value : [];
        return;
      }

      nextErrors.general = result.reason?.message || 'Some Advanced AI sections could not be calculated.';
    });

    setInsights(nextInsights);
    setErrors(nextErrors);
    setIsLoading(false);
  }, [authToken, range]);

  useEffect(() => {
    void loadRuleBasedInsights();
    setBusinessSummary(null);
    setCampaignSuggestions(null);
    setAiError('');
  }, [loadRuleBasedInsights]);

  const generateBusinessSummary = async (forceRegenerate = false) => {
    try {
      setGeneratingSummary(true);
      setAiError('');
      const response = await apiRequest('/api/admin/advanced-ai/business-summary', {
        method: 'POST',
        token: authToken,
        body: { range, forceRegenerate },
      });
      setBusinessSummary(response?.data || null);
    } catch (error) {
      setAiError(error.message || 'Business summary could not be generated.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const generateCampaignSuggestions = async (forceRegenerate = false) => {
    try {
      setGeneratingCampaigns(true);
      setAiError('');
      const response = await apiRequest('/api/admin/advanced-ai/campaign-suggestions', {
        method: 'POST',
        token: authToken,
        body: { range, forceRegenerate },
      });
      setCampaignSuggestions(response?.data || null);
    } catch (error) {
      setAiError(error.message || 'Campaign suggestions could not be generated.');
    } finally {
      setGeneratingCampaigns(false);
    }
  };

  return {
    insights,
    errors,
    isLoading,
    businessSummary,
    campaignSuggestions,
    aiError,
    generatingSummary,
    generatingCampaigns,
    generateBusinessSummary,
    generateCampaignSuggestions,
  };
};

export const DemandForecastPanel = ({ advancedAi }) => {
  const { t } = useTranslation();
  const { insights, isLoading } = advancedAi;

  return (
    <Panel title={t('admin.productDemand', 'Product Demand')} description="Near-term product demand by city, projected need, local stock, and shortage risk.">
      {isLoading ? (
        <EmptyState>Calculating forecast...</EmptyState>
      ) : insights.demandForecast.length > 0 ? (
        <TableShell maxHeight="460px">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Current Demand</th>
                <th className="px-4 py-3">Growth</th>
                <th className="px-4 py-3">Projected Need</th>
                <th className="px-4 py-3">City Stock</th>
                <th className="px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody>
              {insights.demandForecast.map((row) => (
                <tr key={`${row.productId}-${row.city}`} className="border-b border-line/60 text-ink">
                  <td className="px-4 py-4 font-semibold">{row.productTitle}</td>
                  <td className="px-4 py-4">{row.cityLabel}</td>
                  <td className="px-4 py-4">{formatNumber(row.currentScore)}</td>
                  <td className="px-4 py-4">{formatPercent(row.growthRate)}</td>
                  <td className="px-4 py-4">{formatNumber(row.estimatedUnitsNeeded)}</td>
                  <td className="px-4 py-4">{formatNumber(row.cityWarehouseStock)}</td>
                  <td className="px-4 py-4"><Badge>{row.shortageRisk}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ) : (
        <EmptyState>No demand forecast data yet. Collect more behavior events first.</EmptyState>
      )}
    </Panel>
  );
};

export const MarketingIntelligencePipeline = ({ advancedAi }) => {
  const { t } = useTranslation();
  const {
    insights,
    errors,
    isLoading,
    campaignSuggestions,
    aiError,
    generatingCampaigns,
    generateCampaignSuggestions,
  } = advancedAi;
  const opportunities = insights.marketingOpportunities || [];
  const campaigns = campaignSuggestions?.campaigns || [];

  return (
    <div className="space-y-5">
      {errors.general ? (
        <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546]">
          {errors.general}
        </div>
      ) : null}

      {aiError ? (
        <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546]">
          {aiError}
        </div>
      ) : null}

      <div className="grid gap-3 text-sm font-bold text-ink-soft md:grid-cols-3">
        {[t('admin.detectedOpportunities', 'Detected Opportunities'), t('admin.aiMarketingPlan', 'AI Marketing Plan'), 'Campaign Suggestions'].map((step, index) => (
          <div key={step} className="rounded-[18px] border border-line bg-[#fffaf8] px-4 py-3">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-white">{index + 1}</span>
            {step}
          </div>
        ))}
      </div>

      <Panel title={t('admin.detectedOpportunities', 'Detected Opportunities')} description="Rule-based opportunities from conversion, search gaps, city trends, stock position, and customer behavior.">
        {isLoading ? (
          <EmptyState>Detecting marketing opportunities...</EmptyState>
        ) : opportunities.length > 0 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {opportunities.slice(0, 6).map((item, index) => (
                <article key={`${item.type}-${index}`} className="rounded-[20px] border border-line bg-[#fffaf8] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-ink">{item.title}</h4>
                    <Badge>{item.severity}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{item.description}</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{item.suggestedAction}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">
                    {[item.relatedProduct?.title, item.cityLabel, item.category].filter(Boolean).join(' / ') || item.type}
                  </p>
                </article>
              ))}
            </div>

            {opportunities.length > 6 ? (
              <details className="mt-4 rounded-[20px] border border-line bg-white p-4">
                <summary className="cursor-pointer text-sm font-bold text-ink">View all detected opportunities</summary>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {opportunities.slice(6).map((item, index) => (
                    <article key={`${item.type}-extra-${index}`} className="rounded-[18px] bg-[#fffaf8] px-4 py-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-bold text-ink">{item.title}</h4>
                        <Badge>{item.severity}</Badge>
                      </div>
                      <p className="mt-2 leading-6 text-ink-soft">{item.description}</p>
                      <p className="mt-2 font-semibold text-ink">{item.suggestedAction}</p>
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <EmptyState>No marketing opportunities found for this range.</EmptyState>
        )}
      </Panel>

      <Panel
        title={t('admin.aiMarketingPlan', 'AI Marketing Plan')}
        description="Generated on demand from detected opportunities. It explains and prioritizes what to campaign on next."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => generateCampaignSuggestions(false)}
              disabled={generatingCampaigns || opportunities.length === 0}
              className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-rose disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingCampaigns ? 'Generating...' : 'Generate Marketing Plan'}
            </button>
            {campaignSuggestions ? (
              <button
                type="button"
                onClick={() => generateCampaignSuggestions(true)}
                disabled={generatingCampaigns || opportunities.length === 0}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-blush/60 disabled:opacity-60"
              >
                Regenerate
              </button>
            ) : null}
          </div>
        }
      >
        {campaignSuggestions ? (
          <div className="rounded-[20px] bg-[#fffaf8] px-5 py-4 text-sm leading-6 text-ink-soft">
            {campaigns.length > 0
              ? `AI converted ${formatNumber(opportunities.length)} detected opportunit${opportunities.length === 1 ? 'y' : 'ies'} into ${formatNumber(campaigns.length)} campaign suggestion${campaigns.length === 1 ? '' : 's'}.`
              : 'No campaign plan was produced for the selected range.'}
            <AiOutputMeta output={campaignSuggestions} />
          </div>
        ) : (
          <EmptyState>
            {opportunities.length > 0
              ? 'Click Generate Marketing Plan to turn detected opportunities into prioritized campaign suggestions.'
              : 'No detected opportunities are available for AI campaign planning yet.'}
          </EmptyState>
        )}
      </Panel>

      <Panel title="Campaign Suggestions" description="Campaign cards generated from the detected opportunity set, with fallback cards when AI is unavailable.">
        {campaigns.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <article key={`${campaign.title}-${campaign.cta}`} className="rounded-[20px] border border-line bg-[#fffaf8] px-4 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-bold text-ink">{campaign.title}</h4>
                  <div className="flex flex-wrap gap-2">
                    <CampaignTypeBadge type={campaign.campaignType} />
                    {campaign.severity ? <Badge>{campaign.severity}</Badge> : null}
                  </div>
                </div>
                {campaign.message ? <p className="mt-2 leading-6 text-ink-soft">{campaign.message}</p> : null}
                {campaign.target ? <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">Audience: {campaign.target}</p> : null}
                {campaign.cityLabel || campaign.city ? <p className="mt-2 text-ink-soft">City: {campaign.cityLabel || campaign.city}</p> : null}
                {campaign.featuredItems ? <p className="text-ink-soft">Featured: {campaign.featuredItems}</p> : null}
                {campaign.reason ? <p className="text-ink-soft">Reason: {campaign.reason}</p> : null}
                {campaign.cta ? <p className="font-semibold text-ink">CTA: {campaign.cta}</p> : null}
                {campaign.adCopy ? <p className="mt-2 rounded-[16px] bg-white px-3 py-3 text-ink-soft">{campaign.adCopy}</p> : null}
                {Array.isArray(campaign.actionSteps) && campaign.actionSteps.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">
                    {campaign.actionSteps.slice(0, 4).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                ) : null}
                <CampaignMetrics metrics={campaign.metrics} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Generate a marketing plan to see campaign suggestions.</EmptyState>
        )}
      </Panel>
    </div>
  );
};

export const AiInsightsWorkspace = ({ advancedAi }) => {
  const { t } = useTranslation();
  const {
    insights,
    errors,
    isLoading,
    businessSummary,
    aiError,
    generatingSummary,
    generateBusinessSummary,
  } = advancedAi;

  return (
    <div className="space-y-5">
      {errors.general ? (
        <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546]">
          {errors.general}
        </div>
      ) : null}
      {aiError ? (
        <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546]">
          {aiError}
        </div>
      ) : null}

      <Panel
        title="Business Summary"
        description="Generated only when you click the button. Cached AI and fallback states are shown when available."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => generateBusinessSummary(false)}
              disabled={generatingSummary}
              className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-rose disabled:opacity-60"
            >
              {generatingSummary ? 'Generating...' : 'Generate Business Summary'}
            </button>
            {businessSummary ? (
              <button
                type="button"
                onClick={() => generateBusinessSummary(true)}
                disabled={generatingSummary}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-blush/60 disabled:opacity-60"
              >
                Regenerate
              </button>
            ) : null}
          </div>
        }
      >
        {businessSummary ? (
          <div className="rounded-[20px] bg-[#fffaf8] px-5 py-4 text-sm leading-6 text-ink-soft">
            {businessSummary.summary}
            <AiOutputMeta output={businessSummary} />
          </div>
        ) : (
          <EmptyState>Click Generate Business Summary when you want an AI-written executive explanation.</EmptyState>
        )}
      </Panel>

      <details className="rounded-[24px] border border-line bg-white p-5">
        <summary className="cursor-pointer font-display text-3xl text-ink">{t('admin.advancedAiDetails', 'Advanced AI Details')}</summary>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Panel title={t('admin.productContentAudit', 'Product Content Audit')} description="Rule-based product content score. No product content is changed automatically.">
            {isLoading ? (
              <EmptyState>Calculating content audit...</EmptyState>
            ) : insights.productContentAudit.length > 0 ? (
              <TableShell maxHeight="420px">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-line bg-[#fffaf8] text-xs uppercase tracking-[0.16em] text-muted">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Missing</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.productContentAudit.slice(0, 40).map((row) => (
                      <tr key={row.productId} className="border-b border-line/60 align-top text-ink">
                        <td className="px-4 py-4 font-semibold">{row.productTitle}</td>
                        <td className="px-4 py-4"><Badge>{row.priority}</Badge> {formatNumber(row.contentScore)}</td>
                        <td className="px-4 py-4 text-ink-soft">{row.missingFields?.join(', ') || '-'}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {row.slug ? <Link className="font-semibold text-[#8f5f45] underline" to={`/products/${row.slug}`}>Open Product</Link> : null}
                            <Link className="font-semibold text-[#8f5f45] underline" to="/employee-dashboard">Edit Product</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <EmptyState>No products found for content audit.</EmptyState>
            )}
          </Panel>

        </div>
      </details>
    </div>
  );
};

const AdvancedAiInsightsSection = ({ authToken, range, id = 'advanced-ai', title = 'Advanced AI' }) => {
  const advancedAi = useAdvancedAiInsightsData(authToken, range);

  return (
    <section id={id} className="rounded-[30px] bg-white p-5 shadow-card sm:p-6">
      <div className="mb-6">
        <h2 className="font-display text-4xl text-ink">{title}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-soft">
          Optional AI summaries, marketing plans, demand forecasts, and secondary business explanations generated from analytics data.
        </p>
      </div>
      <div className="space-y-5">
        <MarketingIntelligencePipeline advancedAi={advancedAi} />
        <DemandForecastPanel advancedAi={advancedAi} />
        <AiInsightsWorkspace advancedAi={advancedAi} />
      </div>
    </section>
  );
};
export default AdvancedAiInsightsSection;

