"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
    DoorOpen,
    RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter } from "next/navigation";

interface Notification {
    id: string;
    type: "host_request" | "promoter_request" | "event_submitted" | "reservation" | "event" | "revenue" | "payment";
    title: string;
    description: string;
    timestamp: string;
    isRead: boolean;
    data?: any;
    actionable?: boolean;
    actions?: string[];
}

// ── Tab definitions ────────────────────────────────────────────────────────────

type NotifTab = "all" | "partners" | "events" | "finance" | "ops";

const TABS: { id: NotifTab; label: string }[] = [
    { id: "all",      label: "All" },
    { id: "partners", label: "Partners" },
    { id: "events",   label: "Events" },
    { id: "finance",  label: "Finance" },
    { id: "ops",      label: "Ops" },
];

const TYPE_TO_TAB: Record<string, NotifTab> = {
    host_request:      "partners",
    promoter_request:  "partners",
    event_submitted:   "events",
    event:             "events",
    revenue:           "finance",
    payment:           "finance",
    reservation:       "ops",
};

// Per-role config — API base, id param name, dashboard link, notification nav hrefs
const ROLE_CONFIG: Record<string, {
    apiBase: string;
    idParam: string;
    dashboardHref: string;
    hrefs: Record<string, string>;
}> = {
    venue: {
        apiBase: "/api/venue/notifications",
        idParam: "venueId",
        dashboardHref: "/venue",
        hrefs: {
            host_request:      "/venue/partners",
            promoter_request:  "/venue/partners",
            event_submitted:   "/venue/events",
            event:             "/venue/events",
            revenue:           "/venue/finance",
            payment:           "/venue/finance",
            reservation:       "/venue/door",
        },
    },
    host: {
        apiBase: "/api/host/notifications",
        idParam: "hostId",
        dashboardHref: "/host",
        hrefs: {
            venue_request:     "/host/partners",
            promoter_request:  "/host/partners",
            host_request:      "/host/partners",
            event_submitted:   "/host/events",
            event:             "/host/events",
            revenue:           "/host/finance",
            payment:           "/host/finance",
            reservation:       "/host/door",
        },
    },
    promoter: {
        apiBase: "/api/promoter/notifications",
        idParam: "promoterId",
        dashboardHref: "/promoter",
        hrefs: {
            venue_request:     "/promoter/partners",
            host_request:      "/promoter/partners",
            promoter_request:  "/promoter/partners",
            event_submitted:   "/promoter/links",
            event:             "/promoter/links",
            revenue:           "/promoter/analytics",
            payment:           "/promoter/analytics",
        },
    },
};

// ── Icon & colour helpers ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
    host_request:     { icon: <UserPlus   className="w-4 h-4 text-iris" />,          bg: "bg-iris/10" },
    promoter_request: { icon: <Handshake  className="w-4 h-4 text-emerald-500" />,   bg: "bg-emerald-500/10" },
    event_submitted:  { icon: <Sparkles   className="w-4 h-4 text-purple-500" />,    bg: "bg-purple-500/10" },
    reservation:      { icon: <Calendar   className="w-4 h-4 text-indigo-500" />,    bg: "bg-indigo-500/10" },
    event:            { icon: <Sparkles   className="w-4 h-4 text-purple-500" />,    bg: "bg-purple-500/10" },
    revenue:          { icon: <TrendingUp className="w-4 h-4 text-orange-500" />,    bg: "bg-orange-500/10" },
    payment:          { icon: <CreditCard className="w-4 h-4 text-text-tertiary" />, bg: "bg-surface-base" },
};

