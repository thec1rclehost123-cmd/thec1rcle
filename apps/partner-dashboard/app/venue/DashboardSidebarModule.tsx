"use client";

import { useState, useEffect } from "react";
import { Bell, Users, Ticket, BarChart3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function DashboardSidebarModule() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        if (!venueId) return;
        fetch(`/api/venue/notifications?venueId=${venueId}&limit=3`)
            .then(res => res.json())
            .then(data => setAlerts(data.notifications || []))
            .catch(console.error);
    }, [venueId]);

    return (
        <div className="space-y-6">
            <div className="card p-6">
                <h3 className="text-title text-text-primary mb-5">Alerts & Notifications</h3>
                <div className="space-y-3">
                    {alerts.length > 0 ? (
                        alerts.map((alert, i) => (
                            <div key={alert.id || i} className="flex items-start gap-3 p-3 rounded-xl border border-transparent">
                                <div className="p-2 rounded-lg bg-surface-secondary">
                                    <Bell className="w-4 h-4 text-text-tertiary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-title-sm text-text-primary truncate">{alert.title}</p>
                                    <p className="text-caption text-text-tertiary truncate">{alert.description}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-caption text-text-tertiary">No new notifications</div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <QuickLink icon={Users} label="Staff" href="/venue/staff" />
                <QuickLink icon={Ticket} label="Registers" href="/venue/registers" />
                <QuickLink icon={BarChart3} label="Analytics" href="/venue/analytics" />
                <QuickLink icon={Sparkles} label="Marketing" href="/venue/page-management" />
            </div>

            <div className="relative overflow-hidden p-6 rounded-3xl bg-text-primary text-text-inverse">
                <h4 className="text-title text-text-inverse mb-2">C1RCLE PRO</h4>
                <p className="text-body-sm opacity-70 mb-5">Upgrade for deeper insights.</p>
                <button className="btn btn-primary btn-sm">Upgrade Now</button>
            </div>
        </div>
    );
}

function QuickLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
    return (
        <Link href={href} className="flex flex-col items-center justify-center p-5 rounded-2xl bg-surface-elevated border border-border-subtle hover:border-c1rcle-orange transition-all group">
            <Icon className="w-5 h-5 mb-2 text-text-tertiary group-hover:text-c1rcle-orange" />
            <span className="text-label text-text-tertiary group-hover:text-text-primary">{label}</span>
        </Link>
    );
}
