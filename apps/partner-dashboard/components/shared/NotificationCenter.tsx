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
    Check,
    X,
    ChevronRight,
    Search,
    Clock,
    Loader2,
    RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

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

export type NotificationPartnerType = "venue" | "host" | "promoter" | undefined;

export function formatNotificationTimestamp(value: unknown) {
    if (!value) return "";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return "Now";
    if (diffMinutes < 60) return `${diffMinutes}m`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function normalizeNotification(
    raw: any,
    partnerType: NotificationPartnerType
): Notification {
    const type = raw?.type || "info";
    return {
        id: String(raw?.id || ""),
        type,
        title: raw?.title || "Notification",
        description: raw?.description || raw?.message || "",
        timestamp: raw?.timestamp || formatNotificationTimestamp(raw?.createdAt || raw?.submittedAt || raw?.requestedAt),
        isRead: Boolean(raw?.isRead ?? raw?.read ?? raw?.readAt),
        data: raw?.data || raw?.metadata || {},
        actionable: Boolean(
            raw?.actionable ??
            (partnerType === "venue" && ["connection_request", "slot_request", "table_reservation"].includes(type))
        ),
        actions: Array.isArray(raw?.actions) ? raw.actions : undefined,
    };
}

export function getNotificationFetchUrl(partnerType: NotificationPartnerType, partnerId?: string) {
    if (!partnerId) return null;
    if (partnerType === "host") return "/api/host/notifications?limit=20";
    if (partnerType === "promoter") return "/api/promoter/notifications?limit=20";
    if (partnerType === "venue") return `/api/venue/notifications?venueId=${partnerId}&limit=20`;
    return null;
}

export function buildMarkAllReadRequest(partnerType: NotificationPartnerType, partnerId?: string) {
    if (partnerType === "host") {
        return {
            url: "/api/host/notifications",
            body: { markAll: true },
        };
    }

    if (partnerType === "venue" && partnerId) {
        return {
            url: "/api/venue/notifications",
            body: { venueId: partnerId, markAllRead: true },
        };
    }

    if (partnerType === "promoter") {
        return {
            url: "/api/promoter/notifications",
            body: { markAll: true },
        };
    }

    return null;
}

export function buildQuickActionRequest(partnerType: NotificationPartnerType, partnerId: string | undefined, notif: Notification, action: "approve" | "reject") {
    if (partnerType !== "venue" || !partnerId) return null;

    return {
        url: "/api/venue/notifications",
        body: {
            venueId: partnerId,
            notificationId: notif.id,
            notificationType: notif.type,
            action,
        },
    };
}

export function NotificationCenter() {
    const { profile, user } = useDashboardAuth();
    const membership = profile?.activeMembership;
    const partnerId = membership?.partnerId;
    const partnerType = membership?.partnerType;
    const isMountedRef = useRef(false);

    const isVenue = partnerType === "venue";
    const isHost = partnerType === "host";
    const isPromoter = partnerType === "promoter";

    // Helper for authenticated API calls
    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) {
            console.error("[NotificationCenter] authedFetch called without user");
            throw new Error("Not authenticated");
        }
        // Force refresh token to ensure it's valid
        const token = await user.getIdToken(true);
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
            },
        });
    }, [user]);

    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Fetch notifications from API
    const fetchNotifications = useCallback(async () => {
        if (!partnerId) return;

        if (isMountedRef.current) {
            setLoading(true);
            setError(null);
        }

        try {
            const url = getNotificationFetchUrl(partnerType, partnerId);
            if (!url) {
                setNotifications([]);
                return;
            }
            const res = await authedFetch(url);
            const data = await res.json();

            if (!isMountedRef.current) return;

            if (res.ok && data.notifications) {
                setNotifications(data.notifications.map((notification: any) => normalizeNotification(notification, partnerType)));
            } else {
                setError(data.error || "Failed to fetch notifications");
            }
        } catch (err: any) {
            console.error("[NotificationCenter] Fetch error:", err);
            if (isMountedRef.current) {
                setError("Failed to load notifications");
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [partnerId, partnerType, authedFetch]);

    // Fetch on mount and when panel opens
    useEffect(() => {
        if (isOpen && partnerId) {
            fetchNotifications();
        }
    }, [isOpen, partnerId, fetchNotifications]);

    // Auto-refresh every 60 seconds when panel is open
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            fetchNotifications();
        }, 60000);

        return () => clearInterval(interval);
    }, [isOpen, fetchNotifications]);

    // Handle quick action (approve/reject)
    const handleQuickAction = async (notif: Notification, action: 'approve' | 'reject') => {
        if (!isVenue || !partnerId) return;

        setActionLoading(`${notif.id}_${action}`);

        try {
            const request = buildQuickActionRequest(partnerType, partnerId, notif, action);
            if (!request) return;

            const res = await authedFetch(request.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request.body)
            });

            if (!isMountedRef.current) return;

            if (res.ok) {
                // Remove the notification from list after action
                setNotifications(prev => prev.filter(n => n.id !== notif.id));
            }
        } catch (err) {
            console.error("[NotificationCenter] Action error:", err);
        } finally {
            if (isMountedRef.current) {
                setActionLoading(null);
            }
        }
    };

    // Mark all as read
    const handleMarkAllRead = async () => {
        if (!partnerId) return;

        // Optimistic update
        if (isMountedRef.current) {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        }

        try {
            const request = buildMarkAllReadRequest(partnerType, partnerId);
            if (!request) return;

            await authedFetch(request.url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request.body)
            });
        } catch (err) {
            console.error("[NotificationCenter] Mark read error:", err);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'host_request':
            case 'connection_request':
                return <UserPlus className="w-4 h-4 text-iris" />;
            case 'promoter_request':
                return <Handshake className="w-4 h-4 text-emerald-500" />;
            case 'reservation':
            case 'table_reservation':
            case 'slot_request':
                return <Calendar className="w-4 h-4 text-indigo-500" />;
            case 'event':
            case 'event_review':
                return <Sparkles className="w-4 h-4 text-purple-500" />;
            case 'revenue':
            case 'new_order':
                return <TrendingUp className="w-4 h-4 text-orange-500" />;
            case 'payment': return <CreditCard className="w-4 h-4 text-text-tertiary" />;
            default: return <Bell className="w-4 h-4 text-text-tertiary" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="relative">
            {/* Bell Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-11 h-11 flex items-center justify-center rounded-2xl bg-surface-secondary border border-border-subtle hover:bg-surface-tertiary hover:scale-105 active:scale-95 transition-all group"
            >
                <Bell className="w-[20px] h-[20px] text-text-tertiary group-hover:text-text-primary transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-[var(--surface-base)] animate-pulse" />
                )}
            </button>

            {/* Notification Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for closing */}
                        <div
                            className="fixed inset-0 z-[100]"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute right-0 mt-4 w-[400px] bg-surface-elevated border border-border-subtle rounded-[2rem] shadow-2xl z-[101] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-gradient-to-br from-[var(--surface-base)] to-transparent">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <h3 className="text-[15px] font-black text-text-primary tracking-tight">Notifications</h3>
                                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.2em] mt-0.5">
                                            {unreadCount} UNREAD MESSAGES
                                        </p>
                                    </div>
                                    {loading && (
                                        <Loader2 className="w-4 h-4 text-text-tertiary animate-spin" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchNotifications}
                                        disabled={loading}
                                        className="p-2 rounded-lg hover:bg-surface-secondary transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 text-text-tertiary ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllRead}
                                            className="text-[11px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600 transition-colors"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* List */}
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                {loading && notifications.length === 0 ? (
                                    <div className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 text-text-placeholder animate-spin mx-auto mb-4" />
                                        <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                            Loading notifications...
                                        </p>
                                    </div>
                                ) : error ? (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                                            <X className="w-6 h-6 text-red-500" />
                                        </div>
                                        <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">{error}</p>
                                        <button
                                            onClick={fetchNotifications}
                                            className="text-[11px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                ) : notifications.length > 0 ? (
                                    <div className="divide-y divide-[var(--border-subtle)]/30">
                                        {notifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`p-6 hover:bg-surface-secondary/50 transition-all cursor-pointer group relative ${!notif.isRead ? 'bg-orange-500/[0.02]' : ''}`}
                                            >
                                                <div className="flex gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${notif.type === 'revenue' || notif.type === 'new_order' ? 'bg-orange-500/10' :
                                                        notif.type === 'reservation' || notif.type === 'table_reservation' || notif.type === 'slot_request' ? 'bg-indigo-500/10' :
                                                            notif.type === 'host_request' || notif.type === 'connection_request' ? 'bg-iris/10' :
                                                                notif.type === 'promoter_request' ? 'bg-green-500/10' :
                                                                    notif.type === 'event' || notif.type === 'event_review' ? 'bg-purple-500/10' :
                                                                        'bg-surface-base'
                                                        }`}>
                                                        {getIcon(notif.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h4 className="text-[13px] font-bold text-text-primary truncate">
                                                                {notif.title}
                                                            </h4>
                                                            <div className="flex items-center gap-1 text-[10px] text-text-tertiary font-bold">
                                                                <Clock className="w-3 h-3" />
                                                                {notif.timestamp}
                                                            </div>
                                                        </div>
                                                        <p className="text-[12px] text-text-secondary leading-relaxed">
                                                            {notif.description}
                                                        </p>

                                                        {/* Action Buttons for Actionable Requests */}
                                                        {notif.actionable && !notif.isRead && (
                                                            <div className="flex items-center gap-2 mt-4">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // View details - could navigate to specific page
                                                                    }}
                                                                    className="flex-1 py-2 bg-surface-secondary text-text-primary text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all"
                                                                >
                                                                    View Details
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleQuickAction(notif, 'approve');
                                                                    }}
                                                                    disabled={actionLoading === `${notif.id}_approve`}
                                                                    className="px-3 py-2 bg-green-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    {actionLoading === `${notif.id}_approve` ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3 h-3" />
                                                                    )}
                                                                    Approve
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {!notif.isRead && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-orange-500 rounded-r-full" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto">
                                            <Bell className="w-6 h-6 text-text-placeholder" />
                                        </div>
                                        <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">No notifications</p>
                                        <p className="text-[11px] text-text-placeholder">You're all caught up!</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-surface-secondary/50 border-t border-border-subtle text-center">
                                <button className="text-[11px] font-black text-text-tertiary uppercase tracking-[0.2em] hover:text-text-primary transition-colors flex items-center justify-center gap-2 mx-auto">
                                    View All Activity <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
