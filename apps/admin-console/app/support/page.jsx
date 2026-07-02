'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  User,
  ChevronRight,
  CheckCircle2,
  Mail,
  Calendar,
  RotateCw,
  Clock,
  AlertTriangle,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Send,
  Smartphone,
  Info,
  Lock,
  Layers,
  ThumbsUp,
  X,
  Activity,
  Plus,
  Trash2,
  FileImage,
  GitMerge,
  ArrowRight,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import { motion, AnimatePresence } from 'framer-motion';

// Mock agents for assignment
const SUPPORT_AGENTS = [
  { id: 'agent-1', name: 'Agent Sarah' },
  { id: 'agent-2', name: 'Agent Alex' },
  { id: 'agent-3', name: 'Agent Rahul' },
  { id: 'agent-4', name: 'Agent Emily' },
];

const ANNOUNCEMENT_TAGS = [
  'Scheduled Maintenance',
  'New Feature Releases',
  'Security Updates',
  'Policy Changes',
  'Known Issues',
  'Upcoming Platform Improvements',
];

export default function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  // Input states inside drawer
  const [replyMessage, setReplyMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'notes', 'timeline', 'context'
  const [actionLoading, setActionLoading] = useState(false);

  // Link entity states
  const [linkType, setLinkType] = useState('venue');
  const [linkId, setLinkId] = useState('');
  const [linkName, setLinkName] = useState('');

  // Merge states
  const [mergeTargetId, setMergeTargetId] = useState('');

  // Announcement States
  const [viewMode, setViewMode] = useState('tickets'); // 'tickets' or 'announcements'
  const [announcements, setAnnouncements] = useState([]);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnTag, setNewAnnTag] = useState('Scheduled Maintenance');

  const fetchSupport = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=support_tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      const sorted = (json.data || []).sort((a, b) => {
        const aClosed = a.status === 'closed' || a.status === 'resolved';
        const bClosed = b.status === 'closed' || b.status === 'resolved';
        if (aClosed && !bClosed) return 1;
        if (!aClosed && bClosed) return -1;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      setTickets(sorted);

      if (selectedTicket) {
        const updated = sorted.find((t) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
      return sorted;
    } catch (err) {
      console.error('Failed to fetch support tickets', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setAnnouncementLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=platform_announcements', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      const sorted = (json.data || []).sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      setAnnouncements(sorted);
    } catch (err) {
      console.error('Failed to fetch announcements', err);
    } finally {
      setAnnouncementLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (viewMode === 'tickets') {
        fetchSupport();
      } else {
        fetchAnnouncements();
      }
    }
  }, [user, viewMode]);

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;

    try {
      setActionLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ANNOUNCEMENT_CREATE',
          targetId: `ann_${Date.now()}`,
          params: {
            title: newAnnTitle,
            content: newAnnContent,
            tag: newAnnTag,
          },
        }),
      });

      if (res.ok) {
        setNewAnnTitle('');
        setNewAnnContent('');
        setNewAnnTag('Scheduled Maintenance');
        setIsAnnouncementModalOpen(false);
        await fetchAnnouncements();
      } else {
        const errJson = await res.json();
        alert(`Failed to publish: ${errJson.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id, title) => {
    if (!confirm(`Are you sure you want to delete the bulletin: "${title}"?`)) return;

    try {
      setActionLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ANNOUNCEMENT_DELETE',
          targetId: id,
          params: { type: 'announcement' },
        }),
      });

      if (res.ok) {
        await fetchAnnouncements();
      } else {
        const errJson = await res.json();
        alert(`Failed to delete: ${errJson.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getSLAStatus = (ticket) => {
    if (!ticket.createdAt) return { isBreached: false, label: 'No SLA' };
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return { isBreached: false, label: 'Resolved' };
    }

    let limitHours = 24;
    if (ticket.priority === 'critical') limitHours = 2;
    else if (ticket.priority === 'high') limitHours = 4;
    else if (ticket.priority === 'medium') limitHours = 12;

    const createdTime = new Date(ticket.createdAt).getTime();
    const now = Date.now();
    const elapsedMs = now - createdTime;
    const limitMs = limitHours * 60 * 60 * 1000;

    if (elapsedMs > limitMs) {
      const hoursOver = Math.floor((elapsedMs - limitMs) / (60 * 60 * 1000));
      return {
        isBreached: true,
        label: `Breached by ${hoursOver}h`,
      };
    } else {
      const hoursLeft = Math.ceil((limitMs - elapsedMs) / (60 * 60 * 1000));
      return {
        isBreached: false,
        label: `${hoursLeft}h left`,
      };
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'subject',
        label: 'Inquiry Subject',
        render: (val, row) => (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white tracking-tight uppercase">
              {row.subject || 'Support Message'}
            </span>
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest font-mono">
              ID: {row.id?.slice(-8).toUpperCase()}
            </span>
          </div>
        ),
      },
      {
        key: 'userEmail',
        label: 'Customer / Partner',
        render: (val, row) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-zinc-700" strokeWidth={2} />
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest truncate max-w-[200px]">
                {val || 'Anonymous'}
              </span>
            </div>
            {row.smartContext?.partnerId && (
              <span className="text-[9px] text-zinc-600 font-mono">
                Partner: {row.smartContext.partnerId.slice(-8).toUpperCase()}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'priority',
        label: 'Priority',
        render: (val) => {
          const priority = val;
          const isCritical = priority === 'critical';
          const isHigh = priority === 'high';
          return (
            <div
              className={`inline-flex items-center px-2 py-0.5 rounded border ${
                isCritical
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : isHigh
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-white/5 text-zinc-500 border-white/5'
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-widest">
                {priority || 'Normal'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        render: (val, row) => {
          const status = row.mergedInto ? 'merged' : val || 'new';
          const isClosed = status === 'closed' || status === 'resolved';
          const isMerged = status === 'merged';
          const isEscalated = status === 'escalated';
          const isWaiting = status === 'waiting for user';
          return (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${
                isMerged
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                  : isClosed
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : isEscalated
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                      : isWaiting
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}
            >
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  isMerged
                    ? 'bg-indigo-400'
                    : isClosed
                      ? 'bg-emerald-500'
                      : isEscalated
                        ? 'bg-red-500'
                        : isWaiting
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                }`}
              />
              <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                {status}
              </span>
            </div>
          );
        },
      },
      {
        key: 'sla',
        label: 'SLA Status',
        render: (val, row) => {
          const sla = getSLAStatus(row);
          if (row.status === 'resolved' || row.status === 'closed') {
            return (
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider font-mono">
                Fulfilled
              </span>
            );
          }
          return (
            <div
              className={`flex items-center gap-1.5 text-[10px] font-black font-mono ${sla.isBreached ? 'text-red-500' : 'text-zinc-500'}`}
            >
              {sla.isBreached && <AlertTriangle className="h-3.5 w-3.5" />}
              <span>{sla.label}</span>
            </div>
          );
        },
      },
      {
        key: 'actions',
        label: '',
        render: (val, row) => (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTicket(row);
                setIsDrawerOpen(true);
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-zinc-600 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const announcementColumns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Bulletin Title',
        render: (val, row) => (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white tracking-tight uppercase">
              {row.title}
            </span>
            <span className="text-[10px] text-zinc-500 line-clamp-1 font-mono">{row.content}</span>
          </div>
        ),
      },
      {
        key: 'tag',
        label: 'Type Tag',
        render: (val) => (
          <div className="inline-flex items-center px-2 py-0.5 rounded border border-orange-500/20 bg-orange-500/10 text-orange-405 text-orange-400">
            <span className="text-[9px] font-black uppercase tracking-widest font-mono">{val}</span>
          </div>
        ),
      },
      {
        key: 'createdAt',
        label: 'Date Published',
        render: (val) => (
          <span className="text-[10px] font-mono text-zinc-500">
            {val ? new Date(val).toLocaleString() : 'N/A'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (val, row) => (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAnnouncement(row.id, row.title);
              }}
              className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-600 hover:text-red-400 transition-colors"
              title="Delete announcement"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [announcements],
  );

  const filteredTickets = useMemo(() => {
    return tickets.filter(
      (t) =>
        t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [tickets, searchTerm]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(
      (a) =>
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [announcements, searchTerm]);

  const triggerAction = async (actionName, paramsBody = {}) => {
    if (!selectedTicket) return;
    try {
      setActionLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: actionName,
          targetId: selectedTicket.id,
          params: {
            ...paramsBody,
            type: 'ticket',
            adminEmail: user.email,
          },
        }),
      });

      if (res.ok) {
        await fetchSupport();
      } else {
        const errJson = await res.json();
        alert(`Action failed: ${errJson.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    await triggerAction('SUPPORT_REPLY', { message: replyMessage });
    setReplyMessage('');
  };

  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!internalNote.trim()) return;
    await triggerAction('SUPPORT_ADD_INTERNAL_NOTE', { note: internalNote });
    setInternalNote('');
  };

  const handleLinkEntity = async (e) => {
    e.preventDefault();
    if (!linkId.trim()) return;
    await triggerAction('SUPPORT_LINK', {
      entityType: linkType,
      entityId: linkId,
      entityName: linkName || linkId,
    });
    setLinkId('');
    setLinkName('');
  };

  const handleMergeTicket = async (e) => {
    e.preventDefault();
    if (!mergeTargetId.trim()) return;
    await triggerAction('SUPPORT_MERGE', { duplicateTicketId: mergeTargetId });
    setMergeTargetId('');
  };

  return (
    <div className="space-y-8 pb-24">
      {/* ── MODULE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Concierge Desk
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Support Desk</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Centralized communications ledger to assign tickets, resolve issues, and publish
            announcements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-2.5 bg-white/[0.02] border border-[#ffffff05] rounded-xl flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white leading-tight font-mono-numbers">
                {tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length}
              </span>
              <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">
                Active Tickets
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── DESK TABS (TICKETS VS ANNOUNCEMENTS) ──────────────────────────── */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto scrollbar-hide pb-0.5 px-1">
        {[
          { id: 'tickets', label: 'Concierge Tickets', icon: Layers },
          { id: 'announcements', label: 'Platform Announcements', icon: Sparkles },
        ].map((tab) => {
          const SelectedIcon = tab.icon;
          const active = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setViewMode(tab.id);
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-[12px] font-black uppercase tracking-widest transition-all shrink-0 -mb-[2px] ${
                active
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-white'
              }`}
            >
              <SelectedIcon className={`h-4 w-4 ${active ? 'text-orange-500' : 'text-zinc-600'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── CENTRAL CONTROL BAR (Refresh + Unified Search + Action Button) ─ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            placeholder={
              viewMode === 'tickets'
                ? 'Look up tickets by subject, customer email, or ID...'
                : 'Look up bulletins by title, content, or tag...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-xs outline-none text-white focus:ring-1 focus:ring-orange-500/30 placeholder:text-zinc-700 font-mono"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[9px] font-black font-mono uppercase text-zinc-500">
            Synced:{' '}
            {refreshedAt
              ? refreshedAt.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
              : '—'}
          </span>
          <button
            onClick={async () => {
              if (viewMode === 'tickets') {
                await fetchSupport();
              } else {
                await fetchAnnouncements();
              }
              setRefreshedAt(new Date());
            }}
            disabled={loading || announcementLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 font-mono"
          >
            <RotateCw
              className={`h-3 w-3 ${(viewMode === 'tickets' ? loading : announcementLoading) ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>

          {viewMode === 'announcements' && (
            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:brightness-110 active:scale-95 text-white transition-all text-[10px] font-black uppercase tracking-widest font-mono"
            >
              <Plus className="h-3.5 w-3.5" />
              Publish Bulletin
            </button>
          )}
        </div>
      </div>

      {/* ── TAB CONTENT: TICKETS VIEW ─────────────────────────────────────── */}
      {viewMode === 'tickets' && (
        <DataTable
          columns={columns}
          data={filteredTickets}
          loading={loading}
          onRowClick={(row) => {
            setSelectedTicket(row);
            setIsDrawerOpen(true);
          }}
        />
      )}

      {/* ── TAB CONTENT: ANNOUNCEMENTS PUBLISHER DESK ────────────────────── */}
      {viewMode === 'announcements' && (
        <DataTable
          columns={announcementColumns}
          data={filteredAnnouncements}
          loading={announcementLoading}
        />
      )}

      {/* ── CENTRALIZED CONTROL DRAWER (TICKETS) ──────────────────────────────── */}
      <ActionDrawer
        isOpen={isDrawerOpen && viewMode === 'tickets'}
        onClose={() => setIsDrawerOpen(false)}
        title="Concierge Control Hub"
        subtitle="Manage status logs and communicate directly"
      >
        {selectedTicket && (
          <div className="space-y-8 pb-10">
            {/* Merged Banner */}
            {selectedTicket.mergedInto && (
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col gap-3 text-indigo-200 text-[12px] leading-relaxed">
                <div className="flex gap-3">
                  <GitMerge className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block">
                      Ticket Closed & Merged
                    </span>
                    This ticket has been merged into primary ticket{' '}
                    <span className="font-mono text-white font-bold">
                      {selectedTicket.mergedInto.slice(-8).toUpperCase()}
                    </span>
                    .
                  </div>
                </div>
                <button
                  onClick={() => {
                    const primary = tickets.find((t) => t.id === selectedTicket.mergedInto);
                    if (primary) {
                      setSelectedTicket(primary);
                    } else {
                      fetchSupport().then((refreshedList) => {
                        const refreshed = refreshedList.find(
                          (t) => t.id === selectedTicket.mergedInto,
                        );
                        if (refreshed) {
                          setSelectedTicket(refreshed);
                        } else {
                          alert(`Primary ticket not found. ID: ${selectedTicket.mergedInto}`);
                        }
                      });
                    }
                  }}
                  className="mt-1 w-full bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/30 text-indigo-300 text-xs font-bold py-2 rounded-lg border border-indigo-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> Go to Primary Ticket
                </button>
              </div>
            )}

            {/* Ticket header status banner */}
            <div
              className={`p-5 rounded-xl border relative overflow-hidden ${
                selectedTicket.status === 'closed' || selectedTicket.status === 'resolved'
                  ? 'bg-emerald-500/5 border-emerald-500/10'
                  : 'bg-amber-500/5 border-amber-500/10'
              }`}
            >
              {/* SLA warning badge */}
              {getSLAStatus(selectedTicket).isBreached && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl">
                  SLA Breached
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[9px] font-black uppercase tracking-wider font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-400">
                  ID: {selectedTicket.id?.toUpperCase()}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {selectedTicket.category}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase leading-snug">
                {selectedTicket.subject || 'Support Message'}
              </h3>
            </div>

            {/* SLA Alert banner */}
            {!['resolved', 'closed'].includes(selectedTicket.status) &&
              getSLAStatus(selectedTicket).isBreached && (
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 flex gap-3 text-red-200 text-[12px] leading-relaxed">
                  <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block">
                      Critical Response SLA Breached
                    </span>
                    This ticket has been active for longer than its priority response limits. Direct
                    immediate intervention is requested.
                  </div>
                </div>
              )}

            {/* workflow selectors (Status, Priority, Assignee) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#ffffff02] border border-[#ffffff05] p-4 rounded-xl font-mono text-[11px]">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-zinc-500">Work Status</span>
                <select
                  value={selectedTicket.status || 'new'}
                  disabled={actionLoading}
                  onChange={(e) => {
                    const status = e.target.value;
                    if (status === 'resolved') triggerAction('SUPPORT_RESOLVE');
                    else if (status === 'closed') triggerAction('SUPPORT_CLOSE');
                    else if (status === 'escalated') triggerAction('SUPPORT_ESCALATE');
                    else if (status === 'open') triggerAction('SUPPORT_REOPEN');
                    else {
                      triggerAction('SUPPORT_REOPEN');
                    }
                  }}
                  className="bg-zinc-950 border border-white/10 text-white rounded-lg p-2 outline-none font-bold uppercase"
                >
                  <option value="new">New</option>
                  <option value="open">Open</option>
                  <option value="waiting for user">Waiting for User</option>
                  <option value="in progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-zinc-500">SLA Priority</span>
                <select
                  value={selectedTicket.priority || 'medium'}
                  disabled={actionLoading}
                  onChange={(e) =>
                    triggerAction('SUPPORT_CHANGE_PRIORITY', { priority: e.target.value })
                  }
                  className="bg-zinc-950 border border-white/10 text-white rounded-lg p-2 outline-none font-bold uppercase"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-zinc-500">
                  Assigned Agent
                </span>
                <select
                  value={selectedTicket.assignedAgentId || ''}
                  disabled={actionLoading}
                  onChange={(e) => {
                    const agentId = e.target.value;
                    const agent = SUPPORT_AGENTS.find((a) => a.id === agentId);
                    triggerAction('SUPPORT_ASSIGN', {
                      agentId: agentId || '',
                      agentName: agent ? agent.name : 'Unassigned',
                    });
                  }}
                  className="bg-zinc-950 border border-white/10 text-white rounded-lg p-2 outline-none font-bold uppercase"
                >
                  <option value="">Unassigned</option>
                  {SUPPORT_AGENTS.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Entity Linking / Merge desk */}
            {!selectedTicket.mergedInto ? (
              <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-4">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                  Entity Linkings & Merging
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <form onSubmit={handleLinkEntity} className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-zinc-500 font-mono block">
                      Link Entity ID
                    </span>
                    <div className="flex gap-2">
                      <select
                        value={linkType}
                        onChange={(e) => setLinkType(e.target.value)}
                        className="bg-zinc-950 border border-white/10 text-white rounded-lg p-2 outline-none font-bold uppercase text-[10px]"
                      >
                        <option value="venue">Venue</option>
                        <option value="host">Host</option>
                        <option value="promoter">Promoter</option>
                        <option value="event">Event</option>
                        <option value="subscription">Subscription</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={linkId}
                        onChange={(e) => setLinkId(e.target.value)}
                        placeholder="Entity ID..."
                        className="bg-zinc-950 border border-white/10 text-white rounded-lg px-2 text-[11px] w-full"
                      />
                    </div>
                    <input
                      type="text"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      placeholder="Entity Name (optional)..."
                      className="bg-zinc-950 border border-white/10 text-white rounded-lg px-2 py-1 text-[11px] w-full"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-1 text-[10px] font-bold bg-white/5 border border-white/10 rounded hover:bg-white/10 uppercase tracking-widest"
                    >
                      Attach Link
                    </button>
                  </form>

                  <form onSubmit={handleMergeTicket} className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-zinc-500 font-mono block">
                      Merge Duplicate Ticket
                    </span>
                    <input
                      type="text"
                      required
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      placeholder="Enter duplicate Ticket ID..."
                      className="bg-zinc-950 border border-white/10 text-white rounded-lg p-2 text-[11px] w-full"
                    />
                    <p className="text-[9px] text-zinc-500 leading-snug">
                      This will close the duplicate ticket and link it directly to this primary
                      case.
                    </p>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-1 text-[10px] font-bold bg-white/5 border border-white/10 rounded hover:bg-white/10 uppercase tracking-widest text-orange-500"
                    >
                      Merge Ticket
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-950/20 border border-indigo-500/10 text-center text-zinc-500 font-mono text-[10px] rounded-xl flex items-center justify-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-zinc-600" /> Linkings and merges are locked for
                merged tickets.
              </div>
            )}

            {/* Linked Entity lists */}
            <div className="flex flex-wrap gap-2">
              {selectedTicket.linkedVenueId && (
                <span className="text-[9px] font-mono font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2.5 py-1 rounded flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> Venue:{' '}
                  {selectedTicket.linkedVenueName || selectedTicket.linkedVenueId.slice(-8)}
                </span>
              )}
              {selectedTicket.linkedHostId && (
                <span className="text-[9px] font-mono font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> Host:{' '}
                  {selectedTicket.linkedHostName || selectedTicket.linkedHostId.slice(-8)}
                </span>
              )}
              {selectedTicket.linkedPromoterId && (
                <span className="text-[9px] font-mono font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2.5 py-1 rounded flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> Promoter:{' '}
                  {selectedTicket.linkedPromoterName || selectedTicket.linkedPromoterId.slice(-8)}
                </span>
              )}
              {selectedTicket.linkedEventId && (
                <span className="text-[9px] font-mono font-bold bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 px-2.5 py-1 rounded flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> Event:{' '}
                  {selectedTicket.linkedEventName || selectedTicket.linkedEventId.slice(-8)}
                </span>
              )}
              {selectedTicket.linkedSubscriptionId && (
                <span className="text-[9px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> Sub ID:{' '}
                  {selectedTicket.linkedSubscriptionId.slice(-8)}
                </span>
              )}
            </div>

            {/* TAB SELECTORS */}
            <div className="flex border-b border-white/10 gap-2 font-mono text-[10px] tracking-widest font-black uppercase">
              {[
                { id: 'chat', label: 'Reply Ledger', icon: MessageSquare },
                { id: 'notes', label: 'Internal Notes', icon: Lock },
                { id: 'timeline', label: 'History Timeline', icon: Clock },
                { id: 'context', label: 'Smart Context', icon: Info },
                { id: 'media', label: 'Attachments', icon: FileImage },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all ${
                      active
                        ? 'border-orange-500 text-white'
                        : 'border-transparent text-zinc-500 hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* CHAT REPLY TAB */}
            {activeTab === 'chat' && (
              <div className="space-y-4">
                <div className="bg-zinc-950 rounded-xl p-4 border border-white/5 max-h-[300px] overflow-y-auto space-y-3">
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    selectedTicket.messages.map((msg, idx) => {
                      const isAdmin = msg.senderRole === 'admin';
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[85%] rounded-xl p-3 ${
                            isAdmin
                              ? 'bg-orange-500/10 border border-orange-500/20 self-end ml-auto'
                              : 'bg-white/5 border border-white/10 self-start'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1 text-[9px] font-mono font-bold text-zinc-500">
                            <span>{isAdmin ? 'concierge agent' : 'partner customer'}</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[12px] text-zinc-200 whitespace-pre-line leading-relaxed font-mono">
                            {msg.content}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-zinc-600 font-mono text-[11px]">
                      No message history.
                    </div>
                  )}
                </div>

                {selectedTicket.mergedInto ? (
                  <div className="p-3 bg-zinc-900 border border-white/5 text-center text-zinc-500 font-mono text-[11px] rounded-xl flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Ticket is closed and merged. Replies disabled.
                  </div>
                ) : (
                  <form onSubmit={handlePostReply} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Write a public reply to the partner dashboard..."
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-[12px] outline-none text-white focus:ring-1 focus:ring-orange-500/30 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="p-3 bg-orange-500 hover:brightness-110 text-white rounded-xl active:scale-95 transition-all"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* INTERNAL NOTES TAB */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="bg-zinc-950 rounded-xl p-4 border border-white/5 max-h-[300px] overflow-y-auto space-y-3">
                  {selectedTicket.internalNotes && selectedTicket.internalNotes.length > 0 ? (
                    selectedTicket.internalNotes.map((note, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-900 border border-white/[0.04] p-3 rounded-xl"
                      >
                        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 mb-1 font-bold">
                          <span className="flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" /> {note.authorName}
                          </span>
                          <span>{new Date(note.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[12px] text-zinc-300 font-mono leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-zinc-600 font-mono text-[11px] flex flex-col items-center justify-center gap-1">
                      <Lock className="h-5 w-5 text-zinc-700" />
                      <span>No administrative internal notes added yet.</span>
                    </div>
                  )}
                </div>

                {selectedTicket.mergedInto ? (
                  <div className="p-3 bg-zinc-900 border border-white/5 text-center text-zinc-500 font-mono text-[11px] rounded-xl flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Ticket is closed and merged. Internal notes
                    disabled.
                  </div>
                ) : (
                  <form onSubmit={handleAddInternalNote} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      placeholder="Write an internal note (visible ONLY to admin team)..."
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-[12px] outline-none text-white focus:ring-1 focus:ring-orange-500/30 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl active:scale-95 transition-all"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TIMELINE TAB */}
            {activeTab === 'timeline' && (
              <div className="space-y-4 bg-zinc-950 border border-white/5 p-5 rounded-xl">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-mono mb-4">
                  Complete Ticket History Timeline
                </h4>
                <div className="relative border-l border-white/10 ml-2.5 pl-5 space-y-6">
                  {selectedTicket.timeline && selectedTicket.timeline.length > 0 ? (
                    selectedTicket.timeline.map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[27.5px] top-0.5 h-3.5 w-3.5 rounded-full bg-zinc-900 border-2 border-orange-500 flex items-center justify-center" />
                        <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                          <div className="flex justify-between items-baseline text-zinc-500 text-[9px]">
                            <span className="font-bold text-zinc-400">
                              {event.actorName || 'System'}
                            </span>
                            <span>{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                          <span className="font-bold text-white uppercase text-[11px] mt-0.5">
                            {event.message}
                          </span>
                          {event.detail && (
                            <p className="text-zinc-500 text-[10px] leading-relaxed mt-0.5">
                              {event.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600 italic">No timeline milestones logged.</div>
                  )}
                </div>
              </div>
            )}

            {/* CONTEXT TAB */}
            {activeTab === 'context' && (
              <div className="space-y-4 font-mono text-[11px]">
                {selectedTicket.smartContext ? (
                  <div className="space-y-3 bg-zinc-950 border border-white/5 p-5 rounded-xl">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                      Automated Tech Context
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-zinc-900 p-3 rounded-lg border border-white/[0.04]">
                        <span className="text-[8px] font-black text-zinc-500 uppercase block">
                          Active Module
                        </span>
                        <span className="text-white text-[11px] font-bold block mt-0.5">
                          {selectedTicket.smartContext.currentModule}
                        </span>
                      </div>
                      <div className="bg-zinc-900 p-3 rounded-lg border border-white/[0.04]">
                        <span className="text-[8px] font-black text-zinc-500 uppercase block">
                          App version
                        </span>
                        <span className="text-white text-[11px] font-bold block mt-0.5">
                          {selectedTicket.smartContext.appVersion}
                        </span>
                      </div>
                      <div className="bg-zinc-900 p-3 rounded-lg border border-white/[0.04]">
                        <span className="text-[8px] font-black text-zinc-500 uppercase block">
                          Device Specs
                        </span>
                        <span className="text-white text-[10px] block mt-0.5 break-all leading-snug">
                          {selectedTicket.smartContext.deviceInfo}
                        </span>
                      </div>
                      <div className="bg-zinc-900 p-3 rounded-lg border border-white/[0.04]">
                        <span className="text-[8px] font-black text-zinc-500 uppercase block">
                          Browser User Agent
                        </span>
                        <span className="text-white text-[10px] block mt-0.5 break-all leading-snug">
                          {selectedTicket.smartContext.browserInfo}
                        </span>
                      </div>
                    </div>

                    {selectedTicket.smartContext.errorLogs &&
                      selectedTicket.smartContext.errorLogs.length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                          <span className="text-[8px] font-black text-red-400 uppercase block">
                            Captured Console Warning Logs
                          </span>
                          <div className="bg-red-950/10 border border-red-500/10 p-3 rounded-lg text-red-200/90 text-[10px] leading-relaxed font-mono whitespace-pre-wrap">
                            {selectedTicket.smartContext.errorLogs.join('\n')}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-10 text-zinc-600 font-mono text-[11px] bg-zinc-950 border border-white/5 rounded-xl">
                    No automatically attached smart context details found.
                  </div>
                )}

                {selectedTicket.feedback && (
                  <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase text-emerald-500">
                        Customer CSAT Feedback
                      </span>
                      <span className="text-[10px] font-bold text-white font-mono">
                        {new Date(selectedTicket.feedback.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: selectedTicket.feedback.rating }).map((_, i) => (
                        <span key={i}>⭐</span>
                      ))}
                    </div>
                    <p className="text-[12px] text-zinc-300 italic leading-relaxed">
                      &quot;{selectedTicket.feedback.comment || 'No written response provided.'}
                      &quot;
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold">
                      <span>Issue Resolved:</span>
                      <span
                        className={
                          selectedTicket.feedback.resolved ? 'text-emerald-500' : 'text-red-500'
                        }
                      >
                        {selectedTicket.feedback.resolved ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATTACHMENTS TAB */}
            {activeTab === 'media' && (
              <div className="space-y-6 font-mono text-[11px] bg-zinc-950 border border-white/5 p-5 rounded-xl">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
                  Screenshots & Screen Recordings
                </h4>

                {/* Screenshots */}
                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-zinc-500 block">
                    Screenshots / Images
                  </span>
                  {selectedTicket.images && selectedTicket.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTicket.images.map((imgUrl, idx) => (
                        <a
                          key={idx}
                          href={imgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-video rounded-lg border border-white/10 overflow-hidden bg-zinc-900 group hover:border-orange-500/50 transition-colors"
                        >
                          <img
                            src={imgUrl}
                            alt={`Screenshot ${idx + 1}`}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[9px] font-bold bg-zinc-950/80 px-2 py-1 rounded text-white border border-white/10">
                              VIEW ORIGINAL
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-600 italic">No images attached.</div>
                  )}
                </div>

                {/* Videos & Documents */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <span className="text-[9px] font-black uppercase text-zinc-500 block">
                    Screen Recordings / Videos
                  </span>
                  {selectedTicket.documents && selectedTicket.documents.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTicket.documents.map((docUrl, idx) => {
                        const isVideo =
                          docUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || docUrl.includes('video');
                        return (
                          <div
                            key={idx}
                            className="bg-zinc-900 border border-white/[0.04] p-3 rounded-lg flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-bold text-[10px]">
                                Record / Doc #{idx + 1}
                              </span>
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider text-[9px]"
                              >
                                Open File
                              </a>
                            </div>
                            {isVideo ? (
                              <video
                                src={docUrl}
                                controls
                                className="w-full rounded-md border border-white/10 bg-black max-h-[200px]"
                              />
                            ) : (
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-zinc-950 rounded border border-white/5 text-zinc-400 hover:text-white"
                              >
                                <FileText className="h-4.5 w-4.5 text-zinc-500" />
                                <span className="truncate">
                                  {docUrl.split('/').pop() || 'Attached Document'}
                                </span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-zinc-600 italic">
                      No screen recordings or documents attached.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ActionDrawer>

      {/* ── PUBLISH PLATFORM BULLETIN MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!actionLoading) setIsAnnouncementModalOpen(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-obsidian-surface border border-white/[0.08] rounded-[24px] overflow-hidden shadow-2xl flex flex-col z-10"
            >
              <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white uppercase tracking-tight">
                  Publish Announcement Bulletin
                </h3>
                <button
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  disabled={actionLoading}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handlePublishAnnouncement} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block font-mono">
                    Bulletin Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAnnTitle}
                    onChange={(e) => setNewAnnTitle(e.target.value)}
                    placeholder="Short bulletin title..."
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block font-mono">
                    Category Tag *
                  </label>
                  <select
                    value={newAnnTag}
                    onChange={(e) => setNewAnnTag(e.target.value)}
                    className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-[13px] outline-none text-white font-mono font-bold uppercase"
                    style={{ colorScheme: 'dark' }}
                  >
                    {ANNOUNCEMENT_TAGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block font-mono">
                    Bulletin Message Body *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newAnnContent}
                    onChange={(e) => setNewAnnContent(e.target.value)}
                    placeholder="Provide description content about this alert..."
                    className="w-full p-4 bg-zinc-950 border border-white/10 rounded-xl text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-white/5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsAnnouncementModalOpen(false)}
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl font-semibold text-zinc-400 hover:text-white uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 rounded-xl font-semibold bg-orange-500 hover:brightness-110 text-white flex items-center gap-2 uppercase tracking-wider"
                  >
                    {actionLoading && <Clock className="h-4 w-4 animate-spin" />}
                    Publish Announcement
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
