"use client";

import { useState, useEffect } from "react";
import { Bell, Users, Ticket, BarChart3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function DashboardSidebarModule() {
    const { user, profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        if (!venueId || !user) return;
        user.getIdToken().then(token =>
            fetch(`/api/venue/notifications?venueId=${venueId}&limit=3`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        )
            .then(res => res.ok ? res.json() : Promise.resolve({ notifications: [] }))
            .then(data => setAlerts(data.notifications || []))
            .catch(console.error);
    }, [venueId, user]);

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

            <div className="relative overflow-hidden p-6 rounded-[2rem] bg-text-primary text-text-inverse border border-border-default shadow-sm group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/20 transition-all duration-500" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-orange-500" />
                        <h4 className="text-[11px] font-black tracking-[0.2em] text-text-inverse uppercase">C1RCLE PRO</h4>
                    </div>
                    <p className="text-[14px] text-text-inverse/90 leading-relaxed font-medium mb-5 lowercase first-letter:uppercase">
                        Upgrade for deeper insights.
                    </p>
                    <button className="w-full py-3.5 px-4 rounded-xl bg-[#F44A22] text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-[#CC3311] transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                        Upgrade Now
                    </button>
                </div>
            </div>
        </div>
    );
}

function QuickLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
    return (
        <Link href={href} className="flex flex-col items-center justify-center p-5 rounded-2xl bg-surface-elevated border border-border-subtle hover:border-accent-primary transition-all group">
            <Icon className="w-5 h-5 mb-2 text-text-tertiary group-hover:text-accent-primary" />
            <span className="text-label text-text-tertiary group-hover:text-text-primary">{label}</span>
        </Link>
    );
}
