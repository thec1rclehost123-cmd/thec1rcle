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
            <div className="py-24 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />
                <Loader2 className="h-12 w-12 text-orange-500 animate-spin mb-6" />
                <p className="text-text-tertiary font-black uppercase tracking-[0.2em] text-[10px]">Connecting to Entry Grid...</p>
            </div>
        );
    }

    if (!data?.event) {
        return (
            <div className="py-24 flex flex-col items-center text-center relative overflow-hidden bg-surface-secondary dark:bg-[#121216] rounded-[3rem] border border-border-subtle">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />
                <div className="relative h-20 w-20 bg-surface-tertiary dark:bg-gradient-to-br dark:from-[#1a1a1f] dark:to-[#0f0f12] rounded-[2rem] flex items-center justify-center mb-8 border border-border-subtle shadow-2xl">
                    <Monitor className="h-8 w-8 text-text-tertiary" />
                </div>
                <h3 className="text-2xl font-black text-text-primary mb-2 uppercase tracking-tight">No Active Entry Stream</h3>
                <p className="text-text-tertiary text-[13px] font-medium mb-10 max-w-sm mx-auto leading-relaxed">Live scanning stats will appear here when your production goes live.</p>
            </div>
        );
    }

    const checkInRate = data.stats.ticketsSold > 0
        ? Math.round((data.stats.checkedIn / data.stats.ticketsSold) * 100)
        : 0;

    return (
        <div className="space-y-6 pb-16 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-subtle pb-8">
                <div>
                    <div className="flex items-center gap-1.5 text-emerald-500 mb-3 uppercase tracking-[0.2em] font-black text-[9px] bg-emerald-500/10 w-fit px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                        </span>
                        Live Stream Active
                    </div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">
                        {data.event.title}
                    </h1>
                    <p className="text-text-tertiary text-[13px] font-medium mt-2">{data.event.venue} • Entry Monitor</p>
                </div>
                <div className="flex items-center gap-3 bg-surface-secondary border border-border-default px-5 py-3 rounded-2xl text-text-primary shadow-xl backdrop-blur-xl group">
                    <ShieldCheck className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[12px] font-black tracking-widest uppercase text-text-secondary">Venue Staff Sync Verified</span>
                </div>
            </div>

            {/* Live Counter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricBox
                    label="Turnout"
                    value={data.stats.checkedIn}
                    subValue={`out of ${data.stats.ticketsSold} confirmed`}
                    progress={checkInRate}
                    color="orange"
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
                    color="rose"
                />
            </div>

            {/* Activity Chart Placeholder */}
            <div className="bg-surface-secondary dark:bg-[#121216] rounded-3xl border border-border-subtle shadow-xl p-8 overflow-hidden relative group hover:border-border-default transition-colors">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-[15px] font-black text-text-primary uppercase tracking-widest flex items-center gap-3">
                        <Activity className="h-5 w-5 text-orange-500" />
                        Scanning Frequency
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]"></div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-tertiary">Guestlist</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-tertiary">Walk-ins</span>
                        </div>
                    </div>
                </div>

                <div className="h-[140px] w-full flex items-end gap-2 relative z-10">
                    {data.stats.scansPerHour.map((v: number, i: number) => (
                        <div
                            key={i}
                            style={{ height: `${v}%` }}
                            className="flex-1 bg-surface-secondary border border-border-default rounded-t-xl hover:bg-gradient-to-t hover:from-orange-500/20 hover:to-rose-500/10 hover:border-orange-500/30 transition-all group/bar relative cursor-help flex flex-col justify-end overflow-visible"
                        >
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface-elevated text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-2xl border border-border-default pointer-events-none transform group-hover/bar:-translate-y-1">
                                <span className="text-orange-400">{v}</span> Scans
                            </div>
                            <div className="w-full h-full bg-gradient-to-t from-orange-500/20 to-transparent opacity-0 group-hover/bar:opacity-100 transition-opacity backdrop-blur-sm" />
                        </div>
                    ))}
                </div>
                <div className="mt-8 pt-6 border-t border-border-subtle flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary relative z-10">
                    <span>20:00</span>
                    <span>21:00</span>
                    <span>22:00</span>
                    <span>23:00</span>
                    <span>00:00</span>
                    <span>01:00</span>
                </div>
            </div>

            {/* Warnings / Alerts Section */}
            <div className="bg-gradient-to-r from-orange-500/10 to-transparent rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-orange-500/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
                
                <div className="flex items-center gap-5 z-10">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <h4 className="text-[15px] font-black text-text-primary uppercase tracking-widest">Performance Mode</h4>
                        <p className="text-text-tertiary text-[12px] font-medium mt-1">Automated reports will be generated after the event concludes.</p>
                    </div>
                </div>
                <button className="z-10 px-6 py-3 bg-surface-secondary hover:bg-surface-tertiary border border-border-default text-text-primary rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap active:scale-95">
                    Full Analytics Log
                </button>
            </div>
        </div>
    );
}

function MetricBox({ label, value, subValue, progress, color }: any) {
    const colors: any = {
        orange: "bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.4)]",
        emerald: "bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]",
        rose: "bg-gradient-to-r from-rose-400 to-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.4)]"
    };

    return (
        <div className="bg-surface-secondary dark:bg-[#121216] p-6 rounded-3xl border border-border-subtle shadow-xl relative overflow-hidden group hover:border-border-default transition-all hover:-translate-y-1 duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-surface-tertiary blur-2xl rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-1000" />

            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary mb-3 relative z-10">{label}</p>
            <div className="flex items-baseline gap-2 mb-2 relative z-10">
                <span className="text-4xl font-black text-text-primary tracking-tighter leading-none">{value}</span>
            </div>
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest relative z-10">{subValue}</p>

            {progress !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-secondary">
                    <div
                        className={`h-full ${colors[color]} transition-all duration-1000 ease-out`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}
