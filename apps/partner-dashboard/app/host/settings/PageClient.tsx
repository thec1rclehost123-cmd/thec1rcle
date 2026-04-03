"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import {
    Loader2, Save, RotateCcw, Lock, Monitor, Smartphone,
    LogOut, Mail, BellRing, MessageSquare, RefreshCw,
    AlertTriangle, X, CheckCircle2, Settings, UserCircle, Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import ProfileClient from "../profile/PageClient";
import PageManagementClient from "../page-management/PageClient";
import { sendOperationalPasswordResetEmail, getPasswordResetErrorMessage } from "@/lib/auth/passwordReset";
import type { HostSettings, LoginSession } from "@/lib/server/hostSettingsStore";

const HUB_TABS = [
    { key: "general", label: "General", icon: Settings },
    { key: "profile", label: "Profile", icon: UserCircle },
    { key: "page",    label: "Page",    icon: Globe },
];

// ─── Notification matrix ──────────────────────────────────────────────────────

const NOTIF_CATEGORIES = [
    { key: "slotApproved",    label: "Slot Approved"     },
    { key: "slotRejected",    label: "Slot Rejected"     },
    { key: "eventReminder",   label: "Event Reminders"   },
    { key: "promoterRequest", label: "Promoter Requests" },
    { key: "newFollower",     label: "New Followers"     },
    { key: "weeklyDigest",    label: "Weekly Digest"     },
];
const NOTIF_CHANNELS = [
    { key: "email", label: "Email",  icon: Mail           },
    { key: "push",  label: "Push",   icon: BellRing       },
    { key: "sms",   label: "SMS",    icon: MessageSquare  },
];

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

function parseBrowser(ua: string | null) {
    if (!ua) return "Unknown device";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Edg")) return "Edge";
    return "Browser";
}

