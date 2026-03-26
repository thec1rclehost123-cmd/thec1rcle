"use client";

import { motion } from "framer-motion";
import { Building2, MapPin, ChevronRight, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export function VenueSelectionGrid() {
    const router = useRouter();
    const { profile } = useDashboardAuth();

    const venueId = profile?.activeMembership?.partnerId || "";
    const venueName = profile?.activeMembership?.partnerName || "Your Venue";
    const venueLogo = (profile?.activeMembership as any)?.partnerLogo || "";

    const handleVenueClick = () => {
        if (!venueId) return;
        const params = new URLSearchParams({
            venueId,
            venueName,
        });
        router.push(`/venue/create/select-venue/calendar?${params.toString()}`);
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">
                    Create Event
                </h1>
                <p className="text-text-tertiary mt-2 text-sm">
                    Select a venue to check availability and schedule your event
                </p>
            </div>

            {/* Venue Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Venue Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    onClick={handleVenueClick}
                    className="group relative cursor-pointer"
                >
                    <div className="relative overflow-hidden rounded-[2rem] bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10">
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-rose-600/0 group-hover:from-orange-500/5 group-hover:to-rose-600/5 transition-all duration-500" />

                        {/* Top accent bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative p-8">
                            {/* Venue Avatar */}
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-rose-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] flex items-center justify-center border border-white/10 shadow-xl overflow-hidden">
                                    {venueLogo ? (
                                        <img src={venueLogo} alt={venueName} className="h-full w-full object-cover" />
                                    ) : (
                                        <Building2 className="w-10 h-10 text-orange-500/60" />
                                    )}
                                </div>
                            </div>

                            {/* Venue Info */}
                            <h3 className="text-xl font-black text-text-primary tracking-tight mb-2 group-hover:text-orange-400 transition-colors duration-300">
                                {venueName}
                            </h3>

                            <div className="flex items-center gap-2 text-text-tertiary mb-6">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Venue Partner</span>
                            </div>

                            {/* Action hint */}
                            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                                <div className="flex items-center gap-2 text-text-tertiary">
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">View Calendar</span>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-orange-500/20 flex items-center justify-center transition-all duration-300">
                                    <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-orange-400 transition-colors duration-300" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
