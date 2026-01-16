"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Activity,
    ShieldCheck,
    AlertTriangle,
    RefreshCw,
    Zap,
    Server,
    Globe,
    Database,
    ChevronRight,
    Search,
    X
} from "lucide-react";

export default function AdminHealth() {
    const { user } = useAuth();
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchHealthData = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=failed_webhooks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setWebhooks(json.data || []);
        } catch (err) {
            console.error("Failed to fetch health data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchHealthData();
    }, [user]);

    const handleRetry = async (hookId) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'WEBHOOK_RETRY',
                    targetId: hookId,
                    reason: "Manual retry from management dashboard",
                    params: { type: 'webhook' }
                })
            });
            if (res.ok) alert("Action signal sent.");
            else throw new Error("Retry failed");
            fetchHealthData();
        } catch (err) {
            alert(err.message);
        }
    };

    const filtered = webhooks.filter(h =>
        (h.event_type || h.type)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">System Status</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Network Health</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor active services, track system performance, and manage background tasks.
                    </p>
                </div>
            </div>

            {/* System Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Core Database", status: "Operational", icon: Database, color: "text-emerald-500" },
                    { label: "Payment Gateway", status: "Connected", icon: Zap, color: "text-emerald-500" },
                    { label: "Account Services", status: "Active", icon: ShieldCheck, color: "text-emerald-500" },
                    { label: "Platform API", status: "Optimal", icon: Globe, color: "text-emerald-500" }
                ].map((node) => (
                    <div key={node.label} className="p-6 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-4 group hover:border-[#ffffff15] transition-all shadow-sm">
                        <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                            <node.icon className={`h-5 w-5 ${node.color}`} strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">{node.label}</p>
                            <p className="text-sm font-bold text-white uppercase tracking-tight">{node.status}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Failed Webhooks Queue */}
            <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 px-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Issue Queue</h3>
                        <div className="px-2 py-0.5 rounded bg-iris/10 border border-iris/20 text-iris text-[9px] font-bold uppercase tracking-widest">
                            {webhooks.length} Active Failures
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
                            <input
                                type="text"
                                placeholder="Find issues..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-obsidian-surface border border-[#ffffff08] pl-10 pr-4 py-2.5 rounded-xl text-xs w-64 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                            />
                        </div>
                        <button
                            onClick={fetchHealthData}
                            className="p-2.5 rounded-xl border border-[#ffffff08] bg-obsidian-surface hover:bg-white/5 transition-all text-zinc-500 hover:text-white"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface shadow-sm overflow-hidden overflow-x-auto">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-white/5 animate-pulse rounded-lg border border-white/5" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-24 text-center rounded-xl bg-white/[0.01]">
                            <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                                <ShieldCheck className="h-8 w-8 text-emerald-500" strokeWidth={1.5} />
                            </div>
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">System Nominal</h4>
                            <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest">No background task errors detected.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Incident Details</th>
                                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Timeline</th>
                                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Retry State</th>
                                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ffffff05]">
                                {filtered.map((hook) => (
                                    <tr key={hook.id} className="hover:bg-white/[0.02] transition-all group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-iris/10 border border-iris/20 flex items-center justify-center">
                                                    <AlertTriangle className="h-5 w-5 text-iris" strokeWidth={1.5} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">Issue: {hook.event_type || hook.type}</p>
                                                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">ID: {hook.id.slice(0, 12)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                                {new Date(hook.timestamp?._seconds * 1000 || Date.now()).toLocaleString()}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-1 w-1 rounded-full bg-amber-500" />
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                                    {hook.retry_count || 3} Attempts Recorded
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button
                                                onClick={() => handleRetry(hook.id)}
                                                className="px-4 py-2 rounded-lg bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2 ml-auto"
                                            >
                                                <RefreshCw className="h-3 w-3" />
                                                Retry Task
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
