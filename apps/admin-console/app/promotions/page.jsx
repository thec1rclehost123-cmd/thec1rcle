"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Percent, Users, TrendingUp, AlertCircle, ChevronRight, Plus, Filter } from "lucide-react";

export default function AdminPromotions() {
    const { user } = useAuth();
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPromos = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=promotions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setPromos(json.data || []);
        } catch (err) {
            console.error("Failed to fetch promotions", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchPromos();
    }, [user]);

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Percent className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Growth & Campaigns</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Promotions Console</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Manage promo codes, influencer campaigns, and referral tracking. <span className="text-slate-900">Monitor abuse and optimize conversion.</span>
                    </p>
                </div>

                <button className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                    <Plus className="h-4 w-4" />
                    Initialize Campaign
                </button>
            </div>

            {/* Strategy Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { label: "Active Codes", value: "24", icon: Percent, color: "indigo" },
                    { label: "Partner Network", value: "12", icon: Users, color: "emerald" },
                    { label: "Campaign ROI", value: "3.4x", icon: TrendingUp, color: "blue" },
                    { label: "Fraud Signals", value: "0", icon: AlertCircle, color: "rose" },
                ].map((item, i) => (
                    <div key={i} className="p-8 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                        <div className={`h-12 w-12 rounded-2xl bg-${item.color}-50 flex items-center justify-center mb-6`}>
                            <item.icon className={`h-6 w-6 text-${item.color}-600`} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                        <p className="text-3xl font-black text-slate-900">{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Active Registry */}
            <div className="space-y-8">
                <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Lookup campaigns by code, curator, or strategy..."
                            className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                        />
                    </div>
                    <button className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 transition-all mr-2">
                        <Filter className="h-5 w-5" />
                    </button>
                </div>

                <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Campaign Logic</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Utilization</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Duration</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">State</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full" /></td>
                                        </tr>
                                    ))
                                ) : promos.length > 0 ? promos.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-all cursor-pointer group">
                                        <td className="px-10 py-8">
                                            <div>
                                                <p className="text-base font-black tracking-tight text-slate-900">{p.code || 'LEGACY_CODE'}</p>
                                                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">{p.type === 'percent' ? `${p.value}% OFF` : `₹${p.value} OFF`}</p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                            {p.used || 0} / {p.limit || '∞'} Redemptions
                                        </td>
                                        <td className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                            {p.expiry ? new Date(p.expiry).toLocaleDateString() : 'PERPETUAL'}
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <span className="px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">Active</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">No active campaigns in the growth registry.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