const defaultConfig = { icon: <Bell className="w-4 h-4 text-text-tertiary" />, bg: "bg-surface-base" };

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationCenter() {
    const { profile, user } = useDashboardAuth();
    const router = useRouter();
    const partnerId   = profile?.activeMembership?.partnerId;
    const partnerType = (profile?.activeMembership?.partnerType as string) || "venue";
    const roleConfig  = ROLE_CONFIG[partnerType] ?? ROLE_CONFIG.venue;

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken(); // no forced refresh — uses cached token for speed
        return fetch(url, {
            ...options,
            headers: { ...options.headers, Authorization: `Bearer ${token}` },
        });
    }, [user]);

    const [isOpen, setIsOpen]             = useState(false);
    const [activeTab, setActiveTab]       = useState<NotifTab>("all");
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState<string | null>(null);

    // Set of notification IDs already seen — used to detect truly new arrivals
    const seenIdsRef = useRef<Set<string> | null>(null);

    // Play a soft double-chime using Web Audio API — no audio file needed
    const playNotificationSound = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const play = (freq: number, startAt: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
                gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
                gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + 0.35);
                osc.start(ctx.currentTime + startAt);
                osc.stop(ctx.currentTime + startAt + 0.4);
            };
            play(880, 0);      // A5
            play(1108, 0.18);  // C#6
        } catch { /* AudioContext not available */ }
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!partnerId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await authedFetch(
                `${roleConfig.apiBase}?${roleConfig.idParam}=${partnerId}&limit=40`
            );
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            const incoming: Notification[] = data.notifications || [];

            if (seenIdsRef.current === null) {
                // First load — just record what exists, no sound
                seenIdsRef.current = new Set(incoming.map(n => n.id));
            } else {
                // Play one chime per NEW unread notification that wasn't seen before
                const newOnes = incoming.filter(n => !n.isRead && !seenIdsRef.current!.has(n.id));
                for (let i = 0; i < newOnes.length; i++) {
                    // Stagger multiple chimes slightly so they don't overlap
                    setTimeout(playNotificationSound, i * 400);
                }
                // Merge new IDs into seen set
                incoming.forEach(n => seenIdsRef.current!.add(n.id));
            }

            setNotifications(incoming);
        } catch (err: any) {
            const msg: string = err?.message || String(err);
            // "Failed to fetch" is a transient dev/network error (Turbopack reload, offline, etc.)
            // Use warn so it never triggers the Next.js dev error overlay.
            if (process.env.NODE_ENV === "development" || msg === "Failed to fetch") {
                console.warn("[NotificationCenter] fetch error (non-critical):", msg);
            } else {
                console.error("[NotificationCenter] fetch error:", err);
            }
            // Don't surface an error banner for silent background polling failures
            if (notifications.length === 0) setError("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    }, [partnerId, roleConfig, authedFetch, playNotificationSound]);

    // Load on mount for badge count
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Refresh when panel opens
    useEffect(() => {
        if (isOpen) fetchNotifications();
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll every 15 seconds in the background for new notifications
    useEffect(() => {
        if (!partnerId) return;
        const interval = setInterval(fetchNotifications, 15_000);
        return () => clearInterval(interval);
    }, [partnerId, fetchNotifications]);

    const markRead = useCallback(async (ids: string[]) => {
        if (!ids.length) return;
        try {
            await authedFetch(roleConfig.apiBase, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_read", notificationIds: ids }),
            });
        } catch { /* silent */ }
    }, [roleConfig, authedFetch]);

    const handleMarkAllRead = async () => {
        if (!partnerId) return;
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        await markRead(notifications.map(n => n.id));
    };

    // Navigate to relevant page and close panel
    const handleNotifClick = async (notif: Notification) => {
        if (!notif.isRead) {
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
            markRead([notif.id]);
        }
        const href = roleConfig.hrefs[notif.type];
        if (href) {
            setIsOpen(false);
            router.push(href);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Per-tab unread counts (for badges)
    const tabUnread = (tab: NotifTab) =>
        tab === "all"
            ? unreadCount
            : notifications.filter(n => !n.isRead && TYPE_TO_TAB[n.type] === tab).length;

    // Filtered list
    const filtered = activeTab === "all"
        ? notifications
        : notifications.filter(n => TYPE_TO_TAB[n.type] === activeTab);

    return (
        <div className="relative">
            {/* Bell trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-surface-secondary border border-border-subtle hover:bg-surface-tertiary hover:scale-105 active:scale-95 transition-all group"
                aria-label="Notifications"
            >
                <Bell className="w-[18px] h-[18px] text-text-tertiary group-hover:text-text-primary transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--c1rcle-orange)] rounded-full ring-2 ring-[var(--surface-base)] animate-pulse" />
                )}
            </button>

            {/* Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />

                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.97 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="absolute left-0 mt-3 w-[420px] max-w-[calc(100vw-2rem)] bg-surface-elevated border border-border-subtle rounded-[2rem] shadow-2xl z-[101] overflow-hidden"
                            style={{ top: "100%" }}
                        >
                            {/* Header */}
                            <div className="px-5 pt-5 pb-4 border-b border-border-subtle">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-[15px] font-black text-text-primary tracking-tight">Notifications</h3>
                                        {loading && <Loader2 className="w-3.5 h-3.5 text-text-tertiary animate-spin" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={handleMarkAllRead}
                                                className="text-[10px] font-black text-[var(--c1rcle-orange)] uppercase tracking-widest hover:text-[var(--c1rcle-orange-dim)] transition-colors"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                        <button
                                            onClick={fetchNotifications}
                                            disabled={loading}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-secondary transition-all disabled:opacity-40"
                                            aria-label="Refresh notifications"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 text-text-tertiary ${loading ? "animate-spin" : ""}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    {TABS.map(tab => {
                                        const count = tabUnread(tab.id);
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-1 justify-center"
                                                style={isActive
                                                    ? { background: "var(--surface-elevated)", color: "var(--text-primary)" }
                                                    : { color: "var(--text-tertiary)" }}
                                            >
                                                {tab.label}
                                                {count > 0 && (
                                                    <span
                                                        className="px-1 py-0.5 rounded text-[9px] font-black min-w-[14px] text-center"
                                                        style={isActive
                                                            ? { background: "var(--c1rcle-orange)", color: "#fff" }
                                                            : { background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
                                                    >
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* List */}
                            <div className="max-h-[440px] overflow-y-auto custom-scrollbar">
                                {loading && filtered.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <Loader2 className="w-7 h-7 text-text-placeholder animate-spin mx-auto mb-3" />
                                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Loading…</p>
                                    </div>
                                ) : error ? (
                                    <div className="py-16 text-center space-y-3">
                                        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                                            <X className="w-5 h-5 text-red-500" />
                                        </div>
                                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{error}</p>
                                        <button onClick={fetchNotifications} className="text-[10px] font-black text-[var(--c1rcle-orange)] uppercase tracking-widest hover:text-[var(--c1rcle-orange-dim)]">
                                            Retry
                                        </button>
                                    </div>
                                ) : filtered.length > 0 ? (
                                    <div className="divide-y divide-[var(--border-subtle)]/30">
                                        {filtered.map(notif => {
                                            const cfg = TYPE_CONFIG[notif.type] || defaultConfig;
                                            return (
                                                <div
                                                    key={notif.id}
                                                    onClick={() => handleNotifClick(notif)}
                                                    className={`px-5 py-4 hover:bg-surface-secondary/50 transition-all cursor-pointer relative ${!notif.isRead ? "bg-[var(--c1rcle-orange)]/[0.02]" : ""}`}
                                                >
                                                    {/* Unread accent */}
                                                    {!notif.isRead && (
                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-[var(--c1rcle-orange)] rounded-r-full" />
                                                    )}

                                                    <div className="flex gap-3">
                                                        {/* Icon */}
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                                            {cfg.icon}
                                                        </div>

                                                        {/* Body */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2 mb-0.5">
                                                                <h4 className="text-[12px] font-bold text-text-primary leading-snug truncate">
                                                                    {notif.title}
                                                                </h4>
                                                                <div className="flex items-center gap-1 text-[10px] text-text-tertiary font-bold shrink-0">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    {notif.timestamp}
                                                                </div>
                                                            </div>
                                                            <p className="text-[11px] text-text-secondary leading-relaxed">
                                                                {notif.description}
                                                            </p>

                                                            {/* Tab badge */}
                                                            {activeTab === "all" && TYPE_TO_TAB[notif.type] && (
                                                                <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest"
                                                                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-tertiary)" }}>
                                                                    {TYPE_TO_TAB[notif.type]}
                                                                </span>
                                                            )}

                                                        </div>

                                                        {/* Navigate arrow */}
                                                        {roleConfig.hrefs[notif.type] && (
                                                            <ChevronRight className="w-3.5 h-3.5 text-text-placeholder shrink-0 mt-1 group-hover:text-text-tertiary transition-colors" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-16 text-center space-y-3">
                                        <div className="w-14 h-14 bg-surface-secondary rounded-full flex items-center justify-center mx-auto">
                                            {activeTab === "partners" ? <Handshake className="w-5 h-5 text-text-placeholder" />
                                                : activeTab === "events" ? <Sparkles className="w-5 h-5 text-text-placeholder" />
                                                : activeTab === "finance" ? <TrendingUp className="w-5 h-5 text-text-placeholder" />
                                                : activeTab === "ops" ? <DoorOpen className="w-5 h-5 text-text-placeholder" />
                                                : <Bell className="w-5 h-5 text-text-placeholder" />}
                                        </div>
                                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                                            No {activeTab === "all" ? "" : activeTab + " "}notifications
                                        </p>
                                        <p className="text-[11px] text-text-placeholder">You're all caught up!</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 bg-surface-secondary/40 border-t border-border-subtle flex items-center justify-between">
                                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                                    {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                                </p>
                                <button
                                    onClick={() => { setIsOpen(false); router.push(roleConfig.dashboardHref); }}
                                    className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.15em] hover:text-text-primary transition-colors flex items-center gap-1"
                                >
                                    Dashboard <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
