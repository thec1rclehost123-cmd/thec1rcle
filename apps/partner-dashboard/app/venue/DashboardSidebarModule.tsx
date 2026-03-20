"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { DashCard } from "@/components/ui/DashCard";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function DashboardSidebarModule() {
    const { user, profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        if (!venueId || !user) return;
        user.getIdToken().then(token =>
            fetch(`/api/venue/notifications?venueId=${venueId}&limit=5`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        )
            .then(res => res.ok ? res.json() : Promise.resolve({ notifications: [] }))
            .then(data => setAlerts(data.notifications || []))
            .catch(console.error);
    }, [venueId, user]);

    return (
        <DashCard padding="standard">
            <div className="flex items-center justify-between mb-4">
                <p className="dash-title-card text-[var(--text-primary)]">Alerts</p>
                {alerts.length > 0 && (
                    <span className="dash-label-sm text-[var(--accent)]">
                        {alerts.length} new
                    </span>
                )}
            </div>
            <div className="space-y-0">
                {alerts.length > 0 ? (
                    alerts.map((alert, i) => (
                        <div
                            key={alert.id || i}
                            className="flex items-start gap-3 py-3 border-b border-[var(--border-subtle)] last:border-0"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0 mt-1.5" />
                            <div className="flex-1 min-w-0">
                                <p className="dash-body-sm font-medium text-[var(--text-primary)] line-clamp-1">
                                    {alert.title}
                                </p>
                                <p className="dash-caption text-[var(--text-tertiary)] truncate">
                                    {alert.description}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-8 text-center">
                        <Bell className="h-6 w-6 text-[var(--text-quaternary)] mx-auto mb-2" strokeWidth={1.5} />
                        <p className="dash-body-sm text-[var(--text-tertiary)]">No new alerts</p>
                    </div>
                )}
            </div>
        </DashCard>
    );
}
