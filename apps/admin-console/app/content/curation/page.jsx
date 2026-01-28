"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Search,
    Filter,
    Star,
    TrendingUp,
    Zap,
    Plus,
    X,
    Calendar,
    Clock,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Loader2
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import { mapEventForClient } from "@c1rcle/core/events";

export default function AdminCuration() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [spotlights, setSpotlights] = useState({
        featured: [],
        selects: [],
        trending: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("live"); // live, upcoming, ended
    const [modalConfig, setModalConfig] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await user.getIdToken();

            // Fetch All Events
            const eventsRes = await fetch('/api/list?collection=events&limit=300', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const eventsJson = await eventsRes.json();
            const mapped = (eventsJson.data || []).map(e => mapEventForClient(e, e.id));
            setEvents(mapped);

            // Fetch Spotlights Config
            const configRes = await fetch('/api/list?collection=platform_settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const configJson = await configRes.json();
            const spotlightDoc = configJson.data?.find(d => d.id === 'spotlights');

            if (spotlightDoc) {
                setSpotlights({
                    featured: spotlightDoc.featured || [],
                    selects: spotlightDoc.selects || [],
                    trending: spotlightDoc.trending || []
                });
            }
        } catch (err) {
            console.error("Failed to fetch curation data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const handleSave = async (reason) => {
        setSaving(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'DATABASE_CORRECTION',
                    targetId: 'platform_settings',
                    reason,
                    params: {
                        id: 'spotlights',
                        after: spotlights
                    }
                })
            });

            if (!res.ok) throw new Error("Save failed");
            alert("Curation published successfully.");
            setModalConfig(null);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const toggleSpotlight = (id, bucket) => {
        setSpotlights(prev => {
            const current = prev[bucket] || [];
            const exists = current.includes(id);
            if (exists) {
                return { ...prev, [bucket]: current.filter(eid => eid !== id) };
            } else {
                return { ...prev, [bucket]: [...current, id] };
            }
        });
    };

    const now = new Date();

    // Sort events by recency (Soonest upcoming first)
    const sortedEvents = [...events].sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate) : (a.startTime ? new Date(a.startTime) : new Date(8640000000000000));
        const dateB = b.startDate ? new Date(b.startDate) : (b.startTime ? new Date(b.startTime) : new Date(8640000000000000));
        return dateA - dateB;
    });

    const filteredEvents = sortedEvents.filter(e => {
        const matchesSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.id?.toLowerCase().includes(searchTerm.toLowerCase());

        const startDate = e.startDate ? new Date(e.startDate) : (e.startTime ? new Date(e.startTime) : null);
        const endDate = e.endDate ? new Date(e.endDate) : (e.endTime ? new Date(e.endTime) : (startDate));

        // Validation: No Drafts and MUST have a real poster (not the default placeholder)
        const isDraft = e.lifecycle === 'draft' || e.status === 'draft';
        const hasRealPoster = e.poster && !e.poster.includes('placeholder.svg');

        let statusMatch = false;
        if (activeTab === 'live') {
            // "Published" = Public lifecycle + has poster + NOT a draft + hasn't ended yet
            statusMatch = (e.lifecycle === 'live' || e.lifecycle === 'scheduled') &&
                (!endDate || endDate >= now) &&
                !isDraft &&
                hasRealPoster;
        } else if (activeTab === 'ended') {
            statusMatch = (endDate && endDate < now) || e.lifecycle === 'completed' || e.lifecycle === 'past';
        } else if (activeTab === 'all') {
            statusMatch = true;
        }

        return matchesSearch && statusMatch;
    });

    const getEventById = (id) => events.find(e => e.id === id);

    if (loading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 text-iris animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Retrieving Registry...</p>
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-iris" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Authority / Curation Orchestrator</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Registry Spotlights</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Hand-pick experiences for global featured slots across the mobile app and user website.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setModalConfig({
                            title: "Publish Spotlights",
                            message: "This will immediately update Featured, Circle Select, and Trending sections across all platforms.",
                            label: "Push Curation Live"
                        })}
                        className="h-10 px-6 rounded-xl bg-iris text-white text-[11px] font-bold uppercase tracking-widest hover:bg-iris/90 transition-all flex items-center gap-2 shadow-lg shadow-iris/20"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                        Publish Live
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Search & List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by title, artist or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-iris/50 transition-all font-medium placeholder:text-zinc-600"
                            />
                        </div>
                        <div className="flex bg-obsidian-surface border border-[#ffffff08] rounded-xl p-1">
                            {['live', 'ended', 'all'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {tab === 'live' ? 'Published' : tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-obsidian-surface rounded-2xl border border-[#ffffff08] overflow-hidden">
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-obsidian-surface z-10">
                                    <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Experience</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Lifecycle</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Promote To</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ffffff05]">
                                    {filteredEvents.length > 0 ? filteredEvents.map((event) => (
                                        <tr key={event.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {event.poster ? (
                                                            <img src={event.poster} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                        ) : (
                                                            <Calendar className="h-5 w-5 text-zinc-700" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight mt-0.5">{event.location || event.city}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${event.lifecycle === 'live' ? 'bg-emerald-500' : (event.lifecycle === 'scheduled' ? 'bg-iris' : 'bg-zinc-700')}`} />
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${event.lifecycle === 'live' ? 'text-white' : 'text-zinc-500'}`}>{event.lifecycle}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => toggleSpotlight(event.id, 'featured')}
                                                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${spotlights.featured.includes(event.id) ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' : 'bg-white/5 text-zinc-500 border border-transparent hover:bg-white/10'}`}
                                                        title="Featured Drops"
                                                    >
                                                        <Star className="h-4 w-4" fill={spotlights.featured.includes(event.id) ? "currentColor" : "none"} strokeWidth={1.5} />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleSpotlight(event.id, 'selects')}
                                                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${spotlights.selects.includes(event.id) ? 'bg-iris/20 text-iris border border-iris/20' : 'bg-white/5 text-zinc-500 border border-transparent hover:bg-white/10'}`}
                                                        title="Circle Select"
                                                    >
                                                        <Zap className="h-4 w-4" fill={spotlights.selects.includes(event.id) ? "currentColor" : "none"} strokeWidth={1.5} />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleSpotlight(event.id, 'trending')}
                                                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${spotlights.trending.includes(event.id) ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-zinc-500 border border-transparent hover:bg-white/10'}`}
                                                        title="Trending App"
                                                    >
                                                        <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="px-6 py-20 text-center text-zinc-600 italic">No events found for this criteria.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Selection Buckets Review */}
                <aside className="lg:col-span-4 space-y-6">
                    <div className="bg-obsidian-surface border border-[#ffffff08] rounded-2xl p-6 shadow-xl sticky top-28">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center justify-between">
                            Active Spotlights
                            <span className="px-2 py-0.5 rounded bg-iris/10 text-iris text-[9px] font-bold uppercase tracking-widest">
                                {spotlights.featured.length + spotlights.selects.length + spotlights.trending.length} Total
                            </span>
                        </h3>

                        <div className="space-y-8">
                            {/* Featured */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white">Featured Drops</p>
                                </div>
                                <div className="space-y-2">
                                    {spotlights.featured.length > 0 ? spotlights.featured.map(id => {
                                        const e = getEventById(id);
                                        return (
                                            <div key={id} className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between group">
                                                <span className="text-xs text-zinc-300 font-medium truncate pr-4">{e?.title || id.slice(0, 8)}</span>
                                                <button onClick={() => toggleSpotlight(id, 'featured')} className="h-5 w-5 flex items-center justify-center text-zinc-600 hover:text-white transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-[10px] text-zinc-700 italic px-1">Curate a drop to show on homepage.</p>
                                    )}
                                </div>
                            </div>

                            {/* Circle Select */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Zap className="h-3 w-3 text-iris" fill="currentColor" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white">Circle Select (Web)</p>
                                </div>
                                <div className="space-y-2">
                                    {spotlights.selects.length > 0 ? spotlights.selects.map(id => {
                                        const e = getEventById(id);
                                        return (
                                            <div key={id} className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between group">
                                                <span className="text-xs text-zinc-300 font-medium truncate pr-4">{e?.title || id.slice(0, 8)}</span>
                                                <button onClick={() => toggleSpotlight(id, 'selects')} className="h-5 w-5 flex items-center justify-center text-zinc-600 hover:text-white transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-[10px] text-zinc-700 italic px-1">Pin events to the "Selects" grid.</p>
                                    )}
                                </div>
                            </div>

                            {/* Trending */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white">Trending App</p>
                                </div>
                                <div className="space-y-2">
                                    {spotlights.trending.length > 0 ? spotlights.trending.map(id => {
                                        const e = getEventById(id);
                                        return (
                                            <div key={id} className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between group">
                                                <span className="text-xs text-zinc-300 font-medium truncate pr-4">{e?.title || id.slice(0, 8)}</span>
                                                <button onClick={() => toggleSpotlight(id, 'trending')} className="h-5 w-5 flex items-center justify-center text-zinc-600 hover:text-white transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-[10px] text-zinc-700 italic px-1">Manual boost for discovery feed.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 pt-6 border-t border-[#ffffff05] text-center">
                            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50 uppercase">Authority Manual Selection Active.</p>
                        </div>
                    </div>
                </aside>
            </div>

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={confirmAction => handleSave(confirmAction)}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type="danger"
                    isTier3={false}
                />
            )}
        </div>
    );
}
