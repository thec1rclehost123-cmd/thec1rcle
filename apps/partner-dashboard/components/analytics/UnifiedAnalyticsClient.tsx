'use client';

import { useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import StudioShell, { type SectionDef } from '@/components/studio/StudioShell';
import { useQuery } from '@tanstack/react-query';
import { normalizeAnalyticsV2 } from '@/lib/analytics/zeroState';
import type { AnalyticsV2 } from '@/lib/analytics/types';

import {
  SummarySection,
  FunnelSection,
  RevenueSection,
  CrowdSection,
  DoorSection,
  CompareSection,
} from './sections';

/* ── Section definitions (drives nav strip) ─────────────────────────────── */

const SECTIONS: SectionDef[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'crowd', label: 'Crowd' },
  { id: 'door', label: 'Door' },
  { id: 'compare', label: 'Compare' },
];

/* ── Main ────────────────────────────────────────────────────────────────── */

export default function UnifiedAnalyticsClient({
  role,
  idParam,
}: {
  role: 'venue' | 'host' | 'promoter';
  idParam: string;
}) {
  const { profile, getIdToken } = useDashboardAuth() as any;
  const entityId = profile?.activeMembership?.partnerId;
  const [eventId, setEventId] = useState<string>('all');

  const {
    data: raw,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [role, 'analytics-v2', entityId, eventId],
    queryFn: async () => {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const url = `/api/${role}/analytics/overview?${idParam}=${entityId}&eventId=${eventId}`;
      const r = await fetch(url, { headers });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const normalizedPayload =
    raw && typeof raw === 'object' && 'analytics' in raw
      ? ((raw as { analytics?: Record<string, unknown> }).analytics ?? null)
      : raw;
  const data: AnalyticsV2 = normalizeAnalyticsV2(
    normalizedPayload as Record<string, unknown> | null | undefined,
  );

  return (
    <StudioShell
      role={role}
      title="Analytics"
      sections={SECTIONS}
      onEventChange={(id) => setEventId(id ?? 'all')}
      heroBackground="plain"
    >
      {/* Notices */}
      {!isLoading && !data.hasData && (
        <div
          className="flex items-center gap-4 px-6 py-4 rounded-2xl mb-8"
          style={{
            background: 'rgba(129,140,248,0.06)',
            border: '1px solid rgba(129,140,248,0.15)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(129,140,248,0.15)' }}
          >
            <Info className="w-4.5 h-4.5" style={{ color: '#818CF8' }} />
          </div>
          <div>
            <p className="text-[14px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
              No analytics recorded yet
            </p>
            <p
              className="text-[12px] font-medium mt-0.5"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Metrics will populate after your first event goes live.
            </p>
          </div>
        </div>
      )}
      {isError && (
        <div
          className="flex items-center gap-4 px-6 py-4 rounded-2xl mb-8"
          style={{
            background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.15)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(248,113,113,0.15)' }}
          >
            <RefreshCw className="w-4.5 h-4.5" style={{ color: '#F87171' }} />
          </div>
          <p className="text-[14px] font-semibold" style={{ color: '#F87171' }}>
            Could not load analytics. Showing last-known values.
          </p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-16">
        <div id="summary" className="scroll-mt-20">
          <SummarySection data={data} loading={isLoading} />
        </div>
        <div id="funnel" className="scroll-mt-20">
          <FunnelSection data={data} loading={isLoading} />
        </div>
        <div id="revenue" className="scroll-mt-20">
          <RevenueSection data={data} loading={isLoading} />
        </div>
        <div id="crowd" className="scroll-mt-20">
          <CrowdSection data={data} loading={isLoading} />
        </div>
        <div id="door" className="scroll-mt-20">
          <DoorSection data={data} loading={isLoading} />
        </div>
        <div id="compare" className="scroll-mt-20">
          <CompareSection data={data} loading={isLoading} />
        </div>
      </div>
    </StudioShell>
  );
}
