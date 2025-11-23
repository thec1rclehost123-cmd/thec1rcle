"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    DollarSign,
    Ticket,
    Eye,
    Zap,
    Plus,
    ArrowRight,
    Settings,
    Users,
    Music,
    Crown,
    BarChart3,
    Share2,
    TrendingUp,
    Globe,
    LayoutGrid,
    Calendar as CalendarIcon,
    Download
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
    MetricCard,
    RevenueChart,
    DemographicsChart,
    GenderChart,
    GeoList,
    RealtimeTicker,
    StudioCard,
    QuickActionCard
} from "../../components/host/StudioComponents";
import {
    CrowdPredictionChart,
    TableBookingGrid,
    AICrowdInsight,
    PromoterLeaderboard,
    ArtistGigRequests,
    TicketTierList
} from "../../components/host/AdvancedStudioComponents";
import { useAuth } from "../../components/providers/AuthProvider";

export default function HostDashboard() {
    const { profile } = useAuth();
    const [activeMode, setActiveMode] = useState("club");

    const modes = [
        { id: "club", label: "Club Owner" },
        { id: "organizer", label: "Event Organizer" },
        { id: "promoter", label: "Promoter" },
        { id: "artist", label: "Artist" },
    ];

    return (
        <div className="max-w-[2000px] mx-auto space-y-10 pb-16">

            {/* Dashboard Header - Scaled Up */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h1 className="text-4xl font-heading font-bold text-white mb-2">Dashboard</h1>
                    <p className="text-[#888] text-base font-medium">Welcome back, {profile?.displayName}</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* Mode Switcher Pill */}
                    <div className="hidden md:flex bg-[#111] rounded-full p-1.5 border border-[#222]">
                        {modes.map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setActiveMode(mode.id)}
                                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activeMode === mode.id
                                    ? "bg-white text-black shadow-sm"
                                    : "text-[#666] hover:text-white"
                                    }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    <button className="flex items-center gap-2 px-5 py-2.5 bg-[#F44A22] text-white rounded-full font-bold text-xs hover:bg-[#D43A12] transition-colors shadow-lg shadow-[#F44A22]/20">
                        <Download className="w-3.5 h-3.5" />
                        Download Report
                    </button>
                </div>
            </div>

            {/* Bento Grid Layout - Scaled Up */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeMode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                    {/* --- LEFT COLUMN (Main Metrics & Chart) - Span 8 --- */}
                    <div className="lg:col-span-8 flex flex-col gap-8">

                        {/* Revenue Card (Large) */}
                        <StudioCard className="min-h-[500px] flex flex-col justify-between p-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-[#888] text-lg font-medium mb-3">Total Revenue</h3>
                                    <div className="flex items-end gap-5">
                                        <h2 className="text-6xl font-heading font-bold text-white tracking-tight">₹79,675</h2>
                                        <div className="px-4 py-1.5 bg-[#C6F432] text-black text-sm font-bold rounded-full mb-3 flex items-center gap-1.5">
                                            <TrendingUp className="w-4 h-4" />
                                            2.4%
                                        </div>
                                    </div>
                                    <p className="text-[#666] text-base mt-2">This month</p>
                                </div>

                                <div className="flex gap-3">
                                    {['Day', 'Week', 'Month'].map(r => (
                                        <button key={r} className={`px-5 py-2 rounded-full text-sm font-bold border ${r === 'Month' ? 'bg-white text-black border-white' : 'bg-transparent text-[#666] border-[#333]'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <RevenueChart />
                        </StudioCard>

                        {/* Secondary Metrics Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <MetricCard title="Active Guests" value="312" change="4.7%" icon={Users} delay={0.1} />
                            <MetricCard title="Ticket Sales" value="1,240" change="12%" icon={Ticket} delay={0.2} />
                            <MetricCard title="Bar Revenue" value="₹18.4k" change="8%" icon={Zap} delay={0.3} />
                        </div>

                        {/* Bottom Row: Popular Events & Demographics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <StudioCard delay={0.4} className="p-8">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-white text-xl font-bold">Popular Events</h3>
                                    <button className="text-[#666] text-sm font-bold hover:text-white">View All</button>
                                </div>
                                <div className="space-y-5">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-5 p-4 rounded-2xl bg-[#111] border border-[#222]">
                                            <div className="w-14 h-14 rounded-xl bg-[#222] flex items-center justify-center text-[#666]">
                                                <CalendarIcon className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-white font-bold text-base">Neon Jungle Night</h4>
                                                <p className="text-[#666] text-sm">Fri, 24 Nov • 10 PM</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-bold text-base">342</p>
                                                <p className="text-[#666] text-xs">Guests</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </StudioCard>

                            <StudioCard delay={0.5} className="p-8">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-white text-xl font-bold">Age Range</h3>
                                </div>
                                <DemographicsChart />
                                <div className="mt-8 flex justify-center gap-8">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[#F44A22]" />
                                        <span className="text-[#666] text-xs font-bold">21-25</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-[#C6F432]" />
                                        <span className="text-[#666] text-sm font-bold">25-30</span>
                                    </div>
                                </div>
                            </StudioCard>
                        </div>
                    </div>

                    {/* --- RIGHT COLUMN (Calendar, Map, Stats) - Span 4 --- */}
                    <div className="lg:col-span-4 flex flex-col gap-8">

                        {/* Calendar / Date Picker Widget */}
                        <StudioCard className="p-8 bg-[#111] border-[#222]">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-white text-xl font-bold">November 2025</h3>
                                <button className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center text-[#666] hover:text-white hover:border-white transition-colors">
                                    <ArrowRight className="w-5 h-5 rotate-[-45deg]" />
                                </button>
                            </div>
                            {/* Simple Calendar Grid Visualization */}
                            <div className="grid grid-cols-7 gap-3 text-center mb-4">
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                                    <span key={d} className="text-[#666] text-sm font-bold">{d}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-3">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
                                    <div key={d} className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${d === 24 ? 'bg-[#F44A22] text-white shadow-lg shadow-[#F44A22]/30' :
                                        d === 18 ? 'bg-[#222] text-white border border-[#444]' :
                                            'text-[#666] hover:bg-[#222] hover:text-white transition-colors'
                                        }`}>
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 pt-8 border-t border-[#222]">
                                <div className="flex justify-between items-center">
                                    <span className="text-[#888] text-base font-medium">Total Sales</span>
                                    <span className="text-3xl font-heading font-bold text-white">₹18,434</span>
                                </div>
                            </div>
                        </StudioCard>

                        {/* Gender Stats */}
                        <StudioCard className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-white text-xl font-bold">Gender Split</h3>
                            </div>
                            <GenderChart />
                        </StudioCard>

                        {/* Geo Map */}
                        <StudioCard className="flex-1 p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-white text-xl font-bold">Top Locations</h3>
                                <Globe className="w-5 h-5 text-[#666]" />
                            </div>
                            <GeoList />
                        </StudioCard>

                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
