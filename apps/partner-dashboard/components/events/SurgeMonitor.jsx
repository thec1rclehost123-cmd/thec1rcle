"use client";

import { useEffect, useState } from "react";
import {
    Zap,
    ZapOff,
    Users,
    UserPlus,
    BarChart3,
    AlertCircle,
    Activity,
    ShieldAlert,
    TrendingUp,
    LogOut
} from "lucide-react";

/**
 * THE C1RCLE - Surge Monitor (Phase 2 Hardened)
 * Includes Live Queue Monitoring + Surge Autopsy Analytics
 */
export default function SurgeMonitor({ eventId }) {
    const [surgeData, setSurgeData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchSurgeData = async () => {
        try {
            const res = await fetch(`/api/events/${eventId}/surge`);
            if (res.ok) {
                const data = await res.json();
                setSurgeData(data);
            }
        } catch (err) {
            console.error("Failed to fetch surge data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSurgeData();
        const interval = setInterval(fetchSurgeData, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, [eventId]);

    const handleToggle = async (enabled) => {
        setIsUpdating(true);
        try {
            await fetch(`/api/events/${eventId}/surge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggle", enabled })
            });
            await fetchSurgeData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAdmit = async (count) => {
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/events/${eventId}/surge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "admit", count })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await fetchSurgeData();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) return null;

    const isSurging = surgeData?.status === "surge";
    const analytics = surgeData?.analytics;

    return (
        <div className={`rounded-[2.5rem] p-10 border transition-all duration-500 overflow-hidden relative ${isSurging
            ? "bg-rose-50 border-rose-100 shadow-xl shadow-rose-100/50"
            : "bg-slate-50 border-slate-100"
            }`}>
            {/* Background Glow */}
            {isSurging && (
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-200/50 blur-[100px] rounded-full animate-pulse" />
            )}

            <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                    <div className="flex items-center gap-6">
                        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${isSurging ? "bg-rose-600 text-white scale-110" : "bg-slate-200 text-slate-400"
                            }`}>
                            {isSurging ? <Zap className="h-8 w-8 animate-pulse" /> : <ZapOff className="h-8 w-8" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className={`text-xl font-black uppercase tracking-tight ${isSurging ? "text-rose-900" : "text-slate-900"
                                    }`}>
                                    Surge Infrastructure
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${isSurging ? "bg-rose-600 text-white" : "bg-slate-300 text-white"
                                    }`}>
                                    {isSurging ? "Active Throttling" : "Normal Load"}
                                </span>
                            </div>
                            <p className={`text-sm font-medium ${isSurging ? "text-rose-600" : "text-slate-500"}`}>
                                {isSurging
                                    ? `Triggered by ${surgeData.reason?.replace('_', ' ')}. Inventory is protected.`
                                    : "Traffic is within normal limits. Waiting room is bypassed."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => handleToggle(!isSurging)}
                            disabled={isUpdating}
                            className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ${isSurging
                                ? "bg-white text-rose-600 hover:bg-slate-50 shadow-rose-200"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                                }`}
                        >
                            {isSurging ? "Kill Surge Mode" : "Manual Surge Trigger"}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Queue Stat */}
                    <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 border border-white/50">
                        <div className="flex items-center gap-3 mb-3">
                            <Users className={`h-4 w-4 ${isSurging ? "text-rose-500" : "text-slate-400"}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Waiting Cohort</span>
                        </div>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">
                            {surgeData?.stats?.waiting || 0}
                        </div>
                    </div>

                    {/* Admitted Stat */}
                    <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 border border-white/50">
                        <div className="flex items-center gap-3 mb-3">
                            <Activity className={`h-4 w-4 ${isSurging ? "text-rose-500" : "text-slate-400"}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Admitted</span>
                        </div>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">
                            {surgeData?.stats?.admitted || 0}
                        </div>
                    </div>

                    {/* Quick Admission Control */}
                    <div className={`rounded-3xl p-6 border transition-all ${isSurging ? "bg-rose-600/5 border-rose-100" : "bg-slate-100 border-slate-200"
                        }`}>
                        <div className="flex items-center gap-3 mb-4">
                            <UserPlus className={`h-4 w-4 ${isSurging ? "text-rose-500" : "text-slate-400"}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Elevated Controls</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {[10, 50].map(count => (
                                <button
                                    key={count}
                                    onClick={() => handleAdmit(count)}
                                    disabled={isUpdating || !isSurging}
                                    title="Venue/Admin Permission Required"
                                    className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isSurging
                                        ? "bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-200"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                        }`}
                                >
                                    +{count}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* GAP 5: Surge Autopsy Analytics */}
                {analytics && (
                    <div className="mt-10 border-t border-slate-200 pt-10">
                        <div className="flex items-center gap-3 mb-8">
                            <BarChart3 className="h-5 w-5 text-slate-400" />
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Surge Autopsy & Conversion</h4>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">Peak Demand</span>
                                <div className="text-2xl font-black text-slate-900">{analytics.total_demand || 0} sessions</div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">Conversion Efficiency</span>
                                <div className="text-2xl font-black text-slate-900">
                                    {analytics.conversion_stats.admitted > 0
                                        ? Math.round((analytics.conversion_stats.consumed / analytics.conversion_stats.admitted) * 100)
                                        : 0}%
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">Checkout Retention</span>
                                <div className="text-2xl font-black text-slate-900">
                                    {analytics.conversion_stats.admitted - analytics.conversion_stats.abandoned_pre_reserve}
                                    <span className="text-[10px] text-slate-300 ml-1">v. {analytics.conversion_stats.admitted}</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">Failures (Pay/Aband)</span>
                                <div className="text-2xl font-black text-rose-500">
                                    {analytics.conversion_stats.payment_failed + analytics.conversion_stats.abandoned_pre_reserve}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isSurging && (
                    <div className="mt-8 flex items-center gap-4 px-6 py-4 bg-rose-600 text-white rounded-2xl animate-in slide-in-from-bottom-2 duration-500">
                        <ShieldAlert className="h-5 w-5" />
                        <p className="text-[10px] font-black uppercase tracking-widest">
                            Lane Model Admission Active: Prioritizing Loyal & Authenticated cohorts to mitigate bot impact.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
