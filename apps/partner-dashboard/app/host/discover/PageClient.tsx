"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoveryView } from "@/components/discovery/DiscoveryView";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { Building2, Users, TrendingUp } from "lucide-react";

export default function HostDiscoverPage() {
    const { profile } = useDashboardAuth();
    const hostId = profile?.activeMembership?.partnerId;

    return (
        <VenuePageShell
            title="Explore Venues"
            subtitle="Discover and connect with verified venues across The C1rcle network"
        >
            <div className="space-y-10">
                {/* Stats strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: Building2, label: "Venues on C1rcle", value: "50+", color: "var(--v-info)" },
                        { icon: Users, label: "Cities Covered", value: "4", color: "var(--v-orange)" },
                        { icon: TrendingUp, label: "Avg. Booking Lift", value: "30%", color: "var(--v-success)" },
                    ].map(stat => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.label} className="flex items-center gap-5 p-8 rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)]">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-border-subtle shadow-xl" style={{ background: `${stat.color}10` }}>
                                    <Icon className="w-7 h-7" style={{ color: stat.color }} />
                                </div>
                                <div>
                                    <p className="text-3xl font-black text-text-primary tabular-nums tracking-tight">{stat.value}</p>
                                    <p className="text-[13px] text-[var(--v-text-tertiary)] font-black uppercase tracking-[0.1em]">{stat.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DiscoveryView
                    allowedTypes={["venue", "promoter"]}
                    partnerId={hostId}
                    role="host"
                />
            </div>
        </VenuePageShell>
    );
}
