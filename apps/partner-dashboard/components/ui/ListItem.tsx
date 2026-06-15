'use client';

import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

/**
 * ListItem Component — Interactive List Rows
 *
 * For actions, recent items, quick navigation.
 */

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  badge?: ReactNode;
  rightContent?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconBg = 'bg-surface-secondary',
  badge,
  rightContent,
  href,
  onClick,
  className,
}: ListItemProps) {
  const content = (
    <>
      {icon && (
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            iconBg,
          )}
        >
          {icon}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-medium text-text-primary truncate">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="text-[12px] text-text-tertiary truncate">{subtitle}</p>}
      </div>

      {rightContent ? (
        rightContent
      ) : (
        <ArrowUpRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
      )}
    </>
  );

  const baseStyles = cn(
    'flex items-center gap-3 p-3 -mx-3 rounded-lg transition-colors',
    'hover:bg-surface-tertiary',
    href || onClick ? 'cursor-pointer' : '',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={baseStyles}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={cn(baseStyles, 'w-full text-left')}>
        {content}
      </button>
    );
  }

  return <div className={cn(baseStyles, 'cursor-default')}>{content}</div>;
}

export default ListItem;