function relativeTime(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    if (ms < 60_000)     return "just now";
    if (ms < 3_600_000)  return rtf.format(-Math.floor(ms / 60_000),    "minute");
    if (ms < 86_400_000) return rtf.format(-Math.floor(ms / 3_600_000), "hour");
    return rtf.format(-Math.floor(ms / 86_400_000), "day");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HostSettingsPage() {
    const { activeTab: hubTab, setTab: setHubTab } = useHubTab("general");
    const { profile, user } = useDashboardAuth();
    const hostId = profile?.activeMembership?.partnerId;

    // ── Settings state
    const [settings,  setSettings]  = useState<HostSettings | null>(null);
    const [local,     setLocal]     = useState<HostSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDirty,   setIsDirty]   = useState(false);
    const [isSaving,  setIsSaving]  = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // ── Sessions
    const [sessions,        setSessions]        = useState<LoginSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [isRevoking,      setIsRevoking]      = useState(false);
    const [currentSid]                          = useState(() => crypto.randomUUID());

    // ── Password reset
    const [resetSent,    setResetSent]    = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError,   setResetError]   = useState<string | null>(null);

    // ── Re-auth modal
    const [needsReAuth, setNeedsReAuth] = useState(false);
    const [reAuthPw,    setReAuthPw]    = useState("");
    const [reAuthErr,   setReAuthErr]   = useState<string | null>(null);
    const [reAuthBusy,  setReAuthBusy]  = useState(false);

    const getAuthHeaders = useCallback(async (includeJson = false) => {
        const token = user ? await user.getIdToken() : "";
        return {
            ...(includeJson ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, [user]);

    // ──────────────────────────────────────────────────────────────────────────
    // Fetch
    // ──────────────────────────────────────────────────────────────────────────

    const fetchSettings = useCallback(async () => {
        if (!hostId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/host/settings?hostId=${hostId}`, {
                headers: await getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                const s: HostSettings = data.settings ?? data;
                setSettings(s); setLocal(s);
            }
        } catch (e) { console.error("[Settings] fetch", e); }
        finally { setIsLoading(false); }
    }, [getAuthHeaders, hostId]);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    // Write session on mount
    useEffect(() => {
        if (!hostId || !profile?.uid) return;
        const writeSession = async () => {
            const ua = navigator.userAgent;
            await fetch("/api/host/settings", {
                method: "POST",
                headers: await getAuthHeaders(true),
                body: JSON.stringify({ hostId, action: "WRITE_SESSION", sessionData: {
                    sessionId: currentSid, userAgent: ua,
                    deviceType: /Mobi|Android/i.test(ua) ? "mobile" : "desktop",
                    lastActiveAt: new Date().toISOString(),
                }}),
            });
        };
        writeSession().catch(() => {});
    }, [currentSid, getAuthHeaders, hostId, profile?.uid]);

    const loadSessions = useCallback(async () => {
        if (!hostId) return;
        setSessionsLoading(true);
        try {
            const res = await fetch(`/api/host/settings?hostId=${hostId}&include=sessions`, {
                headers: await getAuthHeaders(),
            });
            if (res.ok) setSessions((await res.json()).sessions ?? []);
        } catch {} finally { setSessionsLoading(false); }
    }, [getAuthHeaders, hostId]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    // ──────────────────────────────────────────────────────────────────────────
    // Mutations
    // ──────────────────────────────────────────────────────────────────────────

    const patch = useCallback((p: Partial<HostSettings>) => {
        setLocal(prev => prev ? { ...prev, ...p } : prev);
        setIsDirty(true);
    }, []);

    const handleReset = useCallback(() => {
        setLocal(settings); setIsDirty(false); setSaveError(null);
    }, [settings]);

    const handleSave = useCallback(async () => {
        if (!hostId || !local || !settings) return;
        setIsSaving(true); setSaveError(null);
        const diff: Partial<HostSettings> = {};
        for (const k of Object.keys(local) as (keyof HostSettings)[]) {
            if (JSON.stringify(local[k]) !== JSON.stringify(settings[k])) (diff as any)[k] = local[k];
        }
        const action = Object.keys(diff).some(k => k === "notificationPreferences")
            ? "NOTIFICATIONS_UPDATED" : "GENERAL_UPDATED";
        try {
            const res = await fetch("/api/host/settings", {
                method: "PATCH",
                headers: await getAuthHeaders(true),
                body: JSON.stringify({ hostId, patch: diff, action, section: "general" }),
            });
            if (res.ok) {
                const d = await res.json();
                const u: HostSettings = d.settings ?? { ...settings, ...diff };
                setSettings(u); setLocal(u); setIsDirty(false);
            } else setSaveError("Save failed. Try again.");
        } catch { setSaveError("Network error. Try again."); }
        finally { setIsSaving(false); }
    }, [getAuthHeaders, hostId, local, settings]);

    // Sessions
    const handleRevoke = useCallback(async (sid: string) => {
        setIsRevoking(true);
        await fetch("/api/host/settings", { method: "POST", headers: await getAuthHeaders(true),
            body: JSON.stringify({ hostId, action: "REVOKE_SESSION", sessionId: sid }) });
        setSessions(p => p.filter(s => s.sessionId !== sid));
        setIsRevoking(false);
    }, [getAuthHeaders, hostId]);

    const handleRevokeAll = useCallback(async () => {
        setIsRevoking(true);
        await fetch("/api/host/settings/session/revoke", { method: "POST", headers: await getAuthHeaders() });
        setSessions(p => p.filter(s => s.sessionId === currentSid));
        setIsRevoking(false);
    }, [currentSid, getAuthHeaders]);

    // Password reset
    const handleResetPassword = useCallback(async () => {
        if (!user?.email) return;
        setResetLoading(true);
        setResetError(null);
        try {
            const { getFirebaseAuth } = await import("@/lib/firebase/client");
            const auth = await getFirebaseAuth();
            await sendOperationalPasswordResetEmail(auth, user.email);
            setResetSent(true);
        } catch (e) {
            console.error(e);
            setResetError(getPasswordResetErrorMessage(e));
        }
        finally { setResetLoading(false); }
    }, [user]);

    // Re-auth
    const checkReAuth = useCallback(async (): Promise<boolean> => {
        try {
            const tr = await user?.getIdTokenResult();
            const age = Date.now() - ((tr?.claims.auth_time as unknown as number) ?? 0) * 1000;
            if (age > 15 * 60 * 1000) { setNeedsReAuth(true); return false; }
        } catch {}
        return true;
    }, [user]);

    const handleReAuth = useCallback(async () => {
        if (!user) return;
        setReAuthBusy(true); setReAuthErr(null);
        try {
            const pid = user.providerData[0]?.providerId;
            if (pid === "password") {
                const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
                await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", reAuthPw));
            } else {
                const { GoogleAuthProvider, reauthenticateWithPopup } = await import("firebase/auth");
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
            }
            setNeedsReAuth(false); setReAuthPw("");
        } catch (e: any) {
            setReAuthErr(e.code === "auth/wrong-password" ? "Incorrect password." : "Authentication failed.");
        } finally { setReAuthBusy(false); }
    }, [user, reAuthPw]);

    // ──────────────────────────────────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────────────────────────────────

    // Hub-level tab routing — profile and page tabs bypass the settings data load
    if (hubTab === "profile") {
        return (
            <VenuePageShell title="Settings" subtitle="Organisation configuration">
                <HubTabBar tabs={HUB_TABS} activeTab={hubTab} onTabChange={setHubTab} />
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                    <ProfileClient />
                </Suspense>
            </VenuePageShell>
        );
    }

    if (hubTab === "page") {
        return (
            <VenuePageShell title="Settings" subtitle="Organisation configuration">
                <HubTabBar tabs={HUB_TABS} activeTab={hubTab} onTabChange={setHubTab} />
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                    <PageManagementClient />
                </Suspense>
            </VenuePageShell>
        );
    }

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--v-orange)]" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">Loading</p>
            </div>
        );
    }

    const isGoogleUser = user?.providerData[0]?.providerId === "google.com";
    const otherSessions = sessions.filter(s => s.sessionId !== currentSid);

    return (
        <VenuePageShell title="Settings" subtitle="Organisation configuration">
            <HubTabBar tabs={HUB_TABS} activeTab={hubTab} onTabChange={setHubTab} />
            <div className="max-w-2xl space-y-10">

                {/* ── Organisation ─────────────────────────────────────────── */}
                <section className="space-y-6">
                    <Label>Organisation</Label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Name">
                            <Input value={local?.orgName ?? ""} onChange={v => patch({ orgName: v })} placeholder="Your brand name" />
                        </Field>
                        <Field label="Support Email">
                            <Input value={local?.supportEmail ?? ""} onChange={v => patch({ supportEmail: v })} placeholder="support@org.com" type="email" />
                        </Field>
                        <Field label="Phone">
                            <Input value={local?.legalPhone ?? ""} onChange={v => patch({ legalPhone: v })} placeholder="+91 98000 00000" type="tel" />
                        </Field>
                        <Field label="Website">
                            <Input value={local?.website ?? ""} onChange={v => patch({ website: v })} placeholder="https://org.com" type="url" />
                        </Field>
                        <Field label="Timezone">
                            <Select value={local?.defaultTimezone ?? "Asia/Kolkata"} onChange={v => patch({ defaultTimezone: v })}
                                options={TIMEZONES.map(z => ({ value: z, label: z }))} />
                        </Field>
                        <Field label="Currency">
                            <Select value={local?.defaultCurrency ?? "INR"} onChange={v => patch({ defaultCurrency: v })}
                                options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                        </Field>
                    </div>
                </section>

                <Divider />

                {/* ── Security ─────────────────────────────────────────────── */}
                <section className="space-y-6">
                    <Label>Security</Label>
                    {resetError ? <p className="text-[13px] text-red-400">{resetError}</p> : null}

                    {/* Password reset */}
                    {!isGoogleUser && (
                        <div className="flex items-center justify-between p-5 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)]">
                            <div>
                                <p className="text-[14px] font-black text-text-primary">Password</p>
                                <p className="text-[12px] text-[var(--v-text-tertiary)] mt-0.5">Send a reset link to {user?.email}</p>
                            </div>
                            {resetSent ? (
                                <span className="flex items-center gap-2 text-[12px] font-black text-[var(--v-success)] uppercase tracking-wider">
                                    <CheckCircle2 className="w-4 h-4" /> Sent
                                </span>
                            ) : (
                                <VenueActionButton variant="secondary" className="h-9 px-5 text-[12px]"
                                    onClick={handleResetPassword} disabled={resetLoading}>
                                    {resetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reset Password"}
                                </VenueActionButton>
                            )}
                        </div>
                    )}

                    {isGoogleUser && (
                        <div className="flex items-center justify-between p-5 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)]">
                            <div>
                                <p className="text-[14px] font-black text-text-primary">Google Account</p>
                                <p className="text-[12px] text-[var(--v-text-tertiary)] mt-0.5">Signed in via Google — manage password at accounts.google.com</p>
                            </div>
                        </div>
                    )}

                    {/* Sessions */}
                    <div className="space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--v-text-tertiary)] px-1">Active Sessions</p>

                        {sessionsLoading ? (
                            <div className="py-8 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-[var(--v-text-tertiary)]" />
                            </div>
                        ) : (
                            <>
                                {/* Current session */}
                                {sessions.find(s => s.sessionId === currentSid) && (
                                    <div className="flex items-center justify-between p-5 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)]">
                                        <div className="flex items-center gap-4">
                                            {sessions.find(s => s.sessionId === currentSid)?.deviceType === "mobile"
                                                ? <Smartphone className="w-4 h-4 text-[var(--v-text-tertiary)] shrink-0" />
                                                : <Monitor className="w-4 h-4 text-[var(--v-text-tertiary)] shrink-0" />
                                            }
                                            <div>
                                                <p className="text-[14px] font-black text-text-primary">
                                                    {parseBrowser(sessions.find(s => s.sessionId === currentSid)?.userAgent ?? null)}
                                                </p>
                                                <p className="text-[12px] text-[var(--v-text-tertiary)] mt-0.5">
                                                    Active {relativeTime(sessions.find(s => s.sessionId === currentSid)?.lastActiveAt ?? new Date().toISOString())}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-orange)]">Current</span>
                                    </div>
                                )}

                                {/* Other sessions */}
                                {otherSessions.map(s => (
                                    <div key={s.sessionId} className="flex items-center justify-between p-5 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)]">
                                        <div className="flex items-center gap-4">
                                            {s.deviceType === "mobile"
                                                ? <Smartphone className="w-4 h-4 text-[var(--v-text-tertiary)] shrink-0" />
                                                : <Monitor className="w-4 h-4 text-[var(--v-text-tertiary)] shrink-0" />
                                            }
                                            <div>
                                                <p className="text-[14px] font-black text-text-primary">{parseBrowser(s.userAgent)}</p>
                                                <p className="text-[12px] text-[var(--v-text-tertiary)] mt-0.5">Active {relativeTime(s.lastActiveAt)}</p>
                                            </div>
                                        </div>
                                        <VenueActionButton variant="secondary" className="h-8 px-4 text-[11px]"
                                            onClick={() => handleRevoke(s.sessionId)} disabled={isRevoking}>
                                            {isRevoking ? <Loader2 className="w-3 h-3 animate-spin" /> : "Revoke"}
                                        </VenueActionButton>
                                    </div>
                                ))}

                                {sessions.length === 0 && (
                                    <p className="text-[13px] text-[var(--v-text-tertiary)] px-1">No active sessions found.</p>
                                )}

                                {otherSessions.length > 0 && (
                                    <button onClick={handleRevokeAll} disabled={isRevoking}
                                        className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-[var(--v-text-tertiary)] hover:text-text-primary transition-all disabled:opacity-50 px-1 py-2">
                                        {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                                        Sign out all other devices
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </section>

                <Divider />

                {/* ── Notifications ─────────────────────────────────────────── */}
                <section className="space-y-5">
                    <Label>Notifications</Label>

                    {/* Channel header */}
                    <div className="grid grid-cols-4 gap-3 px-1">
                        <div />
                        {NOTIF_CHANNELS.map(ch => (
                            <p key={ch.key} className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--v-text-tertiary)] text-center">{ch.label}</p>
                        ))}
                    </div>

                    <div className="space-y-2">
                        {NOTIF_CATEGORIES.map(cat => (
                            <div key={cat.key} className="grid grid-cols-4 gap-3 items-center px-5 py-4 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)]">
                                <p className="text-[13px] font-bold text-text-primary">{cat.label}</p>
                                {NOTIF_CHANNELS.map(ch => {
                                    const k = `${cat.key}_${ch.key}`;
                                    const on = (local?.notificationPreferences?.[k]) ?? false;
                                    return (
                                        <div key={ch.key} className="flex items-center justify-center">
                                            <button onClick={() => patch({ notificationPreferences: { ...local?.notificationPreferences, [k]: !on } })}
                                                className={`relative w-10 h-[22px] rounded-full transition-all ${on ? "bg-[var(--v-success)]" : "bg-surface-elevated"}`}>
                                                <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all ${on ? "left-[20px]" : "left-0.5"}`} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </section>

            </div>

            {/* ── Floating save bar ──────────────────────────────────────────── */}
            <AnimatePresence>
                {isDirty && (
                    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl bg-[var(--v-card)] border border-[var(--v-border)]">
                        {saveError && <span className="text-[12px] font-bold text-[var(--v-error)]">{saveError}</span>}
                        {!saveError && <span className="text-[12px] font-black uppercase tracking-wider text-[var(--v-text-secondary)]">Unsaved changes</span>}
                        <button onClick={handleReset}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--v-elevated)] text-[11px] font-black uppercase tracking-wider text-[var(--v-text-secondary)] hover:text-text-primary transition-all">
                            <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                        <VenueActionButton variant="primary" className="h-9 px-5 text-[12px]"
                            onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                            Save
                        </VenueActionButton>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Re-auth modal ──────────────────────────────────────────────── */}
            <AnimatePresence>
                {needsReAuth && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setNeedsReAuth(false); setReAuthPw(""); }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-2xl p-8 space-y-6">
                            <button onClick={() => { setNeedsReAuth(false); setReAuthPw(""); }}
                                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[var(--v-elevated)] flex items-center justify-center hover:bg-surface-tertiary transition-all">
                                <X className="w-3.5 h-3.5 text-[var(--v-text-tertiary)]" />
                            </button>
                            <div>
                                <div className="w-10 h-10 rounded-2xl bg-[var(--v-orange)]/10 border border-[var(--v-orange)]/20 flex items-center justify-center mb-4">
                                    <Lock className="w-5 h-5 text-[var(--v-orange)]" />
                                </div>
                                <h2 className="text-[18px] font-black text-text-primary">Confirm identity</h2>
                                <p className="text-[13px] font-medium mt-1 text-[var(--v-text-tertiary)]">Session older than 15 minutes.</p>
                            </div>
                            {!isGoogleUser ? (
                                <div className="space-y-4">
                                    <input type="password" value={reAuthPw} onChange={e => setReAuthPw(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleReAuth()}
                                        placeholder="Enter password" autoFocus
                                        className="w-full bg-[var(--v-elevated)] border border-[var(--v-border)] rounded-xl px-4 py-3 text-[14px] font-bold text-text-primary outline-none focus:border-[var(--v-orange)]/50 transition-all placeholder:text-[var(--v-text-muted)]" />
                                    {reAuthErr && <p className="text-[12px] font-bold text-[var(--v-error)]">{reAuthErr}</p>}
                                    <VenueActionButton variant="primary" className="w-full h-11 text-[13px]"
                                        onClick={handleReAuth} disabled={reAuthBusy || !reAuthPw}>
                                        {reAuthBusy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                                        Confirm
                                    </VenueActionButton>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reAuthErr && <p className="text-[12px] font-bold text-[var(--v-error)]">{reAuthErr}</p>}
                                    <VenueActionButton variant="secondary" className="w-full h-11 text-[13px]"
                                        onClick={handleReAuth} disabled={reAuthBusy}>
                                        {reAuthBusy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                                        Continue with Google
                                    </VenueActionButton>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </VenuePageShell>
    );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
    return <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">{children}</p>;
}

function Divider() {
    return <div className="h-px bg-[var(--v-border)] opacity-40" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--v-text-tertiary)]">{label}</p>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-[var(--v-elevated)] border border-[var(--v-border)] rounded-xl px-4 py-3 text-[14px] font-bold text-text-primary outline-none focus:border-[var(--v-orange)]/50 transition-all placeholder:text-[var(--v-text-muted)]" />
    );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full bg-[var(--v-elevated)] border border-[var(--v-border)] rounded-xl px-4 py-3 text-[14px] font-bold text-text-primary outline-none focus:border-[var(--v-orange)]/50 transition-all appearance-none cursor-pointer">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}
