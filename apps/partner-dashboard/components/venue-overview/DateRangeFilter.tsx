'use client';

import { cn } from '@/lib/utils';
import type { DateRange } from '@/lib/types/venueOverview';

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: '1d', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

/**
 * DateRangeFilter
 *
 * Segmented control for selecting the analytics time window.
 * Uses CSS variables from the venue design system so it adapts to light/dark.
 */
export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  return (
    <div
      className={cn('flex items-center gap-0.5 p-1 rounded-2xl', className)}
      style={{ background: 'var(--v-elevated)' }}
      role="group"
      aria-label="Date range filter"
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
              isActive ? 'shadow-sm' : 'hover:brightness-110 active:scale-95',
            )}
            style={
              isActive
                ? {
                    background: 'var(--v-orange)',
                    color: '#fff',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--v-text-tertiary)',
                  }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
