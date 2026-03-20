"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { Bell, X, AlertTriangle, Info, Zap } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { VenueAlert } from "@/lib/types/venueOverview";

// ── Icon + href maps ──────────────────────────────────────────────────────────

const SEVERITY_ICONS = {
    critical: AlertTriangle,
    warning: Zap,
    info: Info,
} as const;

const SEVERITY_COLORS = {
    critical: "var(--v-error)",
    warning: "var(--v-warning)",
    info: "var(--v-info)",
} as const;

const ALERT_HREF: Record<string, string> = {
    host_request: "/venue/connections/requests",
    promoter_request: "/venue/connections/requests",
    payout_failure: "/venue/finance/venue-payouts",
    revenue: "/venue/analytics/overview",
    event: "/venue/events",
    reservation: "/venue/reservations",
    payment: "/venue/finance/payments",
};

// ── Single alert row ──────────────────────────────────────────────────────────

function AlertRow({
    alert,
    onDismiss,
}: {
    alert: VenueAlert;
    onDismiss: (id: string) => void;
}) {
    const Icon = SEVERITY_ICONS[alert.severity] ?? Info;
    const iconColor = SEVERITY_COLORS[alert.severity] ?? "var(--v-info)";
    const href = alert.href ?? ALERT_HREF[alert.type];

    const inner = (
        <>
            <Icon
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: iconColor }}
            />
            <div className="flex-1 min-w-0">
                <p
                    className="text-[12px] font-semibold truncate"
                    style={{ color: "var(--v-text-primary)" }}
                >
                    {alert.title}
                </p>
                <p
                    className="text-[11px] truncate"
                    style={{ color: "var(--v-text-tertiary)" }}
                >
                    {alert.description}
                </p>
            </div>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    onDismiss(alert.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:brightness-125"
                style={{ color: "var(--v-text-muted)" }}
                aria-label="Dismiss alert"
            >
                <X className="w-3 h-3" />
            </button>
        </>
    );

    const wrapperClass =
        "flex items-start gap-3 p-3 rounded-xl group transition-colors hover:bg-white/[0.03]";
    const wrapperStyle: React.CSSProperties = !alert.isRead
        ? { background: "rgba(255,255,255,0.02)" }
        : {};

    if (href) {
        return (
            <Link href={href} className={wrapperClass} style={wrapperStyle}>
                {inner}
            </Link>
        );
    }
    return (
        <div className={wrapperClass} style={wrapperStyle}>
            {inner}
        </div>
    );
}

// ── AlertsPanel ───────────────────────────────────────────────────────────────

interface AlertsPanelProps {
    alerts: VenueAlert[];
    loading: boolean;
}

/**
 * AlertsPanel
 *
 * Shows up to 5 active venue alerts with dismiss controls.
 * Dismissed alerts are hidden client-side immediately (optimistic).
 * Unread badge count shown in the panel header.
 */
export const AlertsPanel = memo(function AlertsPanel({
    alerts,
    loading,
}: AlertsPanelProps) {
    const { user } = useDashboardAuth();

    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const visible = alerts.filter((a) => !dismissed.has(a.id));
    const unreadCount = visible.filter((a) => !a.isRead).length;

    const handleDismiss = async (id: string) => {
        setDismissed((prev) => new Set([...prev, id])); // optimistic
        try {
            const token = await user?.getIdToken();
            await fetch(`/api/venue/alerts/${id}/dismiss`, {
                method: 'PATCH',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
        } catch {
            // Non-fatal — optimistic hide already applied
        }
    };

    const handleClearAll = () => {
        const ids = visible.map((a) => a.id);
        setDismissed(new Set(ids));
        ids.forEach((id) => {
            user?.getIdToken().then((token) =>
                fetch(`/api/venue/alerts/${id}/dismiss`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {}),
            );
        });
    };

    return (
        <div
            className="rounded-[32px] p-5"
            style={{ background: "var(--v-card)" }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3
                        className="text-[14px] font-semibold"
                        style={{ color: "var(--v-text-primary)" }}
                    >
                        Alerts
                    </h3>
                    {unreadCount > 0 && (
                        <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: "var(--v-orange)" }}
                        >
                            {unreadCount}
                        </span>
                    )}
                </div>
                {visible.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="text-[11px] font-medium hover:underline"
                        style={{ color: "var(--v-text-muted)" }}
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Loading */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="v-skeleton h-10 rounded-xl" />
                    ))}
                </div>
            ) : visible.length === 0 ? (
                /* Empty state */
                <div className="py-6 text-center">
                    <Bell
                        className="w-6 h-6 mx-auto mb-2"
                        style={{ color: "var(--v-text-muted)" }}
                    />
                    <p
                        className="text-[12px]"
                        style={{ color: "var(--v-text-tertiary)" }}
                    >
                        No new alerts
                    </p>
                </div>
            ) : (
                /* Alert list */
                <div className="space-y-0.5">
                    {visible.slice(0, 5).map((alert) => (
                        <AlertRow
                            key={alert.id}
                            alert={alert}
                            onDismiss={handleDismiss}
                        />
                    ))}
                    {visible.length > 5 && (
                        <p
                            className="text-[11px] pt-2 text-center"
                            style={{ color: "var(--v-text-muted)" }}
                        >
                            +{visible.length - 5} more
                        </p>
                    )}
                </div>
            )}
        </div>
    );
});
