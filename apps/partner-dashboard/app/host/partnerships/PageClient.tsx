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
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-default pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-text-primary tracking-tight uppercase">Venue Network</h1>
                    <p className="text-text-tertiary text-lg font-medium mt-2">Manage your verified venue partnerships and slot permissions.</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/host/events/requests"
                        className="flex items-center gap-3 px-6 py-4 bg-surface-elevated border border-border-default hover:border-border-strong text-text-secondary text-sm font-bold rounded-2xl transition-all shadow-sm hover:shadow-md"
                    >
                        <Clock className="w-5 h-5" />
                        My Requests
                    </Link>
                    <Link
                        href="/host/discover"
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-text-primary text-sm font-bold rounded-2xl transition-all shadow-xl shadow-indigo-100 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Discover New Venues
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Active Partnerships */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xs font-black text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Active Partners ({activePartnerships.length})
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activePartnerships.map(p => (
                            <div key={p.id} className="bg-surface-elevated border border-border-default rounded-[2.5rem] p-8 hover:border-border-strong hover:shadow-xl hover:shadow-slate-100 transition-all group">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="h-16 w-16 bg-surface-tertiary rounded-2xl flex items-center justify-center text-text-tertiary group-hover:text-indigo-600 transition-colors">
                                        <Building2 className="w-8 h-8" />
                                    </div>
                                    <button className="text-text-placeholder hover:text-text-primary"><MoreHorizontal className="w-5 h-5" /></button>
                                </div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">{p.venueName}</h3>
                                <div className="flex items-center gap-2 text-xs font-bold text-text-tertiary mb-6">
                                    <MapPin className="w-3.5 h-3.5" /> {p.venueCity || "Pune"}, IN
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedVenue({ id: p.venueId, name: p.venueName })}
                                        className="flex-1 py-3 bg-surface-secondary hover:bg-surface-tertiary text-text-primary rounded-xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Calendar className="w-4 h-4" />
                                        Request Slot
                                    </button>
                                    <button className="px-4 py-3 bg-surface-tertiary hover:bg-surface-secondary text-text-secondary rounded-xl transition-colors">
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {activePartnerships.length === 0 && (
                            <div className="md:col-span-2 py-20 bg-surface-tertiary rounded-[3rem] border border-dashed border-border-default flex flex-col items-center text-center px-10">
                                <Building2 className="w-12 h-12 text-text-placeholder mb-4" />
                                <h4 className="text-lg font-bold text-text-primary">No active venues</h4>
                                <p className="text-text-tertiary text-sm font-medium mt-1 max-w-xs">You need a verified partnership to see club calendars and book slots.</p>
                                <Link
                                    href="/host/discover"
                                    className="mt-6 px-6 py-3 bg-indigo-600 text-text-primary rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    Find Venues
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending Requests */}
                <div className="space-y-6">
                    <h2 className="text-xs font-black text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" /> Pending Approval ({pendingPartnerships.length})
                    </h2>

                    <div className="space-y-4">
                        {pendingPartnerships.map(p => (
                            <div key={p.id} className="bg-surface-elevated border border-border-default rounded-[2rem] p-6 flex items-center justify-between border-l-4 border-l-amber-400">
                                <div>
                                    <h4 className="font-bold text-text-primary uppercase text-sm">{p.venueName}</h4>
                                    <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mt-0.5">Requested {new Date(p.createdAt?.toDate?.() || p.createdAt).toLocaleDateString()}</p>
                                </div>
                                <AlertCircle className="w-5 h-5 text-amber-200" />
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions Card */}
                    <div className="p-6 bg-surface-elevated border border-border-default rounded-[2rem] space-y-4">
                        <h4 className="font-black uppercase tracking-widest text-[10px] text-text-tertiary">Quick Actions</h4>
                        <Link
                            href="/host/events/requests"
                            className="flex items-center justify-between p-4 bg-surface-tertiary rounded-xl hover:bg-surface-secondary transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-primary">View Slot Requests</p>
                                    <p className="text-xs text-text-tertiary">Track pending approvals</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-placeholder" />
                        </Link>
                    </div>

                    <div className="p-8 bg-indigo-900 rounded-[2.5rem] text-text-primary shadow-2xl shadow-indigo-200">
                        <h4 className="font-black uppercase tracking-widest text-[10px] text-text-placeholder mb-4">Pro Tip</h4>
                        <p className="text-sm font-medium leading-relaxed italic">
                            "Venues are more likely to approve hosts with a high profile completion and previous successful events."
                        </p>
                        <Link href="/host/profile" className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-primary group">
                            Polish Profile <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
