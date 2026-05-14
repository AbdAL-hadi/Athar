const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const EmptyState = ({ children }) => (
  <div className="rounded-[24px] border border-line/80 bg-[#fffaf8] px-5 py-7 text-sm leading-6 text-ink-soft">{children}</div>
);

const LoadingState = () => (
  <div className="grid gap-4 lg:grid-cols-5">
    {Array.from({ length: 5 }, (_, index) => (
      <div key={index} className="animate-pulse rounded-[24px] border border-line/70 bg-white px-4 py-5 shadow-card">
        <div className="h-3 w-24 rounded-full bg-[#eaded6]" />
        <div className="mt-5 h-9 w-20 rounded-full bg-[#f2e8e2]" />
        <div className="mt-4 h-2 w-full rounded-full bg-[#f2e8e2]" />
        <div className="mt-4 h-3 w-32 rounded-full bg-[#eaded6]" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ message }) =>
  message ? (
    <div className="mb-5 rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
      {message}
    </div>
  ) : null;

const getDropOffTone = (dropOffRate) => {
  const rate = Number(dropOffRate || 0);

  if (rate >= 75) return 'border-[#e6b8b0] bg-[#fff4f1] text-[#9b3f31]';
  if (rate >= 45) return 'border-[#ead3a6] bg-[#fff8e9] text-[#8a6317]';
  return 'border-[#c8d9c7] bg-[#f1faf0] text-[#426b42]';
};

const FunnelStepCard = ({ step, maxCount, index }) => {
  const width = Math.max((Number(step.count || 0) / Math.max(Number(maxCount || 0), 1)) * 100, step.count > 0 ? 8 : 0);

  return (
    <article className="rounded-[24px] border border-line/80 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step {index + 1}</p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-ink">{step.label}</h3>
        </div>
        {!step.tracked ? (
          <span className="rounded-full border border-line bg-[#fffaf8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            TODO
          </span>
        ) : null}
      </div>

      <p className="mt-4 font-display text-4xl text-ink">{formatNumber(step.count)}</p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f0e3dc]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8f5f45] via-[#b88746] to-[#54715f]"
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-soft">From previous</span>
          <span className="font-bold text-ink">{index === 0 ? 'Entry' : formatPercent(step.percentageFromPrevious)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-soft">Drop-off</span>
          <span className="font-bold text-ink">{index === 0 ? '-' : formatPercent(step.dropOffRate)}</span>
        </div>
      </div>

      {step.note ? <p className="mt-3 text-xs leading-5 text-ink-soft">{step.note}</p> : null}
    </article>
  );
};

const TransitionRow = ({ transition }) => (
  <div className="rounded-[20px] border border-line/80 bg-[#fffaf8] px-4 py-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold text-ink">
        {transition.fromLabel} to {transition.toLabel}
      </p>
      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${getDropOffTone(transition.dropOffRate)}`}>
        {formatPercent(transition.dropOffRate)} drop-off
      </span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0e3dc]">
      <div
        className="h-full rounded-full bg-[#54715f]"
        style={{ width: `${Math.min(Number(transition.retainedRate || 0), 100)}%` }}
      />
    </div>
    <p className="mt-2 text-xs text-ink-soft">
      {formatNumber(transition.toCount)} continued from {formatNumber(transition.fromCount)} signals.
    </p>
  </div>
);

const InsightCard = ({ insight }) => (
  <article className="rounded-[24px] border border-line/80 bg-white p-5 shadow-card">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <h3 className="font-display text-2xl leading-tight text-ink">{insight.title}</h3>
      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${getDropOffTone(insight.dropOffRate)}`}>
        {formatPercent(insight.dropOffRate)}
      </span>
    </div>
    <p className="mt-3 text-sm leading-6 text-ink-soft">{insight.explanation}</p>
    <p className="mt-4 rounded-[18px] bg-[#fffaf8] px-4 py-3 text-sm font-semibold leading-6 text-ink">
      {insight.suggestedAction}
    </p>
  </article>
);

const CustomerBehaviorFunnelSection = ({ funnel, isLoading, errorMessage }) => {
  const steps = Array.isArray(funnel?.steps) ? funnel.steps : [];
  const transitions = Array.isArray(funnel?.transitions) ? funnel.transitions : [];
  const insights = Array.isArray(funnel?.insights) ? funnel.insights : [];
  const maxCount = Math.max(...steps.map((step) => Number(step.count || 0)), 1);

  return (
    <section id="customer-behavior" className="rounded-[30px] border border-line/80 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Customer journey</p>
          <h2 className="mt-2 font-display text-4xl text-ink">Customer Behavior Analysis</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-soft">
            A tracked funnel from product discovery to completed orders, with retention and drop-off at every step.
          </p>
        </div>
      </div>

      <ErrorState message={errorMessage} />

      {isLoading ? (
        <LoadingState />
      ) : !funnel?.hasData ? (
        <EmptyState>No customer journey data is available for this time range yet.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            {steps.map((step, index) => (
              <FunnelStepCard key={step.key || step.eventType} step={step} maxCount={maxCount} index={index} />
            ))}
          </div>

          {transitions.length > 0 ? (
            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {transitions.map((transition) => (
                <TransitionRow key={transition.key} transition={transition} />
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className="font-display text-3xl text-ink">Biggest Drop-Off Points</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              These cards prioritize the largest percentage losses in the selected range.
            </p>
            {insights.length > 0 ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {insights.map((insight) => (
                  <InsightCard key={insight.key} insight={insight} />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState>No major drop-off point is visible yet. Keep collecting behavior events for clearer journey analysis.</EmptyState>
              </div>
            )}
          </div>

          {funnel.calculationNote ? (
            <p className="mt-5 rounded-[20px] bg-[#fffaf8] px-4 py-3 text-xs leading-5 text-ink-soft">
              {funnel.calculationNote}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};

export default CustomerBehaviorFunnelSection;
