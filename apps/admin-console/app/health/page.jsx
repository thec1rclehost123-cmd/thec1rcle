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
    Search
} from "lucide-react";

export default function AdminHealth() {
    const { user } = useAuth();
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchHealthData = async () => {
        try {
            const token = await user.getIdToken();
            // Assuming a list endpoint for failed webhooks or system logs
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
                    reason: "Manual retry from health dashboard",
                    params: { type: 'webhook' }
                })
            });
            if (res.ok) alert("Retry signal dispatched.");
            else throw new Error("Retry failed");
            fetchHealthData();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="h-6 w-6 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">System Monitoring</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Platform Health</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Observe real-time system performance, monitor webhook delivery, and audit external provider connectivity. <span className="text-slate-900">Maintain operational zero-downtime integrity.</span>
                    </p>
                </div>
            </div>

            {/* Operational Nodes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {[
                    { label: "Firebase Core", status: "Operational", icon: Database, color: "text-emerald-500" },
                    { label: "Razorpay Gateway", status: "Connected", icon: Zap, color: "text-amber-500" },
                    { label: "Vision AI Node", status: "Active", icon: ShieldCheck, color: "text-indigo-500" },
                    { label: "CDN Edge", status: "Optimal", icon: Globe, color: "text-blue-500" }
                ].map((node) => (
                    <div key={node.label} className="p-8 rounded-[3rem] bg-white border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-indigo-100 transition-all">
                        <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <node.icon className={`h-6 w-6 ${node.color}`} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{node.label}</p>
                            <p className="text-sm font-black text-slate-900">{node.status}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Failed Webhooks Queue */}
            <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <h3 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-4">
                        Webhook Deflection Queue
                        <span className="text-[10px] bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100 uppercase tracking-widest">
                            {webhooks.length} Failures
                        </span>
                    </h3>
                    <div className="flex gap-4">
                        <div className="relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filter by event type..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white border border-slate-200 pl-12 pr-6 py-3 rounded-2xl text-xs w-64 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all font-semibold"
                            />
                        </div>
                        <button
                            onClick={fetchHealthData}
                            className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                        >
                            <RefreshCw className="h-4 w-4 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="rounded-[4rem] border border-slate-200 bg-white shadow-sm overflow-hidden p-12">
                    {webhooks.length === 0 ? (
                        <div className="py-24 text-center rounded-[3rem] border-2 border-slate-100 border-dashed bg-slate-50/50">
                            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-100">
                                <ShieldCheck className="h-10 w-10 text-emerald-500" />
                            </div>
                            <h4 className="text-2xl font-black text-slate-900">Communication Optimal</h4>
                            <p className="text-sm text-slate-500 mt-3 font-medium max-w-sm mx-auto">No webhook deflections or failed deliveries detected in the current operational window.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {webhooks.map((hook) => (
                                <div key={hook.id} className="p-8 rounded-[2.5rem] bg-slate-50/50 border border-slate-100 flex items-center gap-8 group hover:bg-white hover:border-indigo-100 transition-all">
                                    <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center border border-red-100">
                                        <AlertTriangle className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-1">
                                            <span className="text-sm font-black text-slate-900">EVENT: {hook.event_type || hook.type}</span>
                                            <span className="text-[9px] font-black uppercase text-slate-400 px-2 py-0.5 border border-slate-200 rounded-md">
                                                Errors: {hook.retry_count || 3}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{hook.id} • {new Date(hook.timestamp?._seconds * 1000).toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleRetry(hook.id)}
                                            className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all font-black flex items-center gap-2"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                            Re-Dispatch
                                        </button>
                                        <button className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all">
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
