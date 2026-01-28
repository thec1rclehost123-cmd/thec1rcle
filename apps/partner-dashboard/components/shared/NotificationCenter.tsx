"use client";

import { useState, useEffect, useCallback } from "react";
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
    type: 'host_request' | 'promoter_request' | 'reservation' | 'event' | 'revenue' | 'payment';
    title: string;
    description: string;
    timestamp: string;
    isRead: boolean;
    data?: any;
    actionable?: boolean;
    actions?: string[];
}

export function NotificationCenter() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch notifications from API
    const fetchNotifications = useCallback(async () => {
        if (!venueId) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/venue/notifications?venueId=${venueId}&limit=20`);
            const data = await res.json();

            if (res.ok && data.notifications) {
                setNotifications(data.notifications);
            } else {
                setError(data.error || "Failed to fetch notifications");
            }
        } catch (err: any) {
            console.error("[NotificationCenter] Fetch error:", err);
            setError("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    }, [venueId]);

    // Fetch on mount and when panel opens
    useEffect(() => {
        if (isOpen && venueId) {
            fetchNotifications();
        }
    }, [isOpen, venueId, fetchNotifications]);

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
        if (!venueId || !notif.data) return;

        setActionLoading(`${notif.id}_${action}`);

        try {
            const res = await fetch(`/api/venue/notifications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venueId,
                    action: 'quick_action',
                    specificAction: action,
                    data: {
                        type: notif.type,
                        id: notif.id,
                        ...notif.data
                    }
                })
            });

            if (res.ok) {
                // Remove the notification from list after action
                setNotifications(prev => prev.filter(n => n.id !== notif.id));
            }
        } catch (err) {
            console.error("[NotificationCenter] Action error:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // Mark all as read
    const handleMarkAllRead = async () => {
        if (!venueId) return;

        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

        try {
            await fetch(`/api/venue/notifications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venueId,
                    action: 'mark_read',
                    notificationIds: notifications.map(n => n.id)
                })
            });
        } catch (err) {
            console.error("[NotificationCenter] Mark read error:", err);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'host_request': return <UserPlus className="w-4 h-4 text-iris" />;
            case 'promoter_request': return <Handshake className="w-4 h-4 text-emerald-500" />;
            case 'reservation': return <Calendar className="w-4 h-4 text-indigo-500" />;
            case 'event': return <Sparkles className="w-4 h-4 text-purple-500" />;
            case 'revenue': return <TrendingUp className="w-4 h-4 text-orange-500" />;
            case 'payment': return <CreditCard className="w-4 h-4 text-slate-500" />;
            default: return <Bell className="w-4 h-4 text-slate-400" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="relative">
            {/* Bell Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-tertiary)] hover:scale-105 active:scale-95 transition-all group"
            >
                <Bell className="w-[20px] h-[20px] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
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
                            className="absolute right-0 mt-4 w-[400px] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-[2rem] shadow-2xl z-[101] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-gradient-to-br from-[var(--surface-base)] to-transparent">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <h3 className="text-[15px] font-black text-[var(--text-primary)] tracking-tight">Notifications</h3>
                                        <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mt-0.5">
                                            {unreadCount} UNREAD MESSAGES
                                        </p>
                                    </div>
                                    {loading && (
                                        <Loader2 className="w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchNotifications}
                                        disabled={loading}
                                        className="p-2 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 text-[var(--text-tertiary)] ${loading ? 'animate-spin' : ''}`} />
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
                                        <Loader2 className="w-8 h-8 text-[var(--text-placeholder)] animate-spin mx-auto mb-4" />
                                        <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                                            Loading notifications...
                                        </p>
                                    </div>
                                ) : error ? (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                                            <X className="w-6 h-6 text-red-500" />
                                        </div>
                                        <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{error}</p>
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
                                                className={`p-6 hover:bg-[var(--surface-secondary)]/50 transition-all cursor-pointer group relative ${!notif.isRead ? 'bg-orange-500/[0.02]' : ''}`}
                                            >
                                                <div className="flex gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${notif.type === 'revenue' ? 'bg-orange-500/10' :
                                                        notif.type === 'reservation' ? 'bg-indigo-500/10' :
                                                            notif.type === 'host_request' ? 'bg-iris/10' :
                                                                notif.type === 'promoter_request' ? 'bg-emerald-500/10' :
                                                                    notif.type === 'event' ? 'bg-purple-500/10' :
                                                                        'bg-[var(--surface-base)]'
                                                        }`}>
                                                        {getIcon(notif.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h4 className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                                                                {notif.title}
                                                            </h4>
                                                            <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] font-bold">
                                                                <Clock className="w-3 h-3" />
                                                                {notif.timestamp}
                                                            </div>
                                                        </div>
                                                        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
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
                                                                    className="flex-1 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all"
                                                                >
                                                                    View Details
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleQuickAction(notif, 'approve');
                                                                    }}
                                                                    disabled={actionLoading === `${notif.id}_approve`}
                                                                    className="px-3 py-2 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-1"
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
                                        <div className="w-16 h-16 bg-[var(--surface-secondary)] rounded-full flex items-center justify-center mx-auto">
                                            <Bell className="w-6 h-6 text-[var(--text-placeholder)]" />
                                        </div>
                                        <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">No notifications</p>
                                        <p className="text-[11px] text-[var(--text-placeholder)]">You're all caught up!</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-[var(--surface-secondary)]/50 border-t border-[var(--border-subtle)] text-center">
                                <button className="text-[11px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-2 mx-auto">
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
