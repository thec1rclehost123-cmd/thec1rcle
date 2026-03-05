"use client";

import { useState, useEffect } from "react";
import { Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProgressStat } from "@/components/ui/KPITile";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion } from "framer-motion";

export default function TonightOpsModule() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [tonight, setTonight] = useState<any>(null);

    useEffect(() => {
        if (!venueId) return;
        
        const fetchTonight = async () => {
            const eventsRes = await fetch(`/api/venue/events?venueId=${venueId}`);
            const eventsData = await eventsRes.json();
            const allEvents = eventsData.events || [];
            
            const todayStr = new Date().toISOString().split('T')[0];
            const tonightEvent = allEvents.find((e: any) => 
                (e.date && e.date.split('T')[0] === todayStr) || 
                (e.startDate && e.startDate.split('T')[0] === todayStr)
            );

            if (tonightEvent) {
                const tonightRes = await fetch(`/api/venue/overview/tonight?eventId=${tonightEvent.id}`);
                setTonight(await tonightRes.json());
            }
        };

        fetchTonight().catch(console.error);
    }, [venueId]);

    const formatRevenue = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
    };

    return (
        <div className="card p-8 min-h-[400px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-headline-sm text-[var(--text-primary)] mb-1">Tonight</h2>
                    <p className="text-body-sm text-[var(--text-tertiary)]">Real-time venue operations</p>
                </div>
                {tonight ? (
                    <div className="badge badge-success">
                        <span className="status-dot status-dot-success status-dot-pulse" />
                        Live: {tonight.checkedIn} Guests In
                    </div>
                ) : (
                    <div className="badge badge-neutral">No Event Tonight</div>
                )}
            </div>

            {tonight ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div>
                            <p className="text-label-sm text-[var(--text-tertiary)] mb-2">Expected</p>
                            <p className="text-stat-lg text-[var(--text-primary)]">{tonight.expected}</p>
                            <p className="text-caption text-[var(--text-tertiary)]">Total Guestlist</p>
                        </div>
                        <ProgressStat
                            label="Turnout Rate"
                            value={tonight.checkedIn}
                            max={tonight.expected}
                            displayValue={`${tonight.checkedIn} arrived`}
                            color="success"
                        />
                    </div>
                    <div className="space-y-6">
                        <div>
                            <p className="text-label-sm text-[var(--text-tertiary)] mb-2">Live Revenue</p>
                            <p className="text-stat-lg text-[var(--text-primary)]">
                                {formatRevenue(tonight.revenue)}
                            </p>
                            <p className="text-caption text-[var(--text-tertiary)]">Tonight's sales</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Link
                            href={`/venue/events/${tonight.id}`}
                            className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-[var(--c1rcle-orange)] hover:bg-[var(--c1rcle-orange-glow)] transition-all"
                        >
                            <div>
                                <p className="text-label-sm text-[var(--text-tertiary)] mb-0.5">Control Panel</p>
                                <p className="text-title-sm text-[var(--text-primary)]">Guest Entry</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--c1rcle-orange)] group-hover:translate-x-1 transition-all" />
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="py-16 text-center border-2 border-dashed border-[var(--border-subtle)] rounded-2xl">
                    <Clock className="mx-auto mb-4 text-[var(--text-placeholder)]" size={48} />
                    <p className="text-body text-[var(--text-tertiary)]">Your venue is quiet tonight.</p>
                </div>
            )}
        </div>
    );
}
