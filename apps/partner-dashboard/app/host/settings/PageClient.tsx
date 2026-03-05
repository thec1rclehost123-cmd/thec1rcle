"use client";

import { useEffect, useState } from "react";
import {
    Settings,
    Shield,
    CreditCard,
    Bell,
    Users,
    Lock,
    Save,
    Loader2,
    CheckCircle2,
    ChevronRight,
    Building,
    AtSign,
    Phone
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function HostSettingsPage() {
    const { profile } = useDashboardAuth();
    const [settings, setSettings] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState("profile");

    useEffect(() => {
        const fetchSettings = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const hostId = profile.activeMembership.partnerId;
                const res = await fetch(`/api/host/settings?hostId=${hostId}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [profile]);

    const handleSave = async (updates: any) => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsSaving(true);
        try {
            const res = await fetch("/api/host/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hostId: profile.activeMembership.partnerId,
                    settings: updates
                })
            });
            if (res.ok) {
                setSettings({ ...settings, ...updates });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Console...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4 uppercase">
                        Console Prefs
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3">Operational parameters, verification status, and payout anchors.</p>
                </div>
                <button
                    onClick={() => handleSave({})}
                    disabled={isSaving}
                    className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all"
                >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Sync Settings
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                {/* Navigation */}
                <div className="space-y-2">
                    <NavButton active={activeSection === "profile"} onClick={() => setActiveSection("profile")} icon={Users} label="Identity" />
                    <NavButton active={activeSection === "security"} onClick={() => setActiveSection("security")} icon={Shield} label="Security" />
                    <NavButton active={activeSection === "payouts"} onClick={() => setActiveSection("payouts")} icon={CreditCard} label="Financials" />
                    <NavButton active={activeSection === "notifications"} onClick={() => setActiveSection("notifications")} icon={Bell} label="Alerts" />
                </div>

                {/* Content */}
                <div className="lg:col-span-3 space-y-12">
                    {activeSection === "profile" && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 shadow-sm space-y-10">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                Personal Anchors
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <SettingsField label="Legal Phone" icon={Phone}>
                                    <input
                                        type="tel"
                                        defaultValue={settings?.phone}
                                        onBlur={(e) => handleSave({ phone: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all"
                                    />
                                </SettingsField>
                                <SettingsField label="Support Email" icon={AtSign}>
                                    <input
                                        type="email"
                                        defaultValue={settings?.email}
                                        onBlur={(e) => handleSave({ email: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all"
                                    />
                                </SettingsField>
                            </div>
                        </div>
                    )}

                    {activeSection === "security" && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 shadow-sm space-y-10">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Security Checkpoint</h2>
                            <div className="p-8 bg-slate-900 rounded-3xl text-white flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <Shield className="h-10 w-10 text-emerald-400" />
                                    <div>
                                        <p className="font-black text-xl mb-1 uppercase tracking-tight">Enterprise Locked</p>
                                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Two-Factor Authentication Active</p>
                                    </div>
                                </div>
                                <button className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors mb-0 ml-0 hover:mb-0 hover:ml-0">
                                    Adjust Policy
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSection === "payouts" && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 shadow-sm space-y-10">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Financial Routing</h2>
                            <div className="space-y-6">
                                <SettingsField label="Bank Account (T+2 Layout)" icon={Building}>
                                    <input
                                        type="text"
                                        defaultValue={settings?.bankAccount}
                                        onBlur={(e) => handleSave({ bankAccount: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all"
                                        placeholder="Enter Account Number or UPI ID"
                                    />
                                </SettingsField>
                                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                        <p className="text-xs font-black text-emerald-900 uppercase tracking-widest">Payouts Enabled: Active State</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-emerald-400" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function NavButton({ active, icon: Icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`w-full p-6 flex items-center gap-4 rounded-[1.5rem] transition-all group ${active
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                }`}
        >
            <Icon className={`h-5 w-5 ${active ? "text-emerald-400" : "group-hover:text-slate-900"}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
        </button>
    );
}

function SettingsField({ label, icon: Icon, children }: any) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 ml-1">
                <Icon className="h-4 w-4 text-slate-400" />
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
            </div>
            {children}
        </div>
    );
}
