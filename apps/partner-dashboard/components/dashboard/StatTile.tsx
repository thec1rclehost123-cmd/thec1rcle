'use client';

import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'neutral';

interface StatTileProps {
  label: string;
  value: string | number;
  trend?: {
    value: string | number;
    direction: TrendDirection;
    isPositive?: boolean;
  };
  icon?: ReactNode;
  sparkData?: number[];
  color?: string; // Brand color for icon/sparkline
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'elevated' | 'accent' | 'compact';
  subtitle?: string;
  liveIndicator?: boolean;
}

// ── Mini Sparkline Implementation ──
function MiniSparkline({
  data,
  color,
  height = 32,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px] transition-all duration-300"
          style={{
            height: `${Math.max((val / maxVal) * 100, 10)}%`,
            background: i === data.length - 1 ? color : `${color}33`,
          }}
        />
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  trend,
  icon,
  sparkData,
  color = 'var(--v-orange, #F44A22)',
  interactive = false,
  onClick,
  className,
  variant = 'default',
  subtitle,
  liveIndicator = false,
}: StatTileProps) {
  const isTrendPositive = trend?.isPositive ?? trend?.direction === 'up';

  const variantClasses = {
    default:
      'bg-[var(--v-panel-bg)] border-[var(--v-panel-border)] shadow-[var(--v-panel-shadow-card)]',
    elevated:
      'bg-[var(--v-panel-bg)] border-[var(--v-panel-border-strong)] shadow-[var(--v-panel-shadow-card)]',
    accent: 'bg-[var(--v-orange-dim)] border-[var(--v-orange-glow)]',
    compact: 'bg-[var(--v-panel-bg)] border-[var(--v-panel-border)]',
  };

  const Wrapper = interactive ? motion.div : 'div';

  return (
    <Wrapper
      className={cn(
        'rounded-[var(--v-r-xl)] border p-5 flex flex-col gap-3 relative overflow-hidden transition-all duration-200',
        variantClasses[variant],
        variant === 'compact' && 'p-3 py-3 gap-1',
        interactive &&
          'hover:bg-[var(--v-panel-hover)] hover:shadow-[var(--v-shadow-hover)] cursor-pointer active:scale-[0.98]',
        className,
      )}
      onClick={onClick}
      {...(interactive
        ? {
            whileHover: { y: -2 },
            transition: { duration: 0.2 },
          }
        : {})}
    >
      {/* Header: Icon & Trend */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}15`, color }}
            >
              {icon}
            </div>
          )}
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--v-text-tertiary)] flex items-center gap-2">
            {label}
            {liveIndicator && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--v-orange)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--v-orange)]"></span>
              </span>
            )}
          </span>
        </div>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
              trend.direction === 'neutral'
                ? 'bg-[var(--v-divider)] text-[var(--v-text-tertiary)]'
                : isTrendPositive
                  ? 'bg-[var(--v-up-bg)] text-[var(--v-up)]'
                  : 'bg-[var(--v-down-bg)] text-[var(--v-down)]',
            )}
          >
            {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend.direction === 'neutral' && <Minus className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative z-10 flex flex-col gap-2">
        <h4
          className={cn(
            'text-[30px] font-black tracking-tight leading-none text-[var(--v-text-primary)] tabular-nums',
            variant === 'compact' && 'text-[1.5rem]',
          )}
        >
          {value}
        </h4>

        {sparkData && (
          <div className="pt-1.5 grayscale-[0.5] hover:grayscale-0 transition-all duration-300">
            <MiniSparkline data={sparkData} color={color} />
          </div>
        )}

        {subtitle && (
          <p className="text-[11px] font-medium text-[var(--v-text-tertiary)] mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>

      {/* Subtle glow for interactive/accent tiles */}
      {(variant === 'accent' || (interactive && isTrendPositive)) && (
        <div
          className="absolute -top-4 -right-4 w-24 h-24 rounded-full blur-[40px] pointer-events-none opacity-20"
          style={{ background: color }}
        />
      )}
    </Wrapper>
  );
}

export default StatTile;
