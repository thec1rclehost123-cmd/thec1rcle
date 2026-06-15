'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import type { RevenueBreakdownItem } from '@/lib/finance/definitions';
import { formatINRCompact } from '@/lib/finance/definitions';

interface RevenueBreakdownProps {
  items: RevenueBreakdownItem[];
  loading?: boolean;
  grossRevenue: number;
  className?: string;
  layout?: 'grid' | 'list';
}

export function RevenueBreakdown({
  items,
  loading = false,
  grossRevenue,
  className,
  layout = 'grid',
}: RevenueBreakdownProps) {
  if (loading) {
    const skeletonClasses =
      layout === 'grid'
        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3'
        : 'flex flex-col gap-2';

    return (
      <div className={cn(skeletonClasses, className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="v-bento p-4 rounded-[var(--v-r-xl)] animate-pulse"
            style={{ background: 'var(--v-card)', minHeight: layout === 'grid' ? 120 : 60 }}
          >
            <div className="v-skeleton h-2 w-16 rounded mb-2" />
            <div className="v-skeleton h-6 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div
        className={cn('rounded-[var(--v-r-xl)] flex items-center justify-center py-8', className)}
        style={{ background: 'var(--v-card)', border: '1px dashed var(--v-border)' }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--v-text-muted)' }}
        >
          No breakdown data
        </p>
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {items.map((item) => (
          <BreakdownListItem key={item.category} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3', className)}>
      {items.map((item) => (
        <BreakdownTile key={item.category} item={item} />
      ))}
    </div>
  );
}

function BreakdownListItem({ item }: { item: RevenueBreakdownItem }) {
  const isOut = [
    'refund',
    'chargeback',
    'processor_fee',
    'platform_fee',
    'payout_initiated',
  ].includes(item.category);

  const content = (
    <div className="group flex items-center justify-between p-3.5 rounded-xl border border-[var(--v-border)] bg-[var(--v-card)] hover:brightness-110 transition-all">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)] truncate">
          {item.label}
        </span>
        <span
          className="text-lg font-black tracking-tighter"
          style={{ color: 'var(--v-text-primary)' }}
        >
          {formatINRCompact(item.amount)}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold" style={{ color: 'var(--v-text-secondary)' }}>
            {item.percentOfGross.toFixed(1)}%
          </span>
          {isOut ? (
            <ArrowDownLeft className="w-3 h-3" style={{ color: '#F87171' }} />
          ) : (
            <ArrowUpRight className="w-3 h-3" style={{ color: '#34D399' }} />
          )}
        </div>
        {item.trend.value !== '—' && (
          <span
            className={cn(
              'text-[9px] font-bold',
              item.trend.direction === 'up' ? 'text-emerald-500' : 'text-rose-500',
            )}
          >
            {item.trend.direction === 'up' ? '↑' : '↓'} {item.trend.value}
          </span>
        )}
      </div>
    </div>
  );

  if (item.ledgerHref)
    return (
      <Link href={item.ledgerHref} className="block">
        {content}
      </Link>
    );
  if (item.analyticsHref)
    return (
      <Link href={item.analyticsHref} className="block">
        {content}
      </Link>
    );
  return content;
}

function BreakdownTile({ item }: { item: RevenueBreakdownItem }) {
  const isPositive = item.trend.direction === 'up';
  const isNegative = item.trend.direction === 'down';
  const isOut = [
    'refund',
    'chargeback',
    'processor_fee',
    'platform_fee',
    'payout_initiated',
  ].includes(item.category);

  const tile = (
    <div
      className="group relative flex flex-col p-5 rounded-[var(--v-r-xl)] transition-all duration-200 hover:brightness-110 overflow-hidden"
      style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
    >
      {/* Subtle directional tint */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: isOut ? 'rgba(248,113,113,0.03)' : 'rgba(52,211,153,0.03)' }}
      />

      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--v-text-muted)' }}
        >
          {item.label}
        </span>
        {isOut ? (
          <ArrowDownLeft className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
        ) : (
          <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
        )}
      </div>

      {/* Amount */}
      <span
        className="text-[26px] font-bold leading-none tracking-tight tabular-nums"
        style={{ color: 'var(--v-text-primary)' }}
      >
        {formatINRCompact(item.amount)}
      </span>

      {/* Percent of gross */}
      <p className="text-[11px] mt-1" style={{ color: 'var(--v-text-muted)' }}>
        {item.percentOfGross.toFixed(1)}% of gross
      </p>

      {/* Trend chip */}
      {item.trend.value !== '—' && (
        <span
          className={cn(
            'v-trend-chip text-[10px] mt-2 w-fit',
            isPositive && 'v-trend-up',
            isNegative && 'v-trend-down',
            !isPositive && !isNegative && 'v-trend-neutral',
          )}
        >
          {isPositive && '↑ '}
          {isNegative && '↓ '}
          {item.trend.value} vs prev
        </span>
      )}

      {/* External link indicator */}
      {(item.analyticsHref || item.ledgerHref) && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity">
          <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--v-text-muted)' }} />
        </div>
      )}
    </div>
  );

  // If has an analytics/ledger href, wrap in Link
  if (item.analyticsHref) {
    return <Link href={item.analyticsHref}>{tile}</Link>;
  }
  if (item.ledgerHref) {
    return <Link href={item.ledgerHref}>{tile}</Link>;
  }
  return tile;
}

export default RevenueBreakdown;
