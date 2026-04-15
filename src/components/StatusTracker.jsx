const defaultSteps = [
  { label: 'Ordered', value: 'Pending' },
  { label: 'Being Processed', value: 'Confirmed' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
];

const StatusTracker = ({ status = 'Pending', steps = defaultSteps, className = '' }) => {
  // Handle cancelled status
  if (status === 'Cancelled') {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-4 gap-3">
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
    steps.findIndex((step) => (typeof step === 'string' ? step : step.value) === status),
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-4 gap-3">
        {steps.map((step, index) => {
          const label = typeof step === 'string' ? step : step.label;
          const isActive = index <= currentIndex;
          const isOrdered = label === 'Ordered';
          const isBeingProcessed = label === 'Being Processed';
          const isShipped = label === 'Shipped';

          return (
            <div key={label} className="flex flex-col items-center gap-3 text-center">
              <div className={`h-6 w-6 rounded-full ${isActive ? (isOrdered || isBeingProcessed || isShipped ? 'bg-green-500' : 'bg-blush') : 'bg-line'}`} />
              <p className="text-sm text-ink">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusTracker;
