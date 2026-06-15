import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorState Component — When something goes wrong
 *
 * Consistent error UI across all partner-dashboard pages.
 */

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6 gap-4',
        className,
      )}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center"
        style={{
          background: 'var(--v-error-bg, rgba(248,113,113,0.08))',
          border: '1px solid rgba(248,113,113,0.2)',
        }}
      >
        <AlertTriangle className="h-6 w-6" style={{ color: 'var(--v-error, #F87171)' }} />
      </div>

      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary, #FAFAFA)' }}>
          {title}
        </h3>
        <p className="text-[13px] max-w-xs" style={{ color: 'var(--text-tertiary, #A1A1AA)' }}>
          {message}
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{
            background: 'var(--surface-tertiary, #18181B)',
            border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            color: 'var(--text-primary, #FAFAFA)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
