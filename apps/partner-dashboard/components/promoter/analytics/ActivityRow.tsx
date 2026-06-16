'use client';

import { Link2, PauseCircle, ShoppingBag } from 'lucide-react';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = date.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(days, 'day');
}

export function ActivityRow({ activity }: { activity: any }) {
  const config = (() => {
    if (activity.type === 'sale') {
      return {
        icon: <ShoppingBag className="w-4 h-4" />,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.28)',
      };
    }
    if (activity.type === 'link_deactivated') {
      return {
        icon: <PauseCircle className="w-4 h-4" />,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.28)',
      };
    }
    return {
      icon: <Link2 className="w-4 h-4" />,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.28)',
    };
  })();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderRadius: 18,
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Status icon circle */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: config.bg,
          border: `2px solid ${config.border}`,
          color: config.color,
        }}
      >
        {config.icon}
      </div>

      {/* Title + detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.88)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activity.title}
        </p>
        <p
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.36)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activity.eventName || 'Event'}
          {activity.linkCode ? ` · ${activity.linkCode}` : ''}
        </p>
      </div>

      {/* Right: amount or time */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {activity.type === 'sale' ? (
          <>
            <p
              className="tabular-nums"
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: config.color,
                letterSpacing: '-0.01em',
              }}
            >
              {formatINR(activity.commission || 0)}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              on {formatINR(activity.amount || 0)}
            </p>
          </>
        ) : (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              background: config.bg,
              color: config.color,
              border: `1px solid ${config.border}`,
              borderRadius: 100,
              padding: '2px 7px',
              display: 'inline-block',
            }}
          >
            {formatRelativeTime(activity.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
