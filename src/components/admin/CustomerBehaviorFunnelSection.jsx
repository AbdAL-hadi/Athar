const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const EmptyState = ({ children }) => (
  <div className="rounded-[24px] border border-line/80 bg-[#fffaf8] px-5 py-7 text-sm leading-6 text-ink-soft">{children}</div>
);

const LoadingState = () => (
  <div className="grid gap-4 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => (
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

const FUNNEL_STEPS = [
  { key: 'productViews', eventType: 'product_view', label: 'Product Views', insightLabel: 'view products' },
  { key: 'favorites', eventType: 'favorite_add', label: 'Favorites', insightLabel: 'save favorites' },
  { key: 'addToCart', eventType: 'add_to_cart', label: 'Add to Cart', insightLabel: 'add-to-cart' },
  { key: 'orderCompleted', eventType: 'purchase', label: 'Order Completed', insightLabel: 'complete orders' },
];

const roundPercent = (value) => Math.round((Number(value) || 0) * 10) / 10;

const safeRate = (numerator, denominator) => {
  const safeDenominator = Number(denominator || 0);

  if (safeDenominator <= 0) {
    return 0;
  }

  return roundPercent((Number(numerator || 0) / safeDenominator) * 100);
};

const getStepCount = (rawSteps, targetStep) => {
  const matchingStep = rawSteps.find((step) => step?.key === targetStep.key || step?.eventType === targetStep.eventType);
  return Number(matchingStep?.count || 0);
};

const getInsightTitle = (fromStep, toStep) => {
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

const getSuggestedAction = (fromStep, toStep) => {
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

const getTransitionExplanation = (fromStep, toStep) => {
  if (fromStep.count <= 0) {
    return `No ${fromStep.label.toLowerCase()} signals were tracked in this range, so this transition cannot show meaningful drop-off yet.`;
  }

  return `${toStep.label} kept ${formatNumber(toStep.count)} of ${formatNumber(fromStep.count)} ${fromStep.insightLabel} signal${fromStep.count === 1 ? '' : 's'}.`;
};

const buildVisibleFunnel = (funnel) => {
  const rawSteps = Array.isArray(funnel?.steps) ? funnel.steps : [];
  const steps = FUNNEL_STEPS.map((step, index) => {
    const count = getStepCount(rawSteps, step);
    const previousCount = index > 0 ? getStepCount(rawSteps, FUNNEL_STEPS[index - 1]) : count;
    const percentageFromPrevious = index === 0 ? 100 : safeRate(count, previousCount);
    const dropOffCount = index === 0 ? 0 : Math.max(previousCount - count, 0);
    const dropOffRate = index === 0 ? 0 : safeRate(dropOffCount, previousCount);

    return {
      ...step,
      count,
      previousStepKey: index > 0 ? FUNNEL_STEPS[index - 1].key : null,
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
      title: getInsightTitle(previousStep, step),
      explanation: getTransitionExplanation(previousStep, step),
      suggestedAction: getSuggestedAction(previousStep, step),
    };
  });

  const insights = transitions
    .filter((transition) => transition.fromCount > 0)
    .sort((left, right) => right.dropOffRate - left.dropOffRate || right.dropOffCount - left.dropOffCount)
    .slice(0, 3);

  return { steps, transitions, insights, hasData: steps.some((step) => step.count > 0) };
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

const CustomerBehaviorFunnelSection = ({ funnel, isLoading, errorMessage, id = 'customer-behavior' }) => {
  const visibleFunnel = buildVisibleFunnel(funnel);
  const steps = visibleFunnel.steps;
  const transitions = visibleFunnel.transitions;
  const insights = visibleFunnel.insights;
  const maxCount = Math.max(...steps.map((step) => Number(step.count || 0)), 1);

  return (
    <section id={id} className="rounded-[30px] border border-line/80 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Customer journey</p>
          <h2 className="mt-2 font-display text-4xl text-ink">Customer Behavior Analysis</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-soft">
            Track where customers drop from product views to cart and purchase.
          </p>
        </div>
      </div>

      <ErrorState message={errorMessage} />

      {isLoading ? (
        <LoadingState />
      ) : !visibleFunnel.hasData ? (
        <EmptyState>No customer journey data is available for this time range yet.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
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
