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
    Zap,
    X
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
                        after: config
                    }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Save failed");
            }
            alert("General settings successfully updated.");
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
            title: nextState ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode',
            message: nextState
                ? 'Warning: This will immediately take the platform offline for users. Only administrators will be able to access the site.'
                : 'This will restore public access to the platform for all users.',
            label: nextState ? 'Confirm Offline' : 'Restore Online',
            type: nextState ? 'danger' : 'info',
            nextMaintenanceState: nextState
        });
    };

    const confirmAction = async (reason) => {
        if (modalConfig.nextMaintenanceState !== undefined) {
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
                alert("Platform status updated.");
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
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <SettingsIcon className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Global Configuration</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Platform Settings</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Adjust fee structures, safety thresholds, and toggle platform-wide features.
                    </p>
                </div>
                <button
                    onClick={() => setModalConfig({
                        action: 'SYNC',
                        title: 'Save Global Changes',
                        message: 'Save these changes across all platform services immediately.',
                        label: 'Save Changes',
                        type: 'danger'
                    })}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
                >
                    <Save className="h-4 w-4" />
                    Save All Changes
                </button>
            </div>

            {loading && !config.id ? (
                <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
                    <div className="h-10 w-10 border-2 border-white/5 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Loading Configuration...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-12">
                        {/* Financial Settings */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 px-1">
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Financial Parameters</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] space-y-8 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center">
                                            <Percent className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 border border-white/5 px-2.5 py-1 rounded-md bg-white/[0.02]">Standard Fee</span>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Platform Service Fee</label>
                                        <div className="flex items-end gap-2">
                                            <input
                                                type="number"
                                                value={config.platformFee}
                                                onChange={(e) => setConfig({ ...config, platformFee: Number(e.target.value) })}
                                                className="bg-transparent text-6xl font-light tracking-tight text-white w-28 focus:outline-none"
                                            />
                                            <span className="text-xl font-bold text-zinc-700 mb-3">%</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic">Charged on all standard ticket transactions.</p>
                                    </div>
                                </div>

                                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] space-y-8 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center">
                                            <Shield className="h-5 w-5 text-iris" strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-iris border border-iris/20 px-2.5 py-1 rounded-md bg-iris/5">Security Policy</span>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Approval Threshold</label>
                                        <div className="flex items-end gap-2">
                                            <span className="text-xl font-bold text-zinc-700 mb-3">₹</span>
                                            <input
                                                type="number"
                                                value={config.dualApprovalThreshold}
                                                onChange={(e) => setConfig({ ...config, dualApprovalThreshold: Number(e.target.value) })}
                                                className="bg-transparent text-6xl font-light tracking-tight text-white w-full focus:outline-none"
                                            />
                                        </div>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic">Refunds above this value require secondary admin approval.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Feature Toggles */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 px-1">
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Platform Features</h2>
                            </div>
                            <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] shadow-sm space-y-6">
                                {[
                                    { id: 'discoverV2', label: 'Proximity Discovery', desc: 'Enable advanced location-based event recommendations.' },
                                    { id: 'payoutsAuto', label: 'Automated Settlements', desc: 'Allow the system to automatically process host payments.' },
                                    { id: 'datingSocial', label: 'Social Experiences', desc: 'Enable beta social features for event attendees.' }
                                ].map((flag) => (
                                    <div key={flag.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5 group">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-white group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{flag.label}</p>
                                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{flag.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => setConfig({
                                                ...config,
                                                featureFlags: { ...config.featureFlags, [flag.id]: !config.featureFlags[flag.id] }
                                            })}
                                            className={`relative h-7 w-12 rounded-full transition-all duration-300 ${config.featureFlags[flag.id] ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-zinc-800'}`}
                                        >
                                            <div className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all shadow-md ${config.featureFlags[flag.id] ? 'left-6' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar: Status & Emergency */}
                    <aside className="lg:col-span-4 space-y-8">
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 px-1">
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Service Status</h2>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { label: 'Cloud Storage', status: 'Optimal', icon: Database, color: 'text-emerald-500' },
                                    { label: 'Security Layer', status: 'Verified', icon: Lock, color: 'text-emerald-500' },
                                    { label: 'Data Sync', status: 'Active', icon: CloudIcon, color: 'text-emerald-500' }
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center gap-4 p-5 rounded-xl bg-obsidian-surface border border-[#ffffff08] shadow-sm">
                                        <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center">
                                            <s.icon className={`h-4.5 w-4.5 ${s.color}`} strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{s.label}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
                                                <Zap className={`h-3 w-3 fill-current ${s.color}`} /> {s.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="p-8 rounded-xl bg-iris/5 border border-iris/20 space-y-6 shadow-2xl shadow-iris/5">
                            <div className="h-12 w-12 rounded-lg bg-iris/10 flex items-center justify-center border border-iris/20 shadow-inner">
                                <AlertCircle className="h-6 w-6 text-iris" strokeWidth={1.5} />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold tracking-tight text-white uppercase">Maintenance</h3>
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed italic">Turn off public access to the entire platform. Only admins can log in.</p>
                                <button
                                    onClick={toggleMaintenanceMode}
                                    className={`w-full py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-lg ${config.maintenanceMode ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600' : 'bg-iris text-white shadow-iris/20 hover:bg-iris/90'}`}
                                >
                                    {config.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
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
