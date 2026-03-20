"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Save, CheckCircle2, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import type { PromoterIdentity, NotificationPrefs } from "@/lib/server/promoterSettingsStore";

// ─── Notification rows ────────────────────────────────────────────────────────

const NOTIF_ROWS: { key: keyof NotificationPrefs; label: string }[] = [
    { key: "notifyNewSale",      label: "New Sale"              },
    { key: "notifyCheckIn",      label: "Guest Check-in"        },
    { key: "notifyPayout",       label: "Payout Updates"        },
    { key: "notifyPartnership",  label: "Partnership Activity"  },
    { key: "notifyWeeklyReport", label: "Weekly Report"         },
    { key: "emailDigest",        label: "Email Digest"          },
];

const DEFAULT_NOTIF: NotificationPrefs = {
    notifyNewSale: true,
    notifyCheckIn: true,
    notifyPayout: true,
    notifyPartnership: true,
    notifyWeeklyReport: true,
    emailDigest: false,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage({ setActions, activeTab }: { setActions?: (node: React.ReactNode) => void; activeTab?: string }) {
    const { profile, user } = useDashboardAuth() as any;
    const promoterId: string = profile?.activeMembership?.partnerId ?? "";

    // ── Identity state
    const [identity,   setIdentity]   = useState<PromoterIdentity | null>(null);
    const [local,      setLocal]      = useState<PromoterIdentity | null>(null);
    const [isLoading,  setIsLoading]  = useState(true);
    const [isDirty,    setIsDirty]    = useState(false);
    const [isSaving,   setIsSaving]   = useState(false);
    const [saveError,  setSaveError]  = useState<string | null>(null);

    // ── Notifications state
    const [notifs,     setNotifs]     = useState<NotificationPrefs>(DEFAULT_NOTIF);

    // ── Security state
    const [resetSent,    setResetSent]    = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [logoutBusy,   setLogoutBusy]   = useState(false);
    const [logoutDone,   setLogoutDone]   = useState(false);

    const notifDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ──────────────────────────────────────────────────────────────────────────
    // Fetch
    // ──────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!promoterId || !user) return;
        let cancelled = false;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/promoter/settings?promoterId=${promoterId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (data.identity) { setIdentity(data.identity); setLocal(data.identity); }
                if (data.preferences?.notifications) setNotifs(data.preferences.notifications);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [promoterId, user]);

    // ──────────────────────────────────────────────────────────────────────────
    // Mutations
    // ──────────────────────────────────────────────────────────────────────────

    const patch = useCallback((p: Partial<PromoterIdentity>) => {
        setLocal(prev => prev ? { ...prev, ...p } : prev);
        setIsDirty(true);
    }, []);

    const handleReset = useCallback(() => {
        setLocal(identity); setIsDirty(false); setSaveError(null);
    }, [identity]);

    const handleSave = useCallback(async () => {
        if (!promoterId || !local) return;
        setIsSaving(true); setSaveError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/promoter/settings/identity", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    promoterId,
                    fields: {
                        legalName: local.legalName,
                        brandName: local.brandName,
                        phone: local.phone,
                        city: local.city,
                    },
                }),
            });
            if (res.ok) {
                const updated: PromoterIdentity = await res.json();
                setIdentity(updated); setLocal(updated); setIsDirty(false);
            } else setSaveError("Save failed. Try again.");
        } catch { setSaveError("Network error. Try again."); }
        finally { setIsSaving(false); }
    }, [promoterId, local, user]);

    const toggleNotif = useCallback((key: keyof NotificationPrefs, value: boolean) => {
        setNotifs(prev => {
            const next = { ...prev, [key]: value };
            if (notifDebounce.current) clearTimeout(notifDebounce.current);
            notifDebounce.current = setTimeout(async () => {
                try {
                    const token = await user.getIdToken();
                    await fetch("/api/promoter/settings/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ promoterId, notifications: next }),
                    });
                } catch {}
            }, 600);
            return next;
        });
    }, [promoterId, user]);

    const handleResetPassword = useCallback(async () => {
        if (!user?.email) return;
        setResetLoading(true);
        try {
            const { getFirebaseAuth } = await import("@/lib/firebase/client");
            const auth = await getFirebaseAuth();
            const { sendPasswordResetEmail } = await import("firebase/auth");
            await sendPasswordResetEmail(auth, user.email);
            setResetSent(true);
        } catch (e) { console.error(e); }
        finally { setResetLoading(false); }
    }, [user]);

    const handleLogoutAll = useCallback(async () => {
        setLogoutBusy(true);
        try {
            const token = await user.getIdToken();
            await fetch("/api/promoter/settings/security/logout-all", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            setLogoutDone(true);
        } catch {} finally { setLogoutBusy(false); }
    }, [user]);

    // ── Floating save bar integration
    useEffect(() => {
        if (isDirty && setActions) {
            setActions(
                <div className="flex items-center gap-3">
                    {saveError && <span className="text-[13px] font-bold text-red-400 mr-2">{saveError}</span>}
                    <button
                        onClick={handleReset}
                        className="h-10 px-6 rounded-xl bg-surface-tertiary border border-border-default text-[13px] font-bold text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-all"
                    >
                        Reset
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-10 px-8 rounded-xl bg-[var(--v-orange)] text-black text-[13px] font-black uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            );
        } else if (setActions) {
            setActions(null);
        }
    }, [isDirty, isSaving, saveError, handleSave, handleReset, setActions]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-[var(--v-orange)]/20 animate-ping absolute inset-0" />
                    <Loader2 className="w-12 h-12 text-[var(--v-orange)] animate-spin relative z-10" />
                </div>
                <div className="space-y-1 text-center">
                    <p className="text-[13px] font-black uppercase tracking-[0.3em] text-text-primary">Initializing</p>
                    <p className="text-[11px] font-medium text-[var(--v-text-tertiary)]">Fetching your promoter credentials...</p>
                </div>
            </div>
        );
    }

    const isGoogleUser = user?.providerData?.[0]?.providerId === "google.com";

    return (
        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-10 xl:col-span-10">
                <AnimatePresence mode="wait">
                    {activeTab === "general" && (
                        <motion.div 
                            key="general"
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <BentoCard className="p-10">
                                <div className="space-y-10">
                                    <header>
                                        <h3 className="text-[20px] font-black text-text-primary tracking-tight">Identity & Profile</h3>
                                        <p className="text-[14px] text-[var(--v-text-secondary)]">Manage your professional branding and legal information.</p>
                                    </header>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                                        <Field label="Legal Name">
                                            <Input value={local?.legalName ?? ""} onChange={v => patch({ legalName: v })} placeholder="Your legal name" />
                                        </Field>
                                        <Field label="Brand Name">
                                            <Input value={local?.brandName ?? ""} onChange={v => patch({ brandName: v })} placeholder="Stage / brand name" />
                                        </Field>
                                        <Field label="Phone Number">
                                            <Input value={local?.phone ?? ""} onChange={v => patch({ phone: v })} placeholder="+91 98000 00000" type="tel" />
                                        </Field>
                                        <Field label="Base City">
                                            <Input value={local?.city ?? ""} onChange={v => patch({ city: v })} placeholder="Mumbai, Pune…" />
                                        </Field>
                                    </div>
                                </div>
                            </BentoCard>
                        </motion.div>
                    )}

                    {activeTab === "notifications" && (
                        <motion.div 
                            key="notifications"
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <BentoCard className="p-10">
                                <div className="space-y-10">
                                    <header>
                                        <h3 className="text-[20px] font-black text-text-primary tracking-tight">Real-time Updates</h3>
                                        <p className="text-[14px] text-[var(--v-text-secondary)]">Choose which events trigger immediate push and email notifications.</p>
                                    </header>

                                    <div className="grid gap-4">
                                        {NOTIF_ROWS.map(({ key, label }) => {
                                            const on = notifs[key];
                                            return (
                                                <div key={key} className="group flex items-center justify-between p-6 rounded-2xl bg-surface-secondary border border-border-subtle hover:bg-surface-tertiary hover:border-border-default transition-all duration-300">
                                                    <div>
                                                        <p className="text-[15px] font-bold text-text-primary group-hover:text-[var(--v-orange)] transition-colors">{label}</p>
                                                        <p className="text-[12px] text-[var(--v-text-tertiary)]">Receive updates for every {label.toLowerCase()}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleNotif(key, !on)}
                                                        className={cn(
                                                            "relative w-12 h-6 rounded-full transition-all duration-500",
                                                            on ? "bg-[var(--v-orange)] shadow-[0_0_15px_rgba(255,107,0,0.3)]" : "bg-surface-elevated"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-500 transform",
                                                            on ? "left-7 scale-110" : "left-1"
                                                        )} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </BentoCard>
                        </motion.div>
                    )}

                    {activeTab === "security" && (
                        <motion.div 
                            key="security"
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <BentoCard className="p-10">
                                <div className="space-y-10">
                                    <header>
                                        <h3 className="text-[20px] font-black text-text-primary tracking-tight">Account Access</h3>
                                        <p className="text-[14px] text-[var(--v-text-secondary)]">Secure your account with multi-factor authentication and session management.</p>
                                    </header>

                                    <div className="grid gap-6">
                                        {!isGoogleUser ? (
                                            <div className="flex items-center justify-between p-7 rounded-2xl bg-surface-secondary border border-border-default hover:bg-surface-tertiary transition-all">
                                                <div className="space-y-1">
                                                    <p className="text-[16px] font-black text-text-primary">Password Authentication</p>
                                                    <p className="text-[13px] text-[var(--v-text-tertiary)]">Send a secure reset link to <span className="text-text-tertiary font-medium">{user?.email}</span></p>
                                                </div>
                                                {resetSent ? (
                                                    <div className="px-6 py-2 rounded-xl bg-[var(--v-success)]/10 border border-[var(--v-success)]/20 flex items-center gap-2">
                                                        <CheckCircle2 className="w-4 h-4 text-[var(--v-success)]" />
                                                        <span className="text-[13px] font-black text-[var(--v-success)] uppercase tracking-wider">Email Sent</span>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={handleResetPassword} 
                                                        disabled={resetLoading}
                                                        className="h-11 px-8 rounded-xl bg-white border border-white/10 text-black text-[13px] font-black uppercase tracking-wider hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50"
                                                    >
                                                        {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-7 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-[16px] font-black text-text-primary">Google SSO Integrated</p>
                                                    <p className="text-[13px] text-[var(--v-text-tertiary)]">Your account is secured via Google. Manage security at accounts.google.com</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/10">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between p-7 rounded-2xl bg-red-500/[0.03] border border-red-500/10 hover:bg-red-500/[0.05] transition-all">
                                            <div className="space-y-1">
                                                <p className="text-[16px] font-black text-text-primary">Global Session Termination</p>
                                                <p className="text-[13px] text-[var(--v-text-tertiary)]">Immediate logout from all other active devices and browser sessions.</p>
                                            </div>
                                            {logoutDone ? (
                                                <div className="px-6 py-2 rounded-xl bg-[var(--v-success)]/10 border border-[var(--v-success)]/20 flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-[var(--v-success)]" />
                                                    <span className="text-[13px] font-black text-[var(--v-success)] uppercase tracking-wider">Sessions Cleared</span>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={handleLogoutAll} 
                                                    disabled={logoutBusy}
                                                    className="h-11 px-8 rounded-xl bg-surface-tertiary border border-border-default text-text-primary text-[13px] font-black uppercase tracking-wider hover:bg-surface-elevated active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
                                                >
                                                    {logoutBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogOut className="w-4 h-4" /> Sign Out Everywhere</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </BentoCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)] ml-1">{label}</p>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <input 
            type={type} 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            placeholder={placeholder}
            className="w-full bg-surface-secondary border border-border-default rounded-2xl px-5 py-4 text-[15px] font-bold text-text-primary outline-none focus:border-[var(--v-orange)]/50 focus:bg-surface-tertiary transition-all placeholder:text-text-placeholder"
        />
    );
}
