"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    MapPin,
    Ticket,
    Users,
    ChevronLeft,
    Share2,
    ExternalLink,
    Settings,
    ShieldCheck,
    Globe,
    ToggleLeft,
    ToggleRight,
    Search,
    Check,
    Lock,
    Edit,
    AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function EventManagementPage() {
    const { id } = useParams();
    const { profile } = useDashboardAuth();
    const role = profile?.activeMembership?.role || 'owner'; // Fallback for safety
    const router = useRouter();

    const [event, setEvent] = useState<any>(null);
    const [promoters, setPromoters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview"); // overview, guestlist, promoters, settings
    const [isUpdating, setIsUpdating] = useState(false);
    const [promoterSearch, setPromoterSearch] = useState("");

    useEffect(() => {
        if (id) fetchEventData();
    }, [id]);

    const fetchEventData = async () => {
        setLoading(true);
        try {
            const [eventRes, promoterRes] = await Promise.all([
                fetch(`/api/events/${id}`),
                fetch(`/api/events/${id}/promoters`)
            ]);

            const eventData = await eventRes.json();
            const promoterData = await promoterRes.json();

            setEvent(eventData.event);
            setPromoters(promoterData.promoters || []);
        } catch (err) {
            console.error("Failed to fetch event data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePromoterAccess = async () => {
        setIsUpdating(true);
        try {
            const newEnabled = !event.promoterSettings?.enabled;
            const res = await fetch(`/api/events/${id}/promoters`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: newEnabled,
                    actor: { uid: profile?.uid, role: role }
                })
            });
            if (res.ok) {
                setEvent((prev: any) => ({
                    ...prev,
                    promoterSettings: { ...prev.promoterSettings, enabled: newEnabled }
                }));
            }
        } finally {
            setIsUpdating(false);
        }
    };

    const handleTogglePromoterSelection = async (promoterId: string) => {
        setIsUpdating(true);
        try {
            const currentIds = event.promoterSettings?.allowedPromoterIds || [];
            const newIds = currentIds.includes(promoterId)
                ? currentIds.filter((pid: string) => pid !== promoterId)
                : [...currentIds, promoterId];

            const res = await fetch(`/api/events/${id}/promoters`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    allowedPromoterIds: newIds,
                    actor: { uid: profile?.uid, role: role }
                })
            });
            if (res.ok) {
                setEvent((prev: any) => ({
                    ...prev,
                    promoterSettings: { ...prev.promoterSettings, allowedPromoterIds: newIds }
                }));
                // Update local promoters list state
                setPromoters(prev => prev.map(p =>
                    p.id === promoterId ? { ...p, isSelected: !p.isSelected } : p
                ));
            }
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400">Loading management console...</div>;
    if (!event) return <div className="p-12 text-center">Event not found.</div>;

    const filteredPromoters = promoters.filter(p =>
        p.name.toLowerCase().includes(promoterSearch.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header / Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${event.lifecycle === 'scheduled' || event.lifecycle === 'live'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-slate-100 text-slate-500'
                                }`}>
                                {event.lifecycle}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[12px] text-slate-500">{event.date}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{event.title}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href={`/club/create?id=${id}`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm bg-white hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Edit className="h-4 w-4" />
                        Edit Details
                    </Link>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        <Share2 className="h-4 w-4" />
                        Share Link
                    </button>
                    <a
                        href={`https://thec1rcle.in/e/${id}`}
                        target="_blank"
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                        title="View on Website"
                    >
                        <Globe className="h-5 w-5" />
                    </a>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
                {["overview", "guestlist", "promoters", "settings"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${activeTab === tab
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === "overview" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                {/* Insights Card */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                                    <h3 className="text-xl font-bold mb-6">Real-time Insights</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Views</p>
                                            <p className="text-3xl font-bold text-slate-900">{event.stats?.views || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Interested</p>
                                            <p className="text-3xl font-bold text-slate-900">{event.stats?.saves || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sales</p>
                                            <p className="text-3xl font-bold text-slate-900">0</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                                            <p className="text-3xl font-bold text-slate-900">₹0</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Link previews/Quick Actions */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                <Globe className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-bold text-slate-900">Public Page</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-4">Your event is live at thec1rcle.in/e/{id}</p>
                                        <button className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline">
                                            Copy Link <ExternalLink className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                                <Users className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-bold text-slate-900">Guestlist</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-4">{event.settings?.showGuestlist ? "Enabled" : "Disabled"} - Guests can see who's coming</p>
                                        <button onClick={() => setActiveTab("settings")} className="text-emerald-600 font-bold text-sm hover:underline">Change Settings</button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Event Snapshot */}
                                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                    <img src={event.image} className="w-full aspect-video object-cover" alt="" />
                                    <div className="p-6">
                                        <h4 className="font-bold mb-2">{event.title}</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Calendar className="h-3.5 w-3.5" /> {event.date}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <MapPin className="h-3.5 w-3.5" /> {event.venue}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-3xl p-6 text-white text-center">
                                    <h4 className="font-bold mb-2">Need Help?</h4>
                                    <p className="text-xs text-slate-400 mb-4">Our partner support team is available 24/7 for event emergencies.</p>
                                    <button className="w-full py-2.5 bg-white text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all">Support Chat</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "promoters" && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">Promoter Network</h3>
                                        <p className="text-sm text-slate-500">Enable selected promoters to generate affiliate links and track their sales conversions.</p>
                                    </div>
                                    <button
                                        onClick={handleTogglePromoterAccess}
                                        disabled={isUpdating}
                                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all ${event.promoterSettings?.enabled
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                            : 'bg-slate-100 text-slate-600'
                                            }`}
                                    >
                                        {event.promoterSettings?.enabled ? (
                                            <>
                                                <ToggleRight className="h-6 w-6" />
                                                Network Active
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft className="h-6 w-6" />
                                                Network Off
                                            </>
                                        )}
                                    </button>
                                </div>

                                {event.promoterSettings?.enabled ? (
                                    <div className="space-y-6">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={promoterSearch}
                                                onChange={(e) => setPromoterSearch(e.target.value)}
                                                placeholder="Search your promoter partners..."
                                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredPromoters.length > 0 ? (
                                                filteredPromoters.map(promoter => (
                                                    <div
                                                        key={promoter.id}
                                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${promoter.isSelected
                                                            ? 'bg-white border-emerald-200 shadow-sm'
                                                            : 'bg-white border-slate-100 hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                                                {promoter.name[0]}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900">{promoter.name}</p>
                                                                <p className="text-xs text-slate-500">Partnered</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleTogglePromoterSelection(promoter.id)}
                                                            disabled={isUpdating}
                                                            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${promoter.isSelected
                                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                                                                }`}
                                                        >
                                                            {promoter.isSelected ? (
                                                                <div className="flex items-center gap-1.5 font-black uppercase tracking-widest text-[10px]">
                                                                    <Check className="h-3.5 w-3.5" /> Selected
                                                                </div>
                                                            ) : 'Grant Access'}
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="col-span-2 py-12 text-center">
                                                    <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                                    <p className="text-slate-500">No promoters found in your database.</p>
                                                    <Link href="/club/connections" className="text-indigo-600 font-bold mt-2 inline-block">Build Network</Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                            <ShieldCheck className="h-10 w-10" />
                                        </div>
                                        <h4 className="text-2xl font-bold text-slate-900">Promoter Access is Locked</h4>
                                        <p className="text-slate-500 max-w-sm mx-auto">Toggle the active network switch above to allow promoters to generate tracking links for this event.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "guestlist" && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                            <h3 className="text-xl font-bold mb-2">Interested List</h3>
                            <p className="text-sm text-slate-500 mb-8">This list remains visible only to you. Guests cannot disable their appearance here.</p>

                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mb-6 text-amber-500">
                                    <Lock className="h-8 w-8" />
                                </div>
                                <h4 className="text-lg font-bold mb-1">Coming Soon: Guest Management</h4>
                                <p className="text-sm text-slate-500 max-w-xs">Detailed guest exports and direct messaging will be available in the next release.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === "settings" && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                            <h3 className="text-xl font-bold mb-6">Event Visibility Settings</h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between py-6 border-b border-slate-100">
                                    <div>
                                        <h4 className="font-bold">Public Guestlist</h4>
                                        <p className="text-sm text-slate-500">Allow guests on the website to see who else is attending.</p>
                                    </div>
                                    <button className="flex items-center gap-2 p-1 rounded-full bg-slate-100 scale-110">
                                        <div className={`h-6 w-12 rounded-full relative transition-all ${event.settings?.showGuestlist ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all ${event.settings?.showGuestlist ? 'right-1' : 'left-1'}`} />
                                        </div>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between py-6 border-b border-slate-100">
                                    <div>
                                        <h4 className="font-bold">Require Age Verification</h4>
                                        <p className="text-sm text-slate-500">Check for 21+ status before ticket purchase.</p>
                                    </div>
                                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                                        <AlertCircle className="h-4 w-4" /> Pro Feature
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
