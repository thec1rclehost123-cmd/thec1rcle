'use client';

import { ReactNode } from 'react';

export function KPICard({
  icon,
  label,
  value,
  color,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '1.1rem' }}>
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at 60% -10%, ${color}38 0%, transparent 65%)`,
        }}
      />
      {/* Glass surface */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(14,14,16,0.94)',
          border: `1px solid ${color}38`,
          borderRadius: '1.1rem',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${color}18`,
              color,
            }}
          >
            {icon}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: `${color}cc`,
            }}
          >
            {label}
          </span>
        </div>
        {loading ? (
          <div
            className="h-8 w-24 rounded-lg animate-pulse"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />
        ) : (
          <span
            className="tabular-nums"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
