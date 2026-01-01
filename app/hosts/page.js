"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "../../components/PageShell";
import HostCard, { HostSkeleton } from "../../components/hosts/HostCard";
import { VenueCard, CardSkeleton as VenueSkeleton } from "../../components/hosts/Cards";
import { Search, SlidersHorizontal, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";

const AREAS = ["Koregaon Park", "Baner", "Viman Nagar", "Kalyani Nagar", "FC Road", "Hinjewadi", "Wakad", "Shivajinagar"];
const VIBES = ["Techno", "Bollywood", "Hip-hop", "House", "Commercial", "Afro", "Trance", "Open format", "Lounge", "Rooftop"];
const ROLES = ["Promoter", "DJ", "Collective"];
const STATUSES = ["Verified", "Trending", "Popular"];
const SORTS = ["Popular", "Soonest event", "Most followed"];

export default function DiscoveryPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("venues"); // "venues" | "hosts"
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");

    // Filter states
    const [activeArea, setActiveArea] = useState(null);
    const [activeVibe, setActiveVibe] = useState(null);
    const [activeRole, setActiveRole] = useState(null);
    const [activeStatus, setActiveStatus] = useState(null);
    const [activeSort, setActiveSort] = useState("Popular");
    const [tablesOnly, setTablesOnly] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const endpoint = activeTab === "venues" ? "/api/venues" : "/api/hosts";
            const params = new URLSearchParams();
            if (search) params.append("search", search);
            if (activeVibe) params.append("vibe", activeVibe || "");
            if (activeSort) params.append("sort", activeSort);

            if (activeTab === "venues") {
                if (activeArea) params.append("area", activeArea);
                if (tablesOnly) params.append("tablesOnly", "true");
            } else {
                if (activeRole) params.append("role", activeRole);
                if (activeStatus) params.append("status", activeStatus);
            }

            const res = await fetch(`${endpoint}?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to load ${activeTab}`);
            const data = await res.json();
            setResults(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [activeTab, search, activeArea, activeVibe, activeRole, activeStatus, activeSort, tablesOnly]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchData]);

    const handleFollow = (id) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
                detail: { intent: `FOLLOW_${activeTab.toUpperCase()}`, targetId: id }
            }));
            return;
        }
    };

    const clearAll = () => {
        setSearch("");
        setActiveArea(null);
        setActiveVibe(null);
        setActiveRole(null);
        setActiveStatus(null);
        setTablesOnly(false);
        setActiveSort("Popular");
    };

    return (
        <PageShell>
            <div className="relative min-h-screen bg-[#0A0A0A]">
                {/* Hero Section */}
                <div className="relative pt-32 pb-12 overflow-hidden">
                    <div className="absolute inset-x-0 -top-40 -z-10 h-[500px] flex justify-center">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 10, repeat: Infinity }}
                            className="w-[800px] h-[800px] bg-orange/20 rounded-full blur-[120px]"
                        />
                    </div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
                        <div className="space-y-4">
                            <motion.h1
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter text-white"
                            >
                                Discover {activeTab}
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-white/50 text-sm md:text-lg font-bold uppercase tracking-[0.3em] max-w-2xl mx-auto"
                            >
                                {activeTab === "venues"
                                    ? "The spaces that set the pulse. Explore Pune's finest circuits."
                                    : "Curators, DJs, collectives. Follow the people who shape the night."}
                            </motion.p>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full w-fit mx-auto relative z-10">
                            {["venues", "hosts"].map((tab) => (
                                <motion.button
                                    key={tab}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        setActiveTab(tab);
                                        clearAll();
                                    }}
                                    className={`relative px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === tab ? "text-black" : "text-white/40 hover:text-white"
                                        }`}
                                >
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="tab-pill-discovery"
                                            className="absolute inset-0 bg-white rounded-full shadow-xl"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10">{tab}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Search Row - Sticky */}
                <div className="sticky top-[80px] z-40 bg-[#0A0A0A]/80 backdrop-blur-xl border-y border-white/5 py-4 shadow-2xl shadow-black/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <Search size={20} className="text-white/20 group-focus-within:text-orange transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={`Search ${activeTab} by name, area, vibe...`}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white text-base focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange transition-all placeholder:text-white/10"
                            />
                        </div>
                    </div>
                </div>

                {/* Filters Row - Sticky */}
                <div className="sticky top-[174px] z-30 bg-[#0A0A0A]/50 backdrop-blur-md border-b border-white/5 py-3 shadow-xl">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x">
                            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                                <SlidersHorizontal size={14} />
                                Filter
                            </div>

                            <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

                            {activeTab === "venues" ? (
                                <>
                                    <button
                                        onClick={() => setTablesOnly(!tablesOnly)}
                                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all snap-center flex-shrink-0 border ${tablesOnly ? "bg-orange border-orange text-white" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                                            }`}
                                    >
                                        Tables Available
                                    </button>
                                    <FilterGroup label="Area" items={AREAS} active={activeArea} setActive={setActiveArea} />
                                    <FilterGroup label="Vibe" items={VIBES} active={activeVibe} setActive={setActiveVibe} />
                                </>
                            ) : (
                                <>
                                    <FilterGroup label="Role" items={ROLES} active={activeRole} setActive={setActiveRole} />
                                    <FilterGroup label="Vibe" items={VIBES} active={activeVibe} setActive={setActiveVibe} />
                                    <FilterGroup label="Status" items={STATUSES} active={activeStatus} setActive={setActiveStatus} />
                                </>
                            )}

                            <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                            <FilterGroup label="Sort" items={SORTS} active={activeSort} setActive={setActiveSort} isSort />

                            {(activeArea || activeVibe || activeRole || activeStatus || search || tablesOnly) && (
                                <button
                                    onClick={clearAll}
                                    className="px-6 py-2 rounded-full bg-orange/10 border border-orange/20 text-[10px] font-black uppercase tracking-widest text-orange hover:bg-orange hover:text-white transition-all ml-4 flex-shrink-0"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results Grid */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {loading && results.length === 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {activeTab === "hosts"
                                ? [1, 2, 3, 4, 5, 6].map(i => <HostSkeleton key={i} />)
                                : [1, 2, 3, 4, 5, 6].map(i => <VenueSkeleton key={i} />)
                            }
                        </div>
                    ) : error ? (
                        <div className="py-20 text-center space-y-6">
                            <div className="text-orange text-4xl">⚠️</div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Syncing error</h3>
                            <p className="text-white/40 text-sm">{error}</p>
                            <button onClick={fetchData} className="px-8 py-3 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest">Retry</button>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-32 text-center space-y-6 max-w-md mx-auto">
                            <div className="text-6xl mb-4 opacity-50">🌑</div>
                            <h3 className="text-3xl font-heading font-black text-white uppercase tracking-tighter">Quiet Night</h3>
                            <p className="text-white/40 text-sm font-medium">No {activeTab} match these filters.</p>
                            <button onClick={clearAll} className="px-10 py-4 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest shadow-glow">Reset Discovery</button>
                        </div>
                    ) : (
                        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            <AnimatePresence mode="popLayout">
                                {results.map((item, idx) => (
                                    <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        {activeTab === "hosts"
                                            ? <HostCard host={item} index={idx} onFollow={handleFollow} />
                                            : <VenueCard venue={item} onFollow={handleFollow} />
                                        }
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
                <div className="py-20" />
            </div>
        </PageShell>
    );
}

function FilterGroup({ label, items, active, setActive, isSort = false }) {
    return (
        <div className="flex items-center gap-2 flex-shrink-0">
            {items.map(item => (
                <button
                    key={item}
                    onClick={() => setActive(active === item && !isSort ? null : item)}
                    className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all snap-center flex-shrink-0 border ${active === item
                            ? "bg-white text-black border-white"
                            : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                        }`}
                >
                    {item}
                </button>
            ))}
        </div>
    );
}
