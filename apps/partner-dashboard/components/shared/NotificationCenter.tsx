'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  UserPlus,
  Handshake,
  Calendar,
  TrendingUp,
  CreditCard,
  Sparkles,
  X,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  data?: any;
  actionable?: boolean;
  actions?: string[];
}

export type NotificationPartnerType = 'venue' | 'host' | 'promoter' | undefined;

type NotifTab = 'all' | 'partners' | 'events' | 'finance' | 'ops';

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { id: NotifTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'partners', label: 'Partners' },
  { id: 'events', label: 'Events' },
  { id: 'finance', label: 'Finance' },
  { id: 'ops', label: 'Ops' },
];

const TYPE_TO_TAB: Record<string, NotifTab> = {
  host_request: 'partners',
  venue_request: 'partners',
  promoter_request: 'partners',
  connection_request: 'partners',
  event_submitted: 'events',
  event: 'events',
  event_review: 'events',
  revenue: 'finance',
  new_order: 'finance',
  payment: 'finance',
  reservation: 'ops',
  table_reservation: 'ops',
  slot_request: 'ops',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatNotificationTimestamp(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'Now';
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function normalizeNotification(
  raw: any,
  partnerType: NotificationPartnerType,
): Notification {
  const type = raw?.type || 'info';
  return {
    id: String(raw?.id || ''),
    type,
    title: raw?.title || 'Notification',
    description: raw?.description || raw?.message || '',
    timestamp:
      raw?.timestamp ||
      formatNotificationTimestamp(raw?.createdAt || raw?.submittedAt || raw?.requestedAt),
    isRead: Boolean(raw?.isRead ?? raw?.read ?? raw?.readAt),
    data: raw?.data || raw?.metadata || {},
    actionable: Boolean(
      raw?.actionable ??
      (partnerType === 'venue' &&
        ['connection_request', 'slot_request', 'table_reservation'].includes(type)),
    ),
    actions: Array.isArray(raw?.actions) ? raw.actions : undefined,
  };
}

export function getNotificationFetchUrl(partnerType: NotificationPartnerType, partnerId?: string) {
  if (!partnerId) return null;
  if (partnerType === 'host') return '/api/partners/hosts/notifications?limit=20';
  if (partnerType === 'promoter') return '/api/partners/promoters/notifications?limit=20';
  if (partnerType === 'venue')
    return `/api/partners/venues/notifications?venueId=${partnerId}&limit=20`;
  return null;
}

export function buildMarkAllReadRequest(partnerType: NotificationPartnerType, partnerId?: string) {
  if (partnerType === 'host') {
    return { url: '/api/partners/hosts/notifications', body: { markAllRead: true } };
  }
  if (partnerType === 'venue' && partnerId) {
    return {
      url: '/api/partners/venues/notifications',
      body: { venueId: partnerId, markAllRead: true },
    };
  }
  if (partnerType === 'promoter') {
    return { url: '/api/partners/promoters/notifications', body: { markAllRead: true } };
  }
  return null;
}

export function buildQuickActionRequest(
  partnerType: NotificationPartnerType,
  partnerId: string | undefined,
  notif: Notification,
  action: 'approve' | 'reject',
) {
  if (partnerType !== 'venue' || !partnerId) return null;
  return {
    url: '/api/partners/venues/notifications',
    body: {
      venueId: partnerId,
      notificationId: notif.id,
      notificationType: notif.type,
      action,
    },
  };
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  host_request: { icon: <UserPlus className="w-4 h-4 text-iris" />, bg: 'bg-iris/10' },
  connection_request: { icon: <UserPlus className="w-4 h-4 text-iris" />, bg: 'bg-iris/10' },
  promoter_request: {
    icon: <Handshake className="w-4 h-4 text-emerald-500" />,
    bg: 'bg-emerald-500/10',
  },
  event_submitted: {
    icon: <Sparkles className="w-4 h-4 text-purple-500" />,
    bg: 'bg-purple-500/10',
  },
  event: { icon: <Sparkles className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-500/10' },
  event_review: { icon: <Sparkles className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-500/10' },
  reservation: { icon: <Calendar className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-500/10' },
  table_reservation: {
    icon: <Calendar className="w-4 h-4 text-indigo-500" />,
    bg: 'bg-indigo-500/10',
  },
  slot_request: { icon: <Calendar className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-500/10' },
  revenue: { icon: <TrendingUp className="w-4 h-4 text-orange-500" />, bg: 'bg-orange-500/10' },
  new_order: { icon: <TrendingUp className="w-4 h-4 text-orange-500" />, bg: 'bg-orange-500/10' },
  payment: { icon: <CreditCard className="w-4 h-4 text-text-tertiary" />, bg: 'bg-surface-base' },
};

const defaultConfig = {
  icon: <Bell className="w-4 h-4 text-text-tertiary" />,
  bg: 'bg-surface-base',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const { profile, user } = useDashboardAuth();
  const router = useRouter();
  const membership = profile?.activeMembership;
  const partnerId = membership?.partnerId;
  const partnerType = (
    membership?.partnerType === 'club' ? 'venue' : membership?.partnerType
  ) as NotificationPartnerType;
  const isMountedRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
    },
    [user],
  );

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const play = (freq: number, startAt: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
        gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + 0.35);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + 0.4);
      };
      play(880, 0);
      play(1108, 0.18);
    } catch {
      /* silent */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!partnerId) return;
    if (isMountedRef.current) setLoading(true);
    try {
      const url = getNotificationFetchUrl(partnerType, partnerId);
      if (!url) return;
      const res = await authedFetch(url);
      const data = await res.json();
      const incoming: Notification[] = (data.notifications || []).map((n: any) =>
        normalizeNotification(n, partnerType),
      );

      if (!isMountedRef.current) return;

      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(incoming.map((n) => n.id));
      } else {
        const newOnes = incoming.filter((n) => !n.isRead && !seenIdsRef.current!.has(n.id));
        for (let i = 0; i < newOnes.length; i++) {
          setTimeout(playNotificationSound, i * 400);
        }
        incoming.forEach((n) => seenIdsRef.current!.add(n.id));
      }
      setNotifications(incoming);
    } catch (err: any) {
      console.error('[NotificationCenter] fetch error:', err);
      if (isMountedRef.current) setError('Failed to load notifications');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [partnerId, partnerType, authedFetch, playNotificationSound]);

  useEffect(() => {
    if (partnerId) fetchNotifications();
  }, [partnerId, fetchNotifications]);

  useEffect(() => {
    if (!partnerId) return;
    const interval = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(interval);
  }, [partnerId, fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!partnerId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const request = buildMarkAllReadRequest(partnerType, partnerId);
      if (!request) return;
      await authedFetch(request.url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
    } catch {
      /* silent */
    }
  };

  const handleQuickAction = async (
    notif: Notification,
    action: 'approve' | 'reject',
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (partnerType !== 'venue' || !partnerId) return;
    setActionLoading(`${notif.id}_${action}`);
    try {
      const request = buildQuickActionRequest(partnerType, partnerId, notif, action);
      if (!request) return;
      const res = await authedFetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      if (res.ok) fetchNotifications();
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotifClick = (notif: Notification) => {
    const rolePrefix =
      partnerType === 'venue' ? 'venue' : partnerType === 'host' ? 'host' : 'promoter';
    const hrefMap: Record<string, string> = {
      host_request: `/${rolePrefix}/partners`,
      connection_request: `/${rolePrefix}/partners`,
      promoter_request: `/${rolePrefix}/partners`,
      event_submitted: `/${rolePrefix}/events`,
      event: `/${rolePrefix}/events`,
      event_review: `/${rolePrefix}/events`,
      revenue: `/${rolePrefix}/finance`,
      new_order: `/${rolePrefix}/finance`,
      payment: `/${rolePrefix}/finance`,
      reservation: `/${rolePrefix}/door`,
      table_reservation: `/${rolePrefix}/door`,
      slot_request: `/${rolePrefix}/calendar`,
    };
    const href = hrefMap[notif.type];
    if (href) {
      setIsOpen(false);
      router.push(href);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filtered =
    activeTab === 'all'
      ? notifications
      : notifications.filter((n) => TYPE_TO_TAB[n.type] === activeTab);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-surface-secondary border border-border-subtle hover:bg-surface-tertiary transition-all"
      >
        <Bell className="w-[18px] h-[18px] text-text-tertiary" />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-c1rcle-orange rounded-full animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              className="absolute right-0 mt-3 w-[420px] max-w-[calc(100vw-2rem)] bg-surface-elevated border border-border-subtle rounded-[2rem] shadow-2xl z-[101] overflow-hidden"
            >
              <div className="px-5 pt-5 pb-4 border-b border-border-subtle">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-black text-text-primary">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-black text-c1rcle-orange uppercase tracking-widest"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={fetchNotifications}
                      className="p-1.5 rounded-lg hover:bg-surface-base"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 bg-surface-base/50 rounded-xl border border-white/5">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeTab === tab.id ? 'bg-surface-elevated shadow-sm text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[440px] overflow-y-auto custom-scrollbar divide-y divide-white/5 bg-surface-elevated">
                {loading && filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-text-placeholder" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                      Loading...
                    </p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center opacity-40">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-text-placeholder" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                      All caught up
                    </p>
                  </div>
                ) : (
                  filtered.map((notif) => {
                    const cfg = TYPE_CONFIG[notif.type] || defaultConfig;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`px-5 py-4 hover:bg-white/5 transition-all cursor-pointer relative ${!notif.isRead ? 'bg-c1rcle-orange/[0.02]' : ''}`}
                      >
                        {!notif.isRead && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-c1rcle-orange rounded-r-full" />
                        )}
                        <div className="flex gap-4">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}
                          >
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <h4 className="text-[12px] font-bold text-text-primary truncate">
                                {notif.title}
                              </h4>
                              <span className="text-[10px] text-text-tertiary tabular-nums shrink-0">
                                {notif.timestamp}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              {notif.description}
                            </p>
                            {notif.actionable && partnerType === 'venue' && (
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={(e) => handleQuickAction(notif, 'approve', e)}
                                  disabled={!!actionLoading}
                                  className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                  {actionLoading === `${notif.id}_approve` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.4 h-3.5" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  onClick={(e) => handleQuickAction(notif, 'reject', e)}
                                  disabled={!!actionLoading}
                                  className="flex-1 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                  {actionLoading === `${notif.id}_reject` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <AlertCircle className="w-3.5 h-3.5" />
                                  )}
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
