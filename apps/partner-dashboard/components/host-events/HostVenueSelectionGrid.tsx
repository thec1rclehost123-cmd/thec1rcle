"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin, ChevronRight, Calendar, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export function HostVenueSelectionGrid() {
    const router = useRouter();
    const { profile, user } = useDashboardAuth();
    const [partnerships, setPartnerships] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken();
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
            },
        });
    }, [user]);

    useEffect(() => {
        const hostId = profile?.activeMembership?.partnerId;
        if (!hostId || !user) return;

        async function fetchPartnerships() {
            try {
                const res = await authedFetch(
                    `/api/discovery?action=list&partnerId=${hostId}&role=host`
                );
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                const connections: any[] = data.connections || [];
                const active = connections
                    .filter((c: any) => c.type === "partnership" && c.status === "active")
                    .map((c: any) => ({
                        id: c.id,
                        venueId: c.venueId || c.otherId,
                        venueName: c.venueName || c.otherName || "Partner Venue",
                        venueCity: c.venueCity || c.city || "",
                        venueLogo: c.venueLogo || null,
                    }));
                setPartnerships(active);
            } catch (err) {
                console.error("Failed to load partnerships:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        }
        fetchPartnerships();
    }, [profile, user, authedFetch]);

    const handleVenueClick = (venueId: string, venueName: string) => {
        if (!venueId) return;
        const params = new URLSearchParams({ venueId, venueName });
        router.push(`/host/create/select-venue/calendar?${params.toString()}`);
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight">
                    Create Event
                </h1>
                <p className="text-text-tertiary mt-2 text-sm">
                    Select a venue partner to check availability and schedule your event
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
            ) : error ? (
                <div className="py-24 bg-[var(--v-card)] rounded-[56px] border border-red-500/20 flex flex-col items-center text-center px-12 gap-4">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                    <div>
                        <h3 className="text-xl font-black text-text-primary">Failed to load partners</h3>
                        <p className="text-[var(--v-text-tertiary)] text-[14px] font-bold mt-2">Could not fetch your approved venues.</p>
                    </div>
                </div>
            ) : partnerships.length === 0 ? (
                <div className="py-32 bg-[var(--v-card)] rounded-[56px] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-12">
                    <div className="p-6 rounded-full bg-surface-tertiary mb-8">
                        <Building2 className="w-12 h-12 text-[var(--v-text-muted)]" />
                    </div>
                    <h3 className="text-3xl font-black text-text-primary tracking-tight">
                        No Active Partnerships
                    </h3>
                    <p className="text-[var(--v-text-tertiary)] text-[16px] font-bold mt-4 mb-10 max-w-md leading-relaxed">
                        You first need an approved partnership with a venue to request slots on their calendar. You can configure this in your Partners settings.
                    </p>
                    <button onClick={() => router.push('/host/network')} className="h-14 px-10 rounded-2xl bg-[var(--c1rcle-orange)] text-white text-[14px] font-black uppercase tracking-widest hover:bg-[var(--c1rcle-orange-dim)] transition-all">
                        Connect with Venues
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {partnerships.map((partnership, idx) => (
                        <motion.div
                            key={partnership.id || idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: idx * 0.05, ease: "easeOut" }}
                            onClick={() => handleVenueClick(partnership.venueId, partnership.venueName || "Partner Venue")}
                            className="group relative cursor-pointer"
                        >
                            <div className="relative overflow-hidden rounded-[2rem] bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10 h-full">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-red-600/0 group-hover:from-orange-500/5 group-hover:to-red-600/5 transition-all duration-500" />
                                <div className="h-1 w-full bg-gradient-to-r from-[var(--c1rcle-orange)] to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="relative p-8 flex flex-col h-full">
                                    <div className="relative mb-6">
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] flex items-center justify-center border border-white/10 shadow-xl overflow-hidden">
                                            {partnership.venueLogo ? (
                                                <img src={partnership.venueLogo} alt={partnership.venueName} className="h-full w-full object-cover" />
                                            ) : (
                                                <Building2 className="w-10 h-10 text-[var(--c1rcle-orange)]/60" />
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-black text-text-primary tracking-tight mb-2 group-hover:text-[var(--c1rcle-orange-light)] transition-colors duration-300">
                                        {partnership.venueName || "Partner Venue"}
                                    </h3>

                                    <div className="flex items-center gap-2 text-text-tertiary mb-6 flex-grow">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">{partnership.venueCity || "Venue Location"}</span>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] mt-auto">
                                        <div className="flex items-center gap-2 text-text-tertiary">
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider">Book Slot</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-orange-500/20 flex items-center justify-center transition-all duration-300">
                                            <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-[var(--c1rcle-orange-light)] transition-colors duration-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
