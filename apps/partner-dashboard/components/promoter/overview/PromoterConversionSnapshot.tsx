'use client';

import { Activity } from 'lucide-react';

export function PromoterConversionSnapshot({ snapshot }: { snapshot?: any }) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 flex flex-col h-[280px]">
      <h3 className="font-semibold text-text-primary text-sm tracking-wide mb-4">
        CONVERSION RATE
      </h3>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="h-12 w-12 rounded-full bg-surface-tertiary flex items-center justify-center mb-3">
          <Activity className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="text-4xl font-black tabular-nums tracking-tighter text-text-primary">
          {snapshot?.rate || '0.0%'}
        </div>
        <p className="text-sm text-text-tertiary mt-2">
          {snapshot?.clicks || 0} clicks ➔ {snapshot?.purchases || 0} buys
        </p>
      </div>
    </div>
  );
}
