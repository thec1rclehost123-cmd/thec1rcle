'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowRight,
  AlertCircle,
  UserCheck,
  Briefcase,
  CheckCircle2,
  Clock,
  ClipboardList,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

interface LogEntry {
  id: string;
  type: 'handover' | 'incident' | 'vip' | 'lost-found' | 'reminder' | 'inspection';
  timestamp: string;
  description: string;
  author: string;
  severity?: 'low' | 'medium' | 'high';
  status?: 'open' | 'resolved' | 'pending';
  resolution?: string;
  category?: string;
}

export default function RegistersPage() {
  const { profile, getIdToken } = useDashboardAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [register, setRegister] = useState<any>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'incident' | 'vip' | 'lost-found'>('incident');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRegister = async () => {
    if (!profile?.activeMembership?.partnerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const venueId = profile.activeMembership.partnerId;
      const token = await getIdToken();
      const res = await fetch(
        `/api/partners/venues/registers?venueId=${venueId}&date=${selectedDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Failed to fetch register');
      const data = await res.json();
      setRegister(data.register);
    } catch (err: any) {
      console.error('Fetch Register Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegister();
  }, [selectedDate, profile]);

  const logs = useMemo(() => {
    if (!register) return [];
    const allLogs: LogEntry[] = [];

    // Map incidents
    (register.incidents || []).forEach((inc: any) => {
      allLogs.push({
        id: inc.id,
        type: 'incident',
        timestamp: inc.timestamp,
        description: inc.description,
        author: inc.createdBy?.name || 'Staff',
        severity: inc.severity,
        status: inc.status,
        resolution: inc.resolution,
      });
    });

    // Map lost and found items from notes
    if (register.notes?.lostAndFound) {
      allLogs.push({
        id: 'note-lf',
        type: 'lost-found',
        timestamp: register.updatedAt || register.createdAt,
        description: register.notes.lostAndFound,
        author: 'Registry',
      });
    }

    // Map handovers
    if (register.notes?.handover) {
      allLogs.push({
        id: 'note-h',
        type: 'handover',
        timestamp: register.updatedAt || register.createdAt,
        description: register.notes.handover,
        author: 'Manager',
      });
    }

    // Inspections
    (register.inspections || []).forEach((insp: any) => {
      allLogs.push({
        id: insp.id,
        type: 'inspection',
        timestamp: insp.timestamp,
        description: `Inspection: ${insp.area} - ${insp.result}`,
        author: insp.createdBy?.name || 'Staff',
        status: 'resolved',
      });
    });

    // Reminders
    (register.reminders || []).forEach((rem: any) => {
      allLogs.push({
        id: rem.id,
        type: 'reminder',
        timestamp: rem.timestamp,
        description: rem.description,
        author: rem.createdBy?.name || 'Staff',
        status: rem.completed ? 'resolved' : 'open',
      });
    });

    return allLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [register]);

  const filteredLogs = logs.filter((log) => {
    const matchesTab = activeTab === 'all' || log.type === activeTab;
    const matchesSearch =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleLogAction = async (formData: any) => {
    if (!profile?.activeMembership?.partnerId) return;
    setIsSubmitting(true);
    try {
      const venueId = profile.activeMembership.partnerId;
      let endpointAction = '';
      let payload: any = {};

      if (actionType === 'incident') {
        endpointAction = 'logIncident';
        payload = {
          description: formData.description,
          severity: formData.severity || 'medium',
          location: formData.location || 'General',
        };
      }

      const token = await getIdToken();
      const res = await fetch('/api/partners/venues/registers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venueId,
          date: selectedDate,
          action: endpointAction,
          data: payload,
        }),
      });

      if (!res.ok) throw new Error('Failed to save entry');
      setIsActionModalOpen(false);
      fetchRegister();
    } catch (err) {
      console.error('Action Error:', err);
      alert('Failed to save log entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveIncident = async (incidentId: string) => {
    const resolution = window.prompt('Enter resolution details:');
    if (!resolution) return;

    try {
      const token = await getIdToken();
      const res = await fetch('/api/partners/venues/registers', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venueId: profile?.activeMembership?.partnerId,
          date: selectedDate,
          action: 'resolveIncident',
          data: { incidentId, resolution },
        }),
      });
      if (res.ok) fetchRegister();
    } catch (err) {
      console.error(err);
    }
  };

  const stats = {
    openIncidents: logs.filter((l) => l.type === 'incident' && l.status !== 'resolved').length,
    vipsExpected: register?.notes?.vipsCount || 0,
    lostItems: logs.filter((l) => l.type === 'lost-found').length,
    totalLogs: logs.length,
  };

  const TABS = [
    { id: 'all', label: 'All Logs' },
    { id: 'handover', label: 'Handovers' },
    { id: 'incident', label: 'Incidents' },
    { id: 'vip', label: 'VIP Log' },
    { id: 'lost-found', label: 'Lost & Found' },
  ];

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-xl font-black text-text-primary tracking-tight uppercase flex items-center gap-2">
            Ops Registers
          </h1>
          <p className="text-text-tertiary text-[11px] font-medium mt-0.5">
            Duty logs, incident reports, and floor handovers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-elevated border border-white/5 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 hover:bg-surface-tertiary rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-text-secondary" />
            </button>
            <div className="px-2 text-[12px] font-bold text-text-primary flex items-center gap-1.5 min-w-[80px] justify-center">
              {new Date(selectedDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </div>
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 hover:bg-surface-tertiary rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-text-secondary" />
            </button>
          </div>
          <button
            onClick={() => {
              setActionType('incident');
              setIsActionModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--v-orange)] text-white rounded-xl text-[12px] font-bold shadow-lg shadow-orange-500/10 hover:brightness-110 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="OPEN INCIDENTS"
          value={stats.openIncidents}
          subtext="Pending"
          color="rose"
        />
        <StatCard label="VIP GUESTS" value={stats.vipsExpected} subtext="Tonight" color="indigo" />
        <StatCard label="LOST & FOUND" value={stats.lostItems} subtext="Active" color="amber" />
        <StatCard label="TOTAL LOGS" value={stats.totalLogs} subtext="Entries" color="slate" />
      </div>

      {/* Main Content */}
      <div className="bg-surface-elevated rounded-[24px] border border-white/5 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-surface-tertiary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[var(--v-orange)] text-white shadow-lg shadow-orange-500/10'
                    : 'text-text-tertiary hover:bg-surface-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search registers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface-elevated border border-white/5 rounded-xl text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange-glow)] w-full md:w-64 font-medium transition-all"
            />
          </div>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 text-text-placeholder animate-spin mb-4" />
              <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">
                Syncing Registry...
              </p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-white/5">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-white/5 transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div
                        className={`mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${getIconColor(log.type)}`}
                      >
                        {getIcon(log.type)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {log.severity && (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getSeverityColor(log.severity)}`}
                            >
                              {log.severity}
                            </span>
                          )}
                          {log.status === 'resolved' && (
                            <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Resolved
                            </span>
                          )}
                        </div>
                        <h4 className="text-[14px] font-bold text-text-primary leading-tight">
                          {log.description}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-text-tertiary">
                            {log.author}
                          </span>
                        </div>
                        {log.resolution && (
                          <div className="mt-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                            <p className="text-[11px] text-emerald-500 font-medium italic">
                              Resolution: {log.resolution}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {log.type === 'incident' && log.status !== 'resolved' && (
                        <button
                          onClick={() => resolveIncident(log.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-[10px] font-bold text-white rounded-lg shadow-lg shadow-emerald-500/10"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center text-center">
              <div className="h-24 w-24 bg-surface-tertiary rounded-[2.5rem] flex items-center justify-center mb-8 border border-border-subtle">
                <ClipboardList className="h-12 w-12 text-text-placeholder" />
              </div>
              <h3 className="text-2xl font-black text-text-primary mb-2 uppercase tracking-tight">
                Nothing to report
              </h3>
              <p className="text-text-tertiary text-sm font-medium mb-10 max-w-xs mx-auto">
                The registry is empty for this date. Good news or just starting?
              </p>
              <button
                onClick={() => {
                  setActionType('incident');
                  setIsActionModalOpen(true);
                }}
                className="px-10 py-4 bg-surface-secondary text-text-primary rounded-2xl font-bold text-sm shadow-xl hover:bg-surface-tertiary transition-all"
              >
                Create First Entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal for new Entry */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-surface-secondary/40 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsActionModalOpen(false)}
          />
          <div className="relative bg-surface-elevated rounded-[3rem] shadow-2xl w-full max-w-md p-10">
            <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight mb-8">
              New Incident Report
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-3 ml-2">
                  Description
                </label>
                <textarea
                  id="logDescription"
                  className="w-full p-6 bg-surface-tertiary border border-border-subtle rounded-[2rem] text-sm focus:outline-none focus:ring-4 focus:ring-slate-50 min-h-[150px] font-medium"
                  placeholder="What happened? Be specific..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-3 ml-2">
                  Severity
                </label>
                <select
                  id="logSeverity"
                  className="w-full p-6 bg-surface-tertiary border border-border-subtle rounded-[2rem] text-sm focus:outline-none focus:ring-4 focus:ring-slate-50 font-bold appearance-none cursor-pointer"
                >
                  <option value="low">Low - Minor issue</option>
                  <option value="medium">Medium - Action needed</option>
                  <option value="high">High - Immediate attention</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="flex-1 py-5 bg-surface-tertiary text-text-tertiary rounded-3xl font-bold text-sm hover:bg-surface-secondary transition-all"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => {
                  const desc = (document.getElementById('logDescription') as HTMLTextAreaElement)
                    .value;
                  const sev = (document.getElementById('logSeverity') as HTMLSelectElement).value;
                  handleLogAction({ description: desc, severity: sev });
                }}
                className="flex-1 py-5 bg-surface-secondary text-text-primary rounded-3xl font-bold text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string | number;
  subtext: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    rose: 'bg-rose-500/5 text-rose-500 border-rose-500/10',
    indigo: 'bg-indigo-500/5 text-indigo-500 border-indigo-500/10',
    amber: 'bg-amber-500/5 text-amber-500 border-amber-500/10',
    slate: 'bg-white/5 text-text-secondary border-white/5',
  };

  return (
    <div
      className={`p-4 rounded-2xl border ${colors[color] || colors.slate} shadow-sm transition-all hover:scale-[1.01] cursor-default`}
    >
      <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight">{value}</span>
        <span className="text-[9px] font-bold opacity-60 uppercase tracking-tight">{subtext}</span>
      </div>
    </div>
  );
}

function getIcon(type: string) {
  switch (type) {
    case 'handover':
      return <ArrowRight className="h-5 w-5" />;
    case 'incident':
      return <AlertCircle className="h-5 w-5" />;
    case 'vip':
      return <UserCheck className="h-5 w-5" />;
    case 'lost-found':
      return <Search className="h-5 w-5" />;
    case 'inspection':
      return <CheckCircle2 className="h-5 w-5" />;
    case 'reminder':
      return <Clock className="h-5 w-5" />;
    default:
      return <ClipboardList className="h-5 w-5" />;
  }
}

function getIconColor(type: string) {
  switch (type) {
    case 'handover':
      return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'incident':
      return 'bg-rose-50 text-rose-600 border-rose-100';
    case 'vip':
      return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    case 'lost-found':
      return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'inspection':
      return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'reminder':
      return 'bg-purple-50 text-purple-600 border-purple-100';
    default:
      return 'bg-surface-tertiary text-text-secondary border-border-subtle';
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'high':
      return 'bg-rose-50 text-rose-600 border-rose-200';
    case 'medium':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'low':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    default:
      return 'bg-surface-tertiary text-text-tertiary border-border-default';
  }
}
