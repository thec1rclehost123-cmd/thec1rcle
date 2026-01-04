"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Settings as SettingsIcon,
    Shield,
    Gauges,
    Bell,
    Database,
    CloudIcon,
    Percent,
    Lock,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Zap
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminSettings() {
    const { user, profile } = useAuth();
    const [config, setConfig] = useState({
        platformFee: 10,
        refundThreshold: 4000,
        dualApprovalThreshold: 20000,
        maintenanceMode: false,
        featureFlags: {
            discoverV2: true,
            payoutsAuto: false,
            datingSocial: false
        }
    });
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState(null);

    const fetchConfig = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=platform_config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                // Find the 'global' config or the first one
                const globalConfig = json.data.find(c => c.id === 'global') || json.data[0];
                setConfig({
                    ...config,
                    ...globalConfig
                });
            }
        } catch (err) {
            console.error("Failed to fetch config", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchConfig();
    }, [user]);

    const handleSave = async (reason) => {
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'DATABASE_CORRECTION',
                    targetId: 'platform_config',
                    reason,
                    params: {
                        type: 'config',
                        ticketReference: 'ADMIN_SETTINGS_SYNC',
                        after: config // The updated config state
                    }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Correction sync failed");
            }
            alert("Platform atmosphere successfully synchronized.");
            setModalConfig(null);
            await fetchConfig();
        } catch (err) {
            alert(`Authority Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleMaintenanceMode = () => {
        const nextState = !config.maintenanceMode;
        setModalConfig({
            action: 'SYNC',
            title: nextState ? 'Enter Maintenance State' : 'Exit Maintenance State',
            message: nextState
                ? 'CAUTION: This will immediately reroute all public traffic to the cooling page. Platform entrypoints will be halted.'
                : 'This will restore public access to the platform. Ensure all services are operational.',
            label: nextState ? 'Confirm Interrupt' : 'Restore Services',
            type: nextState ? 'danger' : 'info',
            nextMaintenanceState: nextState
        });
    };

    const confirmAction = async (reason) => {
        // If we are toggling maintenance via the special button, update state first
        if (modalConfig.nextMaintenanceState !== undefined) {
            setConfig(prev => ({ ...prev, maintenanceMode: modalConfig.nextMaintenanceState }));
            // Wait for state to potentially update or just pass the value directly in a specialized save
            // To be safe, we'll update local config and then save it
            const updatedConfig = { ...config, maintenanceMode: modalConfig.nextMaintenanceState };
            setLoading(true);
            try {
                const token = await user.getIdToken();
                await fetch('/api/actions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'DATABASE_CORRECTION',
                        targetId: 'platform_config',
                        reason,
                        params: { type: 'config', ticketReference: 'MAINTENANCE_TOGGLE', after: updatedConfig }
                    })
                });
                setConfig(updatedConfig);
                alert("System state updated.");
                setModalConfig(null);
            } catch (e) {
                alert(e.message);
            } finally {
                setLoading(false);
            }
        } else {
            await handleSave(reason);
        }
    };

    return (
        <div className="space-y-16 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-16">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <SettingsIcon className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">System Core</span>
                    </div>
                    <h1 className="text-6xl font-black tracking-tighter text-slate-900">Control Center</h1>
                    <p className="text-lg text-slate-500 mt-4 font-medium max-w-2xl leading-relaxed">
                        Configure global platform parameters, adjust financial thresholds, and manage environment feature flags. <span className="text-slate-900 underline underline-offset-4 decoration-indigo-200 decoration-4">Changes are applied across all 5 environments instantly.</span>
                    </p>
                </div>
                <button
                    onClick={() => setModalConfig({
                        action: 'SYNC',
                        title: 'Commit System Changes',
                        message: 'These changes will propagate to the database and reflect across User Website, Dashboard, and Scanner App immediately.',
                        label: 'Commit Changes',
                        type: 'danger'
                    })}
                    className="flex items-center gap-3 px-10 py-5 rounded-[2rem] bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                >
                    <Save className="h-4 w-4" />
                    Sync Atmosphere
                </button>
            </div>

            {loading && !config.id ? (
                <div className="h-[60vh] flex flex-col items-center justify-center space-y-8">
                    <div className="h-16 w-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Synchronizing with system core...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                    {/* ... (rest of the grid content) */}
                    <div className="lg:col-span-2 space-y-16">
                        {/* Financial Parameters */}
                        <section>
                            <div className="flex items-center gap-4 mb-10 px-4">
                                <div className="h-8 w-1.5 bg-indigo-600 rounded-full"></div>
                                <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-900">Capital Constants</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-10 rounded-[3.5rem] bg-white border border-slate-200 shadow-sm space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                            <Percent className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">Global Default</span>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-900">Platform Commission Rate</label>
                                        <div className="flex items-end gap-3 text-7xl font-black tracking-tighter text-slate-900">
                                            <input
                                                type="number"
                                                value={config.platformFee}
                                                onChange={(e) => setConfig({ ...config, platformFee: Number(e.target.value) })}
                                                className="bg-transparent w-32 focus:outline-none focus:text-indigo-600 transition-colors"
                                            />
                                            <span className="text-2xl mb-3 text-slate-300">%</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">Applied to all tickets excluding venues with custom contracts.</p>
                                    </div>
                                </div>

                                <div className="p-10 rounded-[3.5rem] bg-white border border-slate-200 shadow-sm space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                                            <Shield className="h-6 w-6 text-rose-600" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-4 py-2 rounded-full border border-rose-100">Hard Policy</span>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-900">Dual Approval Threshold</label>
                                        <div className="flex items-end gap-3 text-6xl font-black tracking-tighter text-slate-900">
                                            <span className="text-2xl mb-2.5 text-slate-300">₹</span>
                                            <input
                                                type="number"
                                                value={config.dualApprovalThreshold}
                                                onChange={(e) => setConfig({ ...config, dualApprovalThreshold: Number(e.target.value) })}
                                                className="bg-transparent w-full focus:outline-none focus:text-rose-600 transition-colors"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">Refunds exceeding this value require cross-departmental sign-off.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Operational Feature Flags */}
                        <section>
                            <div className="flex items-center gap-4 mb-10 px-4">
                                <div className="h-8 w-1.5 bg-emerald-600 rounded-full"></div>
                                <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-900">Environment Gates</h2>
                            </div>
                            <div className="p-10 rounded-[4rem] bg-slate-900 text-white shadow-2xl space-y-12">
                                <div className="space-y-8">
                                    {[
                                        { id: 'discoverV2', label: 'Discovery Engine V2', desc: 'Enhanced proximity-based event matching algorithm.' },
                                        { id: 'payoutsAuto', label: 'Autonomous Settlement', desc: 'Auto-batch payouts every 24h via Razorpay Route.' },
                                        { id: 'datingSocial', label: 'Events-Based Social Layer', desc: 'Beta access for user profile linking and networking.' }
                                    ].map((flag) => (
                                        <div key={flag.id} className="flex items-center justify-between group">
                                            <div className="space-y-1">
                                                <p className="text-lg font-black tracking-tight">{flag.label}</p>
                                                <p className="text-xs text-slate-500 font-medium">{flag.desc}</p>
                                            </div>
                                            <button
                                                onClick={() => setConfig({
                                                    ...config,
                                                    featureFlags: { ...config.featureFlags, [flag.id]: !config.featureFlags[flag.id] }
                                                })}
                                                className={`relative h-8 w-14 rounded-full transition-all duration-300 ${config.featureFlags[flag.id] ? 'bg-indigo-500' : 'bg-slate-800'}`}
                                            >
                                                <div className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all shadow-md ${config.featureFlags[flag.id] ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Health & Infrastructure */}
                    <aside className="space-y-16">
                        <section>
                            <div className="flex items-center gap-4 mb-10 px-4">
                                <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Observability</h2>
                            </div>
                            <div className="space-y-6">
                                {[
                                    { label: 'Firestore Indexing', status: 'optimal', icon: Database },
                                    { label: 'Auth Middleware', status: 'hardened', icon: Lock },
                                    { label: 'Cloud Propagation', status: '3ms latency', icon: CloudIcon }
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center gap-5 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                            <s.icon className="h-5 w-5 text-slate-900" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1.5">{s.label}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                                                <Zap className="h-3 w-3 fill-emerald-500" /> {s.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="p-10 rounded-[3.5rem] bg-rose-50 border border-rose-100 space-y-8">
                            <div className="h-14 w-14 rounded-2xl bg-rose-100 flex items-center justify-center">
                                <AlertCircle className="h-7 w-7 text-rose-600" />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-2xl font-black tracking-tighter text-rose-900">System Interruption</h3>
                                <p className="text-xs text-rose-800/60 font-medium leading-relaxed italic">Manual bypass of all platform entrypoints. Users will be redirected to a queue page.</p>
                                <button
                                    onClick={toggleMaintenanceMode}
                                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${config.maintenanceMode ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700' : 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700'}`}
                                >
                                    {config.maintenanceMode ? 'Exit Maintenance State' : 'Enter Maintenance State'}
                                </button>
                            </div>
                        </section>
                    </aside>
                </div>
            )}

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={confirmAction}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type={modalConfig.type}
                    isTier3={true}
                />
            )}
        </div>
    );
}
