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
    ShieldAlert
} from "lucide-react";

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
            await fetch(`/api/events/${eventId}/surge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "admit", count })
            });
            await fetchSurgeData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) return null;

    const isSurging = surgeData?.status === "surge";

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
                                    Surge Protection
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${isSurging ? "bg-rose-600 text-white" : "bg-slate-300 text-white"
                                    }`}>
                                    {isSurging ? "Active" : "Stable"}
                                </span>
                            </div>
                            <p className={`text-sm font-medium ${isSurging ? "text-rose-600" : "text-slate-500"}`}>
                                {isSurging
                                    ? `Triggered by ${surgeData.reason?.replace('_', ' ')}. Admission throttled.`
                                    : "Traffic is within normal limits. Inventory is flowing freely."}
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
                            {isSurging ? "Force Kill Surge" : "Manual Surge Trigger"}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Queue Stat */}
                    <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 border border-white/50 group">
                        <div className="flex items-center gap-3 mb-3">
                            <Users className={`h-4 w-4 ${isSurging ? "text-rose-500" : "text-slate-400"}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Waiting</span>
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Batch Admissions</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {[10, 50, 100].map(count => (
                                <button
                                    key={count}
                                    onClick={() => handleAdmit(count)}
                                    disabled={isUpdating || !isSurging}
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

                {isSurging && (
                    <div className="mt-8 flex items-center gap-4 px-6 py-4 bg-rose-600 text-white rounded-2xl animate-in slide-in-from-bottom-2 duration-500">
                        <AlertCircle className="h-5 w-5" />
                        <p className="text-[10px] font-black uppercase tracking-widest">
                            New checkouts are being queued. Guaranteed inventory holds are only granted after admission.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
