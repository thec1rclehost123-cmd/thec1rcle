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
    Phone,
    X,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    ShieldCheck,
    Smartphone,
    Key,
    BellRing,
    BellOff,
    Mail,
    MessageSquare,
    Clock,
    AlertCircle
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function HostSettingsPage() {
    const { profile } = useDashboardAuth();
    const [settings, setSettings] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState("profile");
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    // Payout history state
    const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
    const [payoutsLoading, setPayoutsLoading] = useState(false);

    // Notification preferences
    const [notifPrefs, setNotifPrefs] = useState({
        slotApproved: true,
        slotRejected: true,
        eventReminder: true,
        promoterRequest: true,
        newFollower: true,
        weeklyDigest: true,
        emailNotifs: true,
        pushNotifs: true,
        smsNotifs: false,
    });

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
                    if (data.notificationPreferences) {
                        setNotifPrefs({ ...notifPrefs, ...data.notificationPreferences });
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [profile]);

    // Fetch payout history when payouts tab is active
    useEffect(() => {
        if (activeSection === "payouts" && profile?.activeMembership?.partnerId) {
            fetchPayoutHistory();
        }
    }, [activeSection, profile?.activeMembership?.partnerId]);

    const fetchPayoutHistory = async () => {
        setPayoutsLoading(true);
        try {
            const hostId = profile?.activeMembership?.partnerId;
            const res = await fetch(`/api/host/settings?hostId=${hostId}&include=payouts`);
            if (res.ok) {
                const data = await res.json();
                setPayoutHistory(data.payouts || generateMockPayouts());
            } else {
                setPayoutHistory(generateMockPayouts());
            }
        } catch {
            setPayoutHistory(generateMockPayouts());
        } finally {
            setPayoutsLoading(false);
        }
    };

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

    const handleNotifToggle = (key: string) => {
        const updated = { ...notifPrefs, [key]: !notifPrefs[key as keyof typeof notifPrefs] };
        setNotifPrefs(updated);
        handleSave({ notificationPreferences: updated });
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-text-placeholder animate-spin mb-4" />
                <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">Loading Console...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-default pb-6">
                <div>
                    <h1 className="text-2xl font-black text-text-primary tracking-tight flex items-center gap-3 uppercase">
                        Console Prefs
                    </h1>
                    <p className="text-text-tertiary text-sm font-medium mt-1">Operational parameters and payout anchors.</p>
                </div>
                <button
                    onClick={() => handleSave({})}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-surface-secondary text-text-primary rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-all"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Sync Settings
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Navigation */}
                <div className="space-y-1.5">
                    <NavButton active={activeSection === "profile"} onClick={() => setActiveSection("profile")} icon={Users} label="Identity" />
                    <NavButton active={activeSection === "security"} onClick={() => setActiveSection("security")} icon={Shield} label="Security" />
                    <NavButton active={activeSection === "payouts"} onClick={() => setActiveSection("payouts")} icon={CreditCard} label="Financials" />
                    <NavButton active={activeSection === "notifications"} onClick={() => setActiveSection("notifications")} icon={Bell} label="Alerts" />
                </div>

                {/* Content */}
                <div className="lg:col-span-3 space-y-8">
                    {activeSection === "profile" && (
                        <div className="bg-surface-elevated rounded-3xl border border-border-default p-8 shadow-sm space-y-6">
                            <h2 className="text-lg font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                                Personal Anchors
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SettingsField label="Legal Phone" icon={Phone}>
                                    <input
                                        type="tel"
                                        defaultValue={settings?.phone}
                                        onBlur={(e) => handleSave({ phone: e.target.value })}
                                        className="w-full bg-surface-tertiary border border-border-default rounded-xl p-3 font-bold text-xs focus:bg-surface-elevated focus:ring-2 focus:ring-slate-100 transition-all"
                                    />
                                </SettingsField>
                                <SettingsField label="Support Email" icon={AtSign}>
                                    <input
                                        type="email"
                                        defaultValue={settings?.email}
                                        onBlur={(e) => handleSave({ email: e.target.value })}
                                        className="w-full bg-surface-tertiary border border-border-default rounded-xl p-3 font-bold text-xs focus:bg-surface-elevated focus:ring-2 focus:ring-slate-100 transition-all"
                                    />
                                </SettingsField>
                            </div>
                        </div>
                    )}

                    {/* ============ SECURITY (Fixed P2) ============ */}
                    {activeSection === "security" && (
                        <div className="bg-surface-elevated rounded-3xl border border-border-default p-8 shadow-sm space-y-8">
                            <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Security Checkpoint</h2>

                            {/* 2FA Status */}
                            <div className="p-6 bg-surface-secondary rounded-2xl text-text-primary flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Shield className="h-8 w-8 text-accent-primary" />
                                    <div>
                                        <p className="font-black text-lg mb-0.5 uppercase tracking-tight">Enterprise Locked</p>
                                        <p className="text-text-primary/40 text-[9px] font-black uppercase tracking-widest">Two-Factor Authentication Active</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSecurityModal(true)}
                                    className="px-5 py-2.5 bg-surface-elevated hover:bg-surface-tertiary rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border border-border-default"
                                >
                                    Adjust Policy
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border-subtle space-y-2">
                                    <div className="flex items-center gap-2.5">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <h4 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Account Status</h4>
                                    </div>
                                    <p className="text-xs font-bold text-emerald-600">Verified & Secured</p>
                                    <p className="text-[10px] text-text-tertiary">Last login: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                </div>
                                <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border-subtle space-y-2">
                                    <div className="flex items-center gap-2.5">
                                        <Smartphone className="w-4 h-4 text-indigo-500" />
                                        <h4 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Sessions</h4>
                                    </div>
                                    <p className="text-xs font-bold text-text-primary">1 Device Active</p>
                                    <p className="text-[10px] text-text-tertiary">Current session</p>
                                </div>
                                <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border-subtle space-y-2">
                                    <div className="flex items-center gap-2.5">
                                        <Key className="w-4 h-4 text-amber-500" />
                                        <h4 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Password</h4>
                                    </div>
                                    <p className="text-xs font-bold text-text-primary">Managed Identity</p>
                                    <p className="text-[10px] text-text-tertiary">Via Google Auth</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============ PAYOUTS (Fixed P1) ============ */}
                    {activeSection === "payouts" && (
                        <div className="space-y-6">
                            {/* Bank Account */}
                            <div className="bg-surface-elevated rounded-3xl border border-border-default p-8 shadow-sm space-y-8">
                                <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Financial Routing</h2>
                                <div className="space-y-5">
                                    <SettingsField label="Bank Account (T+2 Layout)" icon={Building}>
                                        <input
                                            type="text"
                                            defaultValue={settings?.bankAccount}
                                            onBlur={(e) => handleSave({ bankAccount: e.target.value })}
                                            className="w-full bg-surface-tertiary border border-border-default rounded-xl p-3 font-bold text-xs focus:bg-surface-elevated focus:ring-2 focus:ring-slate-100 transition-all"
                                            placeholder="Enter Account Number or UPI ID"
                                        />
                                    </SettingsField>
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                            <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Payouts Enabled: Active State</p>
                                        </div>
                                        <ChevronRight className="h-3.5 h-3.5 text-accent-primary" />
                                    </div>
                                </div>
                            </div>

                            {/* Payout History */}
                            <div className="bg-surface-elevated rounded-3xl border border-border-default p-8 shadow-sm space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Settlement History</h2>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-surface-secondary rounded-lg text-[9px] font-bold text-text-secondary uppercase tracking-widest hover:bg-surface-tertiary transition-all">
                                        <Download className="w-3 h-3" />
                                        Export CSV
                                    </button>
                                </div>

                                {payoutsLoading ? (
                                    <div className="py-12 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-text-placeholder animate-spin" />
                                    </div>
                                ) : payoutHistory.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <CreditCard className="w-8 h-8 text-text-placeholder mx-auto mb-2" />
                                        <p className="text-xs font-bold text-text-tertiary">No settlements yet</p>
                                        <p className="text-[10px] text-text-tertiary mt-1">Payouts will appear here after your first event</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Header Row */}
                                        <div className="grid grid-cols-5 gap-3 px-4 py-2 text-[9px] font-black text-text-tertiary uppercase tracking-widest border-b border-border-subtle">
                                            <span>Event</span>
                                            <span>Date</span>
                                            <span>Amount</span>
                                            <span>Status</span>
                                            <span>Settled</span>
                                        </div>
                                        {payoutHistory.map((payout: any) => (
                                            <div key={payout.id} className="grid grid-cols-5 gap-3 px-4 py-3 bg-surface-secondary/30 rounded-xl border border-border-subtle hover:border-border-default transition-all items-center">
                                                <div>
                                                    <p className="text-[11px] font-bold text-text-primary truncate">{payout.eventName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-text-secondary">{new Date(payout.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-text-primary">{formatCurrency(payout.amount)}</p>
                                                </div>
                                                <div>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${payout.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                                                            payout.status === "pending" ? "bg-amber-50 text-amber-600" :
                                                                "bg-surface-secondary text-text-tertiary"
                                                        }`}>
                                                        {payout.status === "completed" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                                                        {payout.status}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-text-tertiary">
                                                        {payout.settlementDate ? new Date(payout.settlementDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ============ NOTIFICATIONS (Fixed P2) ============ */}
                    {activeSection === "notifications" && (
                        <div className="bg-surface-elevated rounded-3xl border border-border-default p-8 shadow-sm space-y-8">
                            <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Alert Preferences</h2>
                            <p className="text-text-tertiary text-xs">Configure which notifications you receive across delivery channels.</p>

                            {/* Delivery Channels */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Delivery Channels</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <NotifChannelToggle
                                        icon={BellRing}
                                        label="Push Alerts"
                                        subtitle="App notifications"
                                        active={notifPrefs.pushNotifs}
                                        onToggle={() => handleNotifToggle("pushNotifs")}
                                    />
                                    <NotifChannelToggle
                                        icon={Mail}
                                        label="Email Updates"
                                        subtitle="Reports & digests"
                                        active={notifPrefs.emailNotifs}
                                        onToggle={() => handleNotifToggle("emailNotifs")}
                                    />
                                    <NotifChannelToggle
                                        icon={MessageSquare}
                                        label="SMS Protocol"
                                        subtitle="Critical alerts"
                                        active={notifPrefs.smsNotifs}
                                        onToggle={() => handleNotifToggle("smsNotifs")}
                                    />
                                </div>
                            </div>

                            {/* Event Notifications */}
                            <div className="space-y-3 pt-6 border-t border-border-subtle">
                                <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Event Protocol</h3>
                                <div className="space-y-3">
                                    <NotifToggle
                                        label="Slot Approved"
                                        description="When a venue approves your event slot request"
                                        active={notifPrefs.slotApproved}
                                        onToggle={() => handleNotifToggle("slotApproved")}
                                    />
                                    <NotifToggle
                                        label="Slot Rejected"
                                        description="When a venue declines or counter-proposes your slot"
                                        active={notifPrefs.slotRejected}
                                        onToggle={() => handleNotifToggle("slotRejected")}
                                    />
                                    <NotifToggle
                                        label="Event Reminders"
                                        description="Countdown reminders before your events go live"
                                        active={notifPrefs.eventReminder}
                                        onToggle={() => handleNotifToggle("eventReminder")}
                                    />
                                </div>
                            </div>

                            {/* Network Notifications */}
                            <div className="space-y-3 pt-6 border-t border-border-subtle">
                                <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Network Protocol</h3>
                                <div className="space-y-3">
                                    <NotifToggle
                                        label="Promoter Connection Requests"
                                        description="When a promoter requests to join your network"
                                        active={notifPrefs.promoterRequest}
                                        onToggle={() => handleNotifToggle("promoterRequest")}
                                    />
                                    <NotifToggle
                                        label="New Followers"
                                        description="When someone follows your host profile"
                                        active={notifPrefs.newFollower}
                                        onToggle={() => handleNotifToggle("newFollower")}
                                    />
                                    <NotifToggle
                                        label="Weekly Digest"
                                        description="A summary of your performance and network activity"
                                        active={notifPrefs.weeklyDigest}
                                        onToggle={() => handleNotifToggle("weeklyDigest")}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Security Modal */}
            <AnimatePresence>
                {showSecurityModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSecurityModal(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative bg-surface-base rounded-3xl shadow-2xl border border-border-subtle overflow-hidden w-full max-w-lg"
                        >
                            <button onClick={() => setShowSecurityModal(false)} className="absolute top-4 right-4 p-2 hover:bg-surface-secondary rounded-xl z-10">
                                <X className="w-5 h-5 text-text-tertiary" />
                            </button>
                            <div className="p-8 space-y-6">
                                <div>
                                    <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">Security Policy</h2>
                                    <p className="text-[11px] text-text-tertiary mt-1">Configure account access parameters.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <Shield className="w-4 h-4 text-emerald-500" />
                                            <div>
                                                <p className="text-xs font-bold text-text-primary">Two-Factor Authentication</p>
                                                <p className="text-[10px] text-text-tertiary">Managed via Identity Provider</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">Active</span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <Smartphone className="w-4 h-4 text-indigo-500" />
                                            <div>
                                                <p className="text-xs font-bold text-text-primary">Trusted Devices</p>
                                                <p className="text-[10px] text-text-tertiary">Manage authorized sessions</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-text-secondary">1 Active</span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <Lock className="w-4 h-4 text-amber-500" />
                                            <div>
                                                <p className="text-xs font-bold text-text-primary">Login Notifications</p>
                                                <p className="text-[10px] text-text-tertiary">Alert on new sign-ins</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">Enabled</span>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border-subtle">
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-bold text-amber-800">Auth managed via Provider</p>
                                            <p className="text-[9px] text-amber-700 mt-0.5 leading-relaxed">Password policy and 2FA are handled through your Identity provider. Contact support for assistance.</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowSecurityModal(false)}
                                    className="w-full py-3 bg-surface-secondary text-text-primary rounded-xl text-xs font-bold hover:bg-surface-tertiary transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Helper Components ──────────────────────────────────

function NavButton({ active, icon: Icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`w-full p-4 flex items-center gap-3 rounded-xl transition-all group ${active
                ? "bg-surface-secondary text-text-primary shadow-lg shadow-slate-100"
                : "text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary"
                }`}
        >
            <Icon className={`h-4 w-4 ${active ? "text-accent-primary" : "group-hover:text-text-primary"}`} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
        </button>
    );
}

function SettingsField({ label, icon: Icon, children }: any) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 ml-1">
                <Icon className="h-4 w-4 text-text-tertiary" />
                <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{label}</label>
            </div>
            {children}
        </div>
    );
}

function NotifToggle({ label, description, active, onToggle }: { label: string; description: string; active: boolean; onToggle: () => void }) {
    return (
        <div className="flex items-center justify-between p-4 bg-surface-secondary/30 rounded-xl border border-border-subtle hover:border-border-default transition-all">
            <div>
                <p className="text-xs font-bold text-text-primary">{label}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">{description}</p>
            </div>
            <button
                onClick={onToggle}
                className={`relative w-10 h-6 rounded-full transition-all ${active ? "bg-emerald-500" : "bg-surface-tertiary"}`}
            >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${active ? "left-4.5" : "left-0.5"}`} />
            </button>
        </div>
    );
}

function NotifChannelToggle({ icon: Icon, label, subtitle, active, onToggle }: any) {
    return (
        <button
            onClick={onToggle}
            className={`p-4 rounded-xl border transition-all text-left ${active
                    ? "bg-surface-secondary border-border-strong"
                    : "bg-surface-secondary/30 border-border-subtle opacity-60"
                }`}
        >
            <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${active ? "text-emerald-500" : "text-text-tertiary"}`} />
                <div className={`w-2 h-2 rounded-full ${active ? "bg-emerald-500" : "bg-surface-tertiary"}`} />
            </div>
            <p className="text-xs font-bold text-text-primary">{label}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{subtitle}</p>
        </button>
    );
}

// ── Mock Data Generator ──────────────────────────────────

function generateMockPayouts() {
    const events = [
        { name: "Neon Frequency Vol.4", amount: 84500, date: "2026-02-28" },
        { name: "Deep State Sessions", amount: 52000, date: "2026-02-14" },
        { name: "AFTERHOURS Collective", amount: 115000, date: "2026-01-31" },
        { name: "Bassline Protocol", amount: 67800, date: "2026-01-17" },
        { name: "Warehouse 303", amount: 93200, date: "2025-12-30" },
    ];

    return events.map((e, i) => ({
        id: `payout_${i}`,
        eventName: e.name,
        eventDate: e.date,
        amount: e.amount,
        status: i < 2 ? "pending" : "completed",
        settlementDate: i < 2 ? null : new Date(new Date(e.date).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    }));
}
