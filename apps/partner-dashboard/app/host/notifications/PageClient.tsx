"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCheck, RefreshCw, Loader2, BellOff } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { motion } from "framer-motion";

interface Notification {
    id: string;
    type?: string;
    title?: string;
    body?: string;
    message?: string;
    isRead?: boolean;
    read?: boolean;
    createdAt?: string | null;
}

function timeAgo(iso: string | null | undefined): string {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

const TYPE_COLOR: Record<string, string> = {
    event:   "#F44A22",
    payout:  "#22c55e",
    team:    "#3b82f6",
    alert:   "#f59e0b",
    system:  "#6b7280",
};

function dotColor(type?: string) {
    return TYPE_COLOR[type?.toLowerCase() ?? ""] ?? "#6b7280";
}

export default function HostNotificationsPageClient() {
    const { profile, user } = useDashboardAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [marking, setMarking] = useState(false);

    const hostId = profile?.activeMembership?.partnerId;

    const fetchNotifications = useCallback(async () => {
        if (!hostId) return;
        setLoading(true);
        setError(false);
        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/host/notifications", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            setNotifications(data.notifications ?? []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [hostId, user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAllRead = async () => {
        if (marking) return;
        setMarking(true);
        try {
            const token = await user?.getIdToken();
            await fetch("/api/host/notifications", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ markAll: true }),
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true })));
        } finally {
            setMarking(false);
        }
    };

    const markOneRead = async (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true, read: true } : n)
        );
        const token = await user?.getIdToken();
        fetch("/api/host/notifications", {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ notificationId: id }),
        }).catch(() => null);
    };

    const unreadCount = notifications.filter(n => !n.isRead && !n.read).length;

    return (
        <VenuePageShell
            title="Notifications"
            subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            actions={
                <>
                    <VenueActionButton
                        icon={RefreshCw}
                        variant="secondary"
                        onClick={fetchNotifications}
                        disabled={loading}
                    >
                        Refresh
                    </VenueActionButton>
                    {unreadCount > 0 && (
                        <VenueActionButton
                            icon={marking ? Loader2 : CheckCheck}
                            onClick={markAllRead}
                            disabled={marking}
                        >
                            Mark all read
                        </VenueActionButton>
                    )}
                </>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-6 h-6 animate-spin text-text-placeholder" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-3 py-24 text-center">
                    <BellOff className="w-8 h-8 text-text-placeholder" />
                    <p className="text-text-secondary text-sm">Failed to load notifications.</p>
                    <button
                        onClick={fetchNotifications}
                        className="text-xs text-brand-primary underline underline-offset-2"
                    >
                        Try again
                    </button>
                </div>
            ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-24 text-center">
                    <BellOff className="w-8 h-8 text-text-placeholder" />
                    <p className="text-text-secondary text-sm font-medium">No notifications yet.</p>
                    <p className="text-text-placeholder text-xs">You&apos;ll see event updates, team changes, and payout alerts here.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {notifications.map((n, i) => {
                        const isUnread = !n.isRead && !n.read;
                        return (
                            <motion.button
                                key={n.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: i * 0.03 }}
                                onClick={() => isUnread && markOneRead(n.id)}
                                className={`w-full text-left flex items-start gap-4 px-4 py-4 rounded-2xl transition-all border ${
                                    isUnread
                                        ? "bg-surface-card border-border-subtle hover:bg-surface-elevated cursor-pointer"
                                        : "bg-surface-base border-transparent opacity-60 hover:opacity-80"
                                }`}
                            >
                                <div
                                    className="mt-1 h-2 w-2 rounded-full shrink-0"
                                    style={{ background: isUnread ? dotColor(n.type) : "#3f3f46" }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">
                                        {n.title || n.type || "Notification"}
                                    </p>
                                    {(n.body || n.message) && (
                                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                                            {n.body || n.message}
                                        </p>
                                    )}
                                </div>
                                <span className="text-[10px] text-text-placeholder shrink-0 mt-0.5">
                                    {timeAgo(n.createdAt)}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            )}
        </VenuePageShell>
    );
}
