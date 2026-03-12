"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoveryView } from "@/components/discovery/DiscoveryView";
import { Sparkles, Info } from "lucide-react";

export default function HostDiscoverPage() {
    const { profile } = useDashboardAuth();
    const hostId = profile?.activeMembership?.partnerId;

    return (
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-5 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1.5 mb-1 text-blue-600">
                        <div className="p-1 bg-blue-50 rounded-md">
                            <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Explore</span>
                    </div>
                    <h1 className="text-xl font-bold text-text-primary tracking-tight">Discovery Network</h1>
                    <p className="text-text-tertiary text-[13px] font-medium mt-0.5 max-w-xl">
                        Find and partner with verified venues and promoters to expand your reach.
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="relative group overflow-hidden p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-border-default/60 shadow-sm transition-all hover:shadow-md">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                <Info className="w-3 h-3 text-indigo-600" />
                            </div>
                            <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-[0.1em]">Partnership Economics</h4>
                        </div>
                        <p className="text-text-secondary text-[12px] font-medium leading-relaxed">
                            Connect with <span className="text-text-primary font-bold">Venues</span> for Availability and <span className="text-text-primary font-bold">Promoters</span> for lift.
                        </p>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 ml-auto">
                        <div className="text-center">
                            <div className="text-lg font-bold text-text-primary leading-none">30%</div>
                            <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Avg. Lift</div>
                        </div>
                        <div className="w-px h-6 bg-surface-tertiary" />
                        <div className="text-center">
                            <div className="text-lg font-bold text-text-primary leading-none">∞</div>
                            <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Connections</div>
                        </div>
                    </div>
                </div>
            </div>

            <DiscoveryView
                allowedTypes={["venue", "promoter"]}
                partnerId={hostId}
                role="host"
            />
        </div>
    );
}

