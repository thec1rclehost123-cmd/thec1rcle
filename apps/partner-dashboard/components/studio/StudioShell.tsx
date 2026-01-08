"use client";

import { ReactNode, useState, useEffect } from "react";
import {
    Search,
    Calendar,
    ChevronDown,
    Activity,
    TrendingUp,
    Zap,
    DollarSign,
    Users,
    ShieldAlert,
    Handshake,
    ChevronRight,
    Play,
    Info,
    Clock
} from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface StudioShellProps {
    children: ReactNode;
    title: string;
    description: string;
    role: "venue" | "host" | "promoter";
    onRangeChange?: (range: string) => void;
    onEventChange?: (eventId: string | null) => void;
}

export default function StudioShell({
    children,
    title,
    description,
    role,
    onRangeChange,
    onEventChange
}: StudioShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [range, setRange] = useState("30d");
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [isEventSelectorOpen, setIsEventSelectorOpen] = useState(false);

    // Mock events for selector - in real implementation this would fetch from API
    const events = [
        { id: null, title: "Global (All Events)" },
        { id: "evt-1", title: "New Year's Eve 2025" },
        { id: "evt-2", title: "Techno Night Prototype" },
        { id: "evt-3", title: "Sunday Sundowner" },
    ];

    const currentEvent = events.find(e => e.id === selectedEventId) || events[0];

    const tabs = [
        { label: "Summary", href: `/${role}/analytics/overview`, icon: Activity },
        { label: "Timing", href: `/${role}/analytics/timeline`, icon: Clock },
        { label: "Demand", href: `/${role}/analytics/reach`, icon: TrendingUp },
        { label: "Turnout", href: `/${role}/analytics/engagement`, icon: Zap },
        { label: "Money", href: `/${role}/analytics/revenue`, icon: DollarSign },
        { label: "Crowd", href: `/${role}/analytics/audience`, icon: Users },
        { label: "Gate & Ops", href: `/${role}/analytics/ops`, icon: ShieldAlert },
        { label: "Partners", href: `/${role}/analytics/attribution`, icon: Handshake },
    ];




    const handleRangeChange = (newRange: string) => {
        setRange(newRange);
        onRangeChange?.(newRange);
    };

    const handleEventSelect = (eventId: string | null) => {
        setSelectedEventId(eventId);
        setIsEventSelectorOpen(false);
        onEventChange?.(eventId);
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
            {/* Studio Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 tracking-tighter text-xl">STATS</span>

                            <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                <Activity className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Running Well</span>
                            </div>

                        </div>

                        {/* Event Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setIsEventSelectorOpen(!isEventSelectorOpen)}
                                className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all group"
                            >
                                <div className="h-6 w-6 rounded-md bg-slate-900 flex items-center justify-center">
                                    <Play className="h-3 w-3 text-white fill-white" />
                                </div>
                                <span className="text-sm font-bold text-slate-900">{currentEvent.title}</span>
                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isEventSelectorOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isEventSelectorOpen && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in zoom-in duration-200">
                                    <div className="p-2">
                                        <div className="relative mb-2">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search events..."
                                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                                            />
                                        </div>
                                        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                                            {events.map(event => (
                                                <button
                                                    key={event.id || 'global'}
                                                    onClick={() => handleEventSelect(event.id)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedEventId === event.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {event.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            {[
                                { id: 'tonight', label: 'Tonight' },
                                { id: 'weekend', label: 'This Weekend' },
                                { id: '30d', label: 'Last 30 Nights' },
                                { id: 'all', label: 'All Time' }
                            ].map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => handleRangeChange(r.id)}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${range === r.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        <button className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform">
                            <Calendar className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Studio Tabs */}
                <div className="px-8 flex items-center gap-8">
                    {tabs.map(tab => {
                        const active = pathname === tab.href;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`relative py-4 text-sm font-black uppercase tracking-widest transition-colors ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {tab.label}
                                {active && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-900 rounded-t-full" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <header>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
                        <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                            {description}
                            <Info className="h-4 w-4 text-slate-300 cursor-help" />
                        </p>
                    </header>

                    {children}
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #CBD5E1;
                }
            `}</style>
        </div >
    );
}

