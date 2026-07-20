'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useCallback, type ChangeEvent, type MouseEvent, type ReactNode, type ComponentType } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Ban,
  UserX,
  Activity,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Globe,
  User,
  Crown,
  Clock,
  Zap,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

interface SecurityCounts {
  blockedIps?: number;
  blockedUsers?: number;
  flaggedUsers?: number;
  suspendedAdmins?: number;
}

interface SecurityMetrics {
  openIncidentCount?: number;
  blockRate?: number;
  eventsByType?: Record<string, number>;
}

interface RiskyEntity {
  id: string;
  tier: string;
  score: number;
}

interface TargetedEndpoint {
  endpoint?: string;
  count: number | string;
}

interface TrendsData {
  mostTargetedEndpoints?: TargetedEndpoint[];
  trends?: Record<string, Record<string, number | string>>;
}

interface ReputationData {
  topRiskyIps?: RiskyEntity[];
  topRiskyUsers?: RiskyEntity[];
  topRiskyAdmins?: RiskyEntity[];
}

interface SecurityIncident {
  id: string;
  entityType: string;
  severity: string;
  status: string;
  reason: string;
  entityId: string;
  createdAt?: string;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity?: string;
  mitigated?: boolean;
  ip?: string;
  uid?: string;
  endpoint?: string;
  mitigationAction?: string;
  createdAt?: string;
}

interface SecurityOverviewResponse {
  ok: boolean;
  counts?: SecurityCounts;
  metrics?: SecurityMetrics;
  reputation?: ReputationData;
  trends?: TrendsData;
  openIncidents?: SecurityIncident[];
  recentEvents?: SecurityEvent[];
}

interface IncidentsApiResponse {
  ok: boolean;
  incidents?: SecurityIncident[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/20 text-red-400',
  high: 'bg-iris/10 border-iris/20 text-iris',
  medium: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  low: 'bg-zinc-800 border-zinc-700 text-zinc-400',
};

const STATUS_STYLES: Record<string, string> = {
  flagged: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  under_review: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  false_positive: 'bg-zinc-800 text-zinc-500 border-zinc-700',
};

const RISK_TIER_STYLES: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-iris',
  elevated: 'text-amber-400',
  normal: 'text-zinc-500',
};

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest ${style}`}
    >
      {label}
    </span>
  );
}

function KPICard({ icon: Icon, label, value, sub, accent = 'zinc' }: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string; value: string | number | null | undefined; sub?: string; accent?: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    iris: 'bg-iris/10 border-iris/20 text-iris',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    zinc: 'bg-zinc-800 border-zinc-700 text-zinc-400',
  };
  return (
    <div className="p-6 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-5 overflow-hidden relative group hover:border-white/10 transition-all">
      <div
        className={`h-11 w-11 rounded-lg flex items-center justify-center border flex-shrink-0 ${colors[accent]}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-light text-white tracking-tighter tabular-nums">
          {value ?? '—'}
        </p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-3 px-1">
      {children}
    </h3>
  );
}

const TABS = ['Overview', 'Incidents', 'Trends', 'Events'];

