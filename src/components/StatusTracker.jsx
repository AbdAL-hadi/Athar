const defaultSteps = [
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
];

const StatusTracker = ({ status = 'Pending', steps = defaultSteps, className = '' }) => {
  const normalizedStatus = status === 'Pending' ? 'Confirmed' : status;

  // Handle cancelled status
  if (normalizedStatus === 'Cancelled') {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step) => {
            const label = typeof step === 'string' ? step : step.label;

            return (
              <div key={label} className="flex flex-col items-center gap-3 text-center">
                <div className="h-6 w-6 rounded-full bg-red-500" />
                <p className="text-sm text-red-600 font-semibold">Cancelled</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => (typeof step === 'string' ? step : step.value) === normalizedStatus),
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const label = typeof step === 'string' ? step : step.label;
          const isActive = index <= currentIndex;

          return (
            <div key={label} className="flex flex-col items-center gap-3 text-center">
              <div className={`h-6 w-6 rounded-full ${isActive ? 'bg-green-500' : 'bg-line'}`} />
              <p className={`text-sm ${isActive ? 'font-semibold text-green-700' : 'text-ink'}`}>{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusTracker;
