"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoveryView } from "@/components/discovery/DiscoveryView";
import { Sparkles, Info } from "lucide-react";

export default function HostDiscoverPage() {
    const { profile } = useDashboardAuth();
    const hostId = profile?.activeMembership?.partnerId;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-blue-600">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-bold uppercase tracking-[0.2em]">Explore</span>
                    </div>
                    <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Discovery Network</h1>
                    <p className="text-slate-500 text-lg font-medium mt-2 max-w-xl">
                        Find and partner with verified clubs and promoters to expand your reach.
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="relative group overflow-hidden p-8 bg-gradient-to-br from-slate-50 to-white rounded-[2.5rem] border border-slate-200/60 shadow-sm transition-all hover:shadow-md">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <Info className="w-4 h-4 text-indigo-600" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-[0.1em]">Partnership Economics</h4>
                        </div>
                        <p className="text-slate-600 text-[15px] font-medium leading-relaxed">
                            Connect with <span className="text-slate-900 font-bold">Clubs</span> to unlock their Availability Calendar and request event slots.
                            Partner with <span className="text-slate-900 font-bold">Promoters</span> to give them access to your events and boost your conversion rates.
                        </p>
                    </div>

                    <div className="hidden lg:flex items-center gap-6 ml-auto">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-slate-900">30%</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avg. Lift</div>
                        </div>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="text-center">
                            <div className="text-2xl font-bold text-slate-900">Unlimited</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Connections</div>
                        </div>
                    </div>
                </div>
            </div>

            <DiscoveryView
                allowedTypes={["club", "promoter"]}
                partnerId={hostId}
                role="host"
            />
        </div>
    );
}

