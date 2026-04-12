import { useEffect } from 'react';

const Toast = ({
  open = false,
  variant = 'success',
  title = '',
  message = '',
  onClose,
  action = null,
  autoHideDuration = 3000,
  fixed = true,
  className = '',
}) => {
  useEffect(() => {
    if (!open || !onClose) {
      return undefined;
    }

    const timeoutId = window.setTimeout(onClose, autoHideDuration);
    return () => window.clearTimeout(timeoutId);
  }, [autoHideDuration, onClose, open]);

  if (!open) {
    return null;
  }

  const variantClass = variant === 'error' ? 'border-[#e9c3c3] bg-[#fff8f6]' : 'border-line bg-white';

  return (
    <div className={`${fixed ? 'fixed bottom-5 right-5 z-50' : ''} ${className}`}>
      <div className={`min-w-[280px] rounded-[24px] border px-5 py-4 shadow-card ${variantClass}`}>
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <p className="mt-1 text-sm text-ink-soft">{message}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
};

export default Toast;
