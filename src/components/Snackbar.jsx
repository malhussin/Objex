'use client';

import Icon from './Icon';

/**
 * Bottom-left toast stack, like the GCP console's upload/notification
 * snackbars. A toast with a numeric `progress` renders a determinate bar.
 */
export default function SnackbarStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-6 z-50 flex w-[min(420px,calc(100vw-3rem))] flex-col gap-2"
      role="region"
      aria-label="Status notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="gcp-snackbar pointer-events-auto overflow-hidden rounded bg-[#202124] text-white shadow-gcp-2"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {toast.variant === 'error' && (
              <Icon name="error_outline" size={20} className="shrink-0 text-[#f28b82]" />
            )}
            {toast.variant === 'success' && (
              <Icon name="check_circle" size={20} className="shrink-0 text-[#81c995]" />
            )}
            <p className="min-w-0 flex-1 text-gcp-md leading-5">{toast.message}</p>

            {typeof toast.progress === 'number' && (
              <span className="shrink-0 font-mono text-gcp-sm text-white/80">
                {Math.round(toast.progress)}%
              </span>
            )}

            {toast.actionLabel && (
              <button
                type="button"
                onClick={toast.onAction}
                className="shrink-0 rounded px-2 py-1 text-gcp-md font-medium uppercase tracking-wide text-[#8ab4f8] hover:bg-white/10"
              >
                {toast.actionLabel}
              </button>
            )}

            {toast.dismissible !== false && (
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>

          {typeof toast.progress === 'number' && (
            <div className="relative h-[3px] w-full bg-white/20">
              <div
                className="absolute inset-y-0 left-0 bg-[#8ab4f8] transition-[width] duration-150"
                style={{ width: `${Math.min(100, Math.max(0, toast.progress))}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
