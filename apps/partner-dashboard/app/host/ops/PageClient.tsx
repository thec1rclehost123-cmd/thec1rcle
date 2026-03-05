"use client";

import { useEffect, useState } from "react";
import {
    Users,
    Ticket,
    Clock,
    Activity,
    Monitor,
    ArrowRight,
    Loader2,
    ShieldCheck,
    Zap,
    TrendingUp
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function HostOpsPage() {
    const { profile } = useDashboardAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOpsData = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const hostId = profile.activeMembership.partnerId;
                const res = await fetch(`/api/host/ops/tonight?hostId=${hostId}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error("Ops fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOpsData();
        const interval = setInterval(fetchOpsData, 30000); // Pulse every 30s
        return () => clearInterval(interval);
    }, [profile]);

    if (isLoading && !data) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Connecting to Entry Grid...</p>
            </div>
        );
    }

    if (!data?.event) {
        return (
            <div className="py-24 flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100">
                    <Monitor className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">No Active Entry Stream</h3>
                <p className="text-slate-500 text-sm font-medium mb-10 max-w-xs mx-auto">Live scanning stats will appear here when your production goes live.</p>
            </div>
        );
    }

    const checkInRate = data.stats.ticketsSold > 0
        ? Math.round((data.stats.checkedIn / data.stats.ticketsSold) * 100)
        : 0;

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div>
                    <div className="flex items-center gap-3 text-emerald-500 mb-3 uppercase tracking-widest font-black text-[10px]">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Live Stream Active
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight uppercase">
                        {data.event.title}
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-2">{data.event.venue} • Entry Monitor</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-900 px-8 py-4 rounded-2xl text-white shadow-xl shadow-slate-200">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-bold">Venue Staff Sync Verified</span>
                </div>
            </div>

            {/* Live Counter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <MetricBox
                    label="Turnout"
                    value={data.stats.checkedIn}
                    subValue={`out of ${data.stats.ticketsSold} confirmed`}
                    progress={checkInRate}
                    color="indigo"
                />
                <MetricBox
                    label="Saturation"
                    value={`${checkInRate}%`}
                    subValue="Peak occupancy approaching"
                    color="emerald"
                />
                <MetricBox
                    label="Entry Velocity"
                    value="Low"
                    subValue="14 guests / 10 min avg"
                    color="amber"
                />
            </div>

            {/* Activity Chart Placeholder */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-12 overflow-hidden relative">
                <div className="flex items-center justify-between mb-12">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                        <Activity className="h-6 w-6 text-indigo-500" />
                        Scanning Frequency
                    </h3>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guestlist</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Walk-ins</span>
                        </div>
                    </div>
                </div>

                <div className="h-[200px] w-full flex items-end gap-3">
                    {data.stats.scansPerHour.map((v: number, i: number) => (
                        <div
                            key={i}
                            style={{ height: `${v}%` }}
                            className="flex-1 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-900 transition-all group relative cursor-help"
                        >
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                {v} Scans
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                    <span>20:00</span>
                    <span>21:00</span>
                    <span>22:00</span>
                    <span>23:00</span>
                    <span>00:00</span>
                    <span>01:00</span>
                </div>
            </div>

            {/* Warnings / Alerts Section */}
            <div className="bg-slate-50 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <Zap className="h-8 w-8" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Performance Mode</h4>
                        <p className="text-slate-500 text-sm font-medium mt-1">Automated reports will be generated after the event concludes.</p>
                    </div>
                </div>
                <button className="px-10 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                    Full Analytics Log
                </button>
            </div>
        </div>
    );
}

function MetricBox({ label, value, subValue, progress, color }: any) {
    const colors: any = {
        indigo: "bg-indigo-600",
        emerald: "bg-emerald-500",
        amber: "bg-amber-500"
    };

    return (
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-all">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{label}</p>
            <div className="flex items-baseline gap-4 mb-2">
                <span className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{value}</span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{subValue}</p>

            {progress !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-50">
                    <div
                        className={`h-full ${colors[color]} transition-all duration-1000`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}