export default function SecurityPage() {
  const { user } = useAuth() as { user: any };
  const [data, setData] = useState<SecurityOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('Overview');
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/security/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json() as SecurityOverviewResponse;
        if (json.ok) setData(json);
      } catch (_) {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading) return <PageSkeleton sections={['header', 'kpi', 'chart', 'table']} />;

  return (
    <div className="space-y-10 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-iris" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">
              Security Operations
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Security Center</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Real-time threat monitoring, incident management, and attack trend analysis.
          </p>
        </div>
        <button
          onClick={() => fetchOverview(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all text-[11px] font-bold uppercase tracking-widest"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-1">
            <KPICard
              icon={Ban}
              label="Blocked IPs"
              value={data?.counts?.blockedIps ?? 0}
              accent="red"
            />
            <KPICard
              icon={UserX}
              label="Blocked Users"
              value={data?.counts?.blockedUsers ?? 0}
              accent="iris"
            />
            <KPICard
              icon={AlertCircle}
              label="Flagged Users"
              value={data?.counts?.flaggedUsers ?? 0}
              accent="amber"
            />
            <KPICard
              icon={Crown}
              label="Suspended Admins"
              value={data?.counts?.suspendedAdmins ?? 0}
              accent="red"
            />
            <KPICard
              icon={ShieldAlert}
              label="Open Incidents"
              value={data?.metrics?.openIncidentCount ?? 0}
              accent="amber"
            />
            <KPICard
              icon={ShieldCheck}
              label="Block Rate"
              value={`${data?.metrics?.blockRate ?? 0}%`}
              sub="of recent events"
              accent="emerald"
            />
          </div>

          <div className="flex gap-1 p-1 bg-obsidian-surface border border-[#ffffff08] rounded-xl w-fit">
            {TABS.map((t: string) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  tab === t ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Overview' && <OverviewTab data={data} />}
          {tab === 'Incidents' && (
            <IncidentsTab data={data} user={user} onUpdate={() => fetchOverview(true)} />
          )}
          {tab === 'Trends' && <TrendsTab data={data} />}
          {tab === 'Events' && <EventsTab data={data} />}
    </div>
  );
}

function OverviewTab({ data }: { data: SecurityOverviewResponse | null }) {
  const rep = data?.reputation || {};
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-1">
      <div className="xl:col-span-2 space-y-6">
        <RiskyEntityTable title="Top Risky IPs" icon={Globe} entities={rep.topRiskyIps || []} />
        <RiskyEntityTable title="Top Risky Users" icon={User} entities={rep.topRiskyUsers || []} />
      </div>
      <div className="space-y-6">
        <RiskyEntityTable
          title="At-Risk Admins"
          icon={Crown}
          entities={rep.topRiskyAdmins || []}
          compact
        />
        <MostTargetedEndpoints endpoints={data?.trends?.mostTargetedEndpoints || []} />
      </div>
    </div>
  );
}

function RiskyEntityTable({ title, icon: Icon, entities, compact = false }: { title: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; entities: RiskyEntity[]; compact?: boolean }) {
  return (
    <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-[#ffffff08]">
        <Icon className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          {title}
        </span>
      </div>
      {entities.length === 0 ? (
        <p className="text-[11px] text-zinc-700 p-6 text-center">No high-risk entities</p>
      ) : (
        <div className="divide-y divide-[#ffffff05]">
          {entities.slice(0, compact ? 5 : 10).map((e: RiskyEntity, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 hover:bg-white/2 transition-colors"
            >
              <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[200px]">
                {e.id}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase ${RISK_TIER_STYLES[e.tier] || 'text-zinc-500'}`}
                >
                  {e.tier}
                </span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {Math.round(e.score)}pts
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MostTargetedEndpoints({ endpoints }: { endpoints: TargetedEndpoint[] }) {
  return (
    <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-[#ffffff08]">
        <Zap className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Most Targeted
        </span>
      </div>
      {endpoints.length === 0 ? (
        <p className="text-[11px] text-zinc-700 p-6 text-center">No data</p>
      ) : (
        <div className="divide-y divide-[#ffffff05]">
          {endpoints.slice(0, 8).map((ep: TargetedEndpoint, i: number) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[150px]">
                {ep.endpoint || 'unknown'}
              </span>
              <span className="text-[10px] font-bold text-iris tabular-nums">{ep.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncidentsTab({ data, user, onUpdate }: { data: SecurityOverviewResponse | null; user: any; onUpdate: () => void }) {
  const [incidents, setIncidents] = useState<SecurityIncident[]>(data?.openIncidents || []);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SecurityIncident | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/security/incidents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as IncidentsApiResponse;
      if (json.ok) setIncidents(json.incidents || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleTransition = async (incidentId: string, status: string, resolution = '') => {
    const token = await user.getIdToken();
    await fetch(`/api/security/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(resolution ? { resolution } : {}) }),
    });
    setSelected(null);
    fetchAll();
    onUpdate();
  };

  return (
    <div className="space-y-4 px-1">
      <SectionHeader>Active Incidents</SectionHeader>
      {loading ? (
        <div className="text-[11px] text-zinc-600 py-8 text-center">Loading…</div>
      ) : incidents.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-[#ffffff08] rounded-2xl">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/30 mx-auto mb-3" />
          <p className="text-[11px] text-zinc-600 font-medium">No open incidents</p>
        </div>
      ) : (
        <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden divide-y divide-[#ffffff05]">
          {incidents.map((inc: SecurityIncident) => (
            <div
              key={inc.id}
              onClick={() => setSelected(selected?.id === inc.id ? null : inc)}
              className="px-5 py-4 hover:bg-white/2 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      label={inc.entityType}
                      style="bg-zinc-800 border-zinc-700 text-zinc-400"
                    />
                    <Badge
                      label={inc.severity}
                      style={SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES.low}
                    />
                    <Badge label={inc.status} style={STATUS_STYLES[inc.status] || ''} />
                  </div>
                  <p className="text-[12px] font-semibold text-white truncate">{inc.reason}</p>
                  <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{inc.entityId}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] text-zinc-700 tabular-nums">
                    {inc.createdAt ? new Date(inc.createdAt).toLocaleDateString() : ''}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-zinc-700 transition-transform ${selected?.id === inc.id ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>

              {selected?.id === inc.id && (
                <div
                  className="mt-4 pt-4 border-t border-[#ffffff08] flex flex-wrap gap-2"
                  onClick={(e: MouseEvent) => e.stopPropagation()}
                >
                  {inc.status === 'flagged' && (
                    <button
                      onClick={() => handleTransition(inc.id, 'under_review')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Eye className="h-3 w-3" /> Start Review
                    </button>
                  )}
                  {(inc.status === 'flagged' || inc.status === 'under_review') && (
                    <>
                      <button
                        onClick={() =>
                          handleTransition(inc.id, 'resolved', 'Investigated and cleared')
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Resolve
                      </button>
                      <button
                        onClick={() =>
                          handleTransition(inc.id, 'false_positive', 'Confirmed false positive')
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 transition-all text-[10px] font-bold uppercase tracking-widest"
                      >
                        <XCircle className="h-3 w-3" /> False Positive
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendsTab({ data }: { data: SecurityOverviewResponse | null }) {
  const trends = data?.trends?.trends || {};
  const endpoints = data?.trends?.mostTargetedEndpoints || [];
  const eventsByType = data?.metrics?.eventsByType || {};

  const aggregated: Record<string, number> = {};
  Object.values(trends).forEach((bucket: Record<string, number | string>) => {
    Object.entries(bucket).forEach(([k, v]: [string, number | string]) => {
      aggregated[k] = (aggregated[k] || 0) + Number(v);
    });
  });
  const sortedTypes = Object.entries(aggregated).sort(([, a], [, b]) => b - a);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1">
      <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-[#ffffff08]">
          <TrendingUp className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Attack Volume (24h)
          </span>
        </div>
        {sortedTypes.length === 0 ? (
          <p className="text-[11px] text-zinc-700 p-6 text-center">No trend data</p>
        ) : (
          <div className="p-4 space-y-3">
            {sortedTypes.map(([type, count]: [string, number]) => {
              const max = sortedTypes[0]?.[1] || 1;
              const pct = Math.round((count / max) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-zinc-400">{type}</span>
                    <span className="text-[10px] font-bold text-white tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-iris transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-[#ffffff08]">
          <Zap className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Targeted Endpoints
          </span>
        </div>
        {endpoints.length === 0 ? (
          <p className="text-[11px] text-zinc-700 p-6 text-center">No data</p>
        ) : (
          <div className="divide-y divide-[#ffffff05]">
            {endpoints.slice(0, 10).map((ep: TargetedEndpoint, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[240px]">
                  {ep.endpoint || 'unknown'}
                </span>
                <span className="text-[11px] font-bold text-iris tabular-nums flex-shrink-0">
                  {ep.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden lg:col-span-2">
        <div className="flex items-center gap-2 p-4 border-b border-[#ffffff08]">
          <Activity className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Event Distribution (Last 20)
          </span>
        </div>
        {Object.keys(eventsByType).length === 0 ? (
          <p className="text-[11px] text-zinc-700 p-6 text-center">No event data</p>
        ) : (
          <div className="flex flex-wrap gap-3 p-4">
            {Object.entries(eventsByType).map(([type, count]: [string, number]) => (
              <div
                key={type}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700"
              >
                <span className="text-[10px] font-mono text-zinc-400">{type}</span>
                <span className="text-[10px] font-bold text-white tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventsTab({ data }: { data: SecurityOverviewResponse | null }) {
  const events = data?.recentEvents || [];
  return (
    <div className="space-y-4 px-1">
      <SectionHeader>Recent Security Events (Last 20)</SectionHeader>
      {events.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-[#ffffff08] rounded-2xl">
          <Shield className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-[11px] text-zinc-600 font-medium">No events recorded yet</p>
        </div>
      ) : (
        <div className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden divide-y divide-[#ffffff05]">
          {events.map((ev: SecurityEvent) => (
            <div key={ev.id} className="px-5 py-3 hover:bg-white/2 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      label={ev.type}
                      style={ev.severity ? SEVERITY_STYLES[ev.severity] : SEVERITY_STYLES.low}
                    />
                    <Badge
                      label={ev.severity ?? ''}
                      style={ev.severity ? SEVERITY_STYLES[ev.severity] : SEVERITY_STYLES.low}
                    />
                    {ev.mitigated && (
                      <Badge
                        label="mitigated"
                        style="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {ev.ip && (
                      <span className="text-[10px] font-mono text-zinc-500">IP: {ev.ip}</span>
                    )}
                    {ev.uid && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        UID: {ev.uid?.slice(0, 12)}…
                      </span>
                    )}
                    {ev.endpoint && (
                      <span className="text-[10px] font-mono text-zinc-600">{ev.endpoint}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ev.mitigationAction && (
                    <span className="text-[9px] font-mono text-zinc-700">
                      {ev.mitigationAction}
                    </span>
                  )}
                  <span className="text-[9px] text-zinc-700 tabular-nums">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
