'use client';

import { forwardRef } from 'react';

type Padding = 'compact' | 'standard' | 'spacious' | 'hero' | 'none';

interface DashCardProps {
  children: React.ReactNode;
  padding?: Padding;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const paddingClasses: Record<Padding, string> = {
  none: '',
  compact: 'p-4',
  standard: 'p-5',
  spacious: 'p-6',
  hero: 'p-8',
};

export const DashCard = forwardRef<HTMLDivElement, DashCardProps>(
  (
    { children, padding = 'standard', interactive = false, className = '', onClick, style },
    ref,
  ) => {
    const base =
      'rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition-all duration-[var(--t-base)]';

    const interactiveClasses = interactive
      ? 'hover:shadow-[var(--shadow-md)] hover:border-[var(--border-default)] cursor-pointer active:scale-[0.998]'
      : '';

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`${base} ${paddingClasses[padding]} ${interactiveClasses} ${className}`}
        style={style}
      >
        {children}
      </div>
    );
  },
);

DashCard.displayName = 'DashCard';
