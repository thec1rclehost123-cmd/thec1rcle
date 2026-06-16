'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function AnalyticsEmptyState({
  icon,
  title,
  description,
  pills,
  ctaHref,
  ctaLabel,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  pills: string[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center ${className}`.trim()}
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px dashed rgba(255,255,255,0.09)',
      }}
    >
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#fb923c' }}
      >
        {icon}
      </div>
      <h3 className="text-[16px] font-black tracking-tight text-white">{title}</h3>
      <p
        className="mt-2 max-w-md text-[13px] font-medium leading-6"
        style={{ color: 'var(--v-text-muted)' }}
      >
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {pills.map((pill) => (
          <span
            key={pill}
            className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--v-text-secondary)',
            }}
          >
            {pill}
          </span>
        ))}
      </div>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] transition-colors"
          style={{
            background: 'rgba(244,74,34,0.12)',
            color: '#fb923c',
            border: '1px solid rgba(244,74,34,0.22)',
          }}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
