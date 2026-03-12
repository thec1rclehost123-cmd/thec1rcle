"use client";

import { useState, useEffect } from "react";
import {
    Building2,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    MoreHorizontal,
    Plus,
    AlertCircle,
    ChevronRight,
    MapPin,
    Calendar,
    Eye
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { VenueCalendarPreview } from "@/components/host/VenueCalendarPreview";

export default function PartnershipsPage() {
    const router = useRouter();
    const { profile } = useDashboardAuth();
    const [partnerships, setPartnerships] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVenue, setSelectedVenue] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;
        fetchPartnerships();
    }, [profile]);

    const fetchPartnerships = async () => {
        try {
            const res = await fetch(`/api/venue/partnerships?hostId=${profile?.activeMembership?.partnerId}`);
            const data = await res.json();
            setPartnerships(data.partnerships || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSlot = (date: string, startTime: string, endTime: string) => {
        if (!selectedVenue) return;

        // Navigate to create event wizard with pre-filled venue and slot info
        const params = new URLSearchParams({
            venue: selectedVenue.id,
            venueName: selectedVenue.name,
            date,
            startTime,
            endTime
        });

        router.push(`/host/create?${params.toString()}`);
    };

    const activePartnerships = partnerships.filter(p => p.status === 'active');
    const pendingPartnerships = partnerships.filter(p => p.status === 'pending');

    return (
        <div className="space-y-4 pb-16 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.04] pb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">Venue Network</h1>
                    <p className="text-white/40 text-[13px] font-medium mt-2 max-w-xl">Manage your verified venue partnerships and slot permissions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/host/events/requests"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] text-white transition-all active:scale-95 shadow-sm"
                    >
                        <Clock className="w-3.5 h-3.5 opacity-60" />
                        My Requests
                    </Link>
                    <Link
                        href="/host/discover"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Discover Venues
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                {/* Active Partnerships */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
                            Active Partners ({activePartnerships.length})
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activePartnerships.map(p => (
                            <div key={p.id} className="relative overflow-hidden bg-[#121216] border border-white/[0.04] rounded-[2rem] p-6 group transition-all duration-300 hover:border-orange-500/20 hover:shadow-2xl hover:shadow-orange-500/5">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                
                                <div className="relative flex items-start justify-between mb-5">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] border border-white/5 rounded-2xl flex items-center justify-center text-text-tertiary shadow-lg group-hover:text-orange-500 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <button className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-white/40 flex items-center justify-center transition-all">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </div>
                                <h3 className="relative text-lg font-black text-white uppercase tracking-tight mb-1">{p.venueName}</h3>
                                <div className="relative flex items-center gap-1.5 text-[11px] font-bold text-text-tertiary mb-5">
                                    <MapPin className="w-3 h-3 text-orange-500/60" /> {p.venueCity || "Pune"}, IN
                                </div>
                                <div className="relative flex gap-2">
                                    <button
                                        onClick={() => setSelectedVenue({ id: p.venueId, name: p.venueName })}
                                        className="flex-1 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 transition-all group/btn"
                                    >
                                        <Calendar className="w-3.5 h-3.5 text-orange-500" />
                                        Request Slot
                                    </button>
                                    <button className="h-[42px] px-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] text-white rounded-xl transition-all flex items-center justify-center">
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {activePartnerships.length === 0 && (
                            <div className="md:col-span-2 py-16 bg-[#0D0D0F] rounded-[2rem] border border-dashed border-white/[0.08] flex flex-col items-center text-center px-8 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />
                                <div className="absolute inset-0 bg-orange-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />
                                
                                <div className="relative w-16 h-16 bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] border border-white/5 rounded-2xl flex items-center justify-center text-white/40 shadow-2xl mb-4 group-hover:scale-110 transition-transform duration-500 group-hover:text-orange-500">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <h4 className="relative text-xl font-black text-white tracking-tight uppercase">No active venues</h4>
                                <p className="relative text-white/40 text-[13px] font-medium mt-2 max-w-sm leading-relaxed">You need a verified partnership to see club calendars and book slots.</p>
                                <Link
                                    href="/host/discover"
                                    className="relative mt-6 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                                >
                                    Find Venues
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending Requests & Sidebar */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
                                Pending ({pendingPartnerships.length})
                            </h2>
                        </div>

                        <div className="space-y-3">
                            {pendingPartnerships.map(p => (
                                <div key={p.id} className="bg-[#121216] border border-white/[0.04] rounded-[1.5rem] p-4 flex items-center justify-between border-l-4 border-l-orange-500 shadow-xl group hover:border-orange-500/20 transition-colors">
                                    <div>
                                        <h4 className="font-black text-white uppercase text-[13px] tracking-tight">{p.venueName}</h4>
                                        <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mt-1">Requested {new Date(p.createdAt?.toDate?.() || p.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <AlertCircle className="w-4 h-4 text-orange-500/60 group-hover:text-orange-500 transition-colors" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions Card */}
                    <div className="p-5 bg-[#121216] border border-white/[0.04] rounded-[2rem] space-y-4 shadow-xl">
                        <h4 className="font-black uppercase tracking-widest text-[10px] text-text-tertiary px-2">Quick Actions</h4>
                        <Link
                            href="/host/events/requests"
                            className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.02] hover:border-white/[0.06] rounded-[1.5rem] transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-[12px] bg-orange-500/10 flex items-center justify-center shadow-lg shadow-orange-500/5">
                                    <Eye className="w-4 h-4 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-black text-white tracking-tight">View Slot Requests</p>
                                    <p className="text-[11px] text-white/40 font-medium leading-none mt-1">Track pending approvals</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                        </Link>
                    </div>

                    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-[#121216] to-[#0D0D0F] border border-white/[0.05] rounded-[2rem] shadow-2xl group">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-rose-600/10 pointer-events-none" />
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        
                        <h4 className="relative font-black uppercase tracking-widest text-[10px] text-orange-500 mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Pro Tip
                        </h4>
                        <p className="relative text-[13px] font-medium leading-relaxed italic text-white/80">
                            "Venues prefer hosts with completed profiles and verified history."
                        </p>
                        <Link href="/host/profile" className="relative mt-5 inline-flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-[10px] font-black uppercase tracking-widest text-white group/btn transition-all">
                            Polish Profile <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Venue Calendar Preview Modal */}
            <AnimatePresence>
                {selectedVenue && (
                    <VenueCalendarPreview
                        venueId={selectedVenue.id}
                        venueName={selectedVenue.name}
                        hostId={profile?.activeMembership?.partnerId || ""}
                        onSelectSlot={handleSelectSlot}
                        onClose={() => setSelectedVenue(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
