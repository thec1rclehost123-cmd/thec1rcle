"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Banknote,
    Bell,
    Building2,
    CreditCard,
    Loader2,
    Save,
    Settings,
    Shield,
    Smartphone,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import type { VenueSettings } from "@/lib/server/venueSettingsStore";

type SettingsTab = "general" | "payouts" | "notifications" | "security";

const TABS: Array<{ id: SettingsTab; label: string; icon: any }> = [
    { id: "general", label: "General", icon: Settings },
    { id: "payouts", label: "Payouts & Bank", icon: Banknote },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
];

const TIMEZONES = [
    "America/Phoenix",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Dubai",
];

const LANGUAGES = ["English (US)", "English (UK)", "Spanish", "French"];

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: any }) {
    return (
        <div className="mb-8 flex items-start gap-4">
            {Icon ? (
                <div className="rounded-2xl border border-[var(--v-border)] bg-[var(--v-elevated)] p-3">
                    <Icon size={22} className="text-[var(--c1rcle-orange)]" />
                </div>
            ) : null}
            <div>
                <h3 className="text-2xl font-black tracking-tight text-[var(--v-text-primary)]">{title}</h3>
                {subtitle ? (
                    <p className="mt-1 text-sm leading-relaxed text-[var(--v-text-secondary)]">{subtitle}</p>
                ) : null}
            </div>
        </div>
    );
}

function Field({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-[var(--v-text-tertiary)]">
                {label}
            </label>
            {children}
            {description ? (
                <p className="text-xs leading-relaxed text-[var(--v-text-secondary)]">{description}</p>
            ) : null}
        </div>
    );
}

function inputClassName() {
    return "h-14 w-full rounded-[20px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-5 text-sm font-medium text-[var(--v-text-primary)] outline-none transition-all placeholder:text-[var(--v-text-tertiary)] focus:border-[var(--c1rcle-orange)]/40";
}

function ToggleRow({
    title,
    description,
    enabled,
    onToggle,
}: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-5 py-4 text-left transition-all hover:border-[var(--c1rcle-orange)]/25"
        >
            <div className="min-w-0">
                <p className="text-base font-bold text-[var(--v-text-primary)]">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--v-text-secondary)]">{description}</p>
            </div>
            <div
                className={cn(
                    "relative h-7 w-12 rounded-full border transition-all",
                    enabled
                        ? "border-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange)]"
                        : "border-[var(--v-border)] bg-black/20"
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                        enabled ? "left-[25px]" : "left-0.5"
                    )}
                />
            </div>
        </button>
    );
}

export default function VenueSettingsClient({ setActions }: { setActions: (actions: React.ReactNode) => void }) {
    const { success: toastSuccess, error: toastError } = useToast();
    const { profile, user } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const [settings, setSettings] = useState<VenueSettings | null>(null);
    const [local, setLocal] = useState<VenueSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        if (!venueId) return;
        setLoading(true);
        try {
            const token = user ? await user.getIdToken() : "";
            const response = await fetch(`/api/venue/settings?venueId=${venueId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!response.ok) throw new Error("Failed to load settings");
            const data = await response.json();
            const next = data.settings ?? data;
            setSettings(next);
            setLocal(next);
        } catch (error) {
            toastError("Settings unavailable", "Venue settings could not be loaded.");
        } finally {
            setLoading(false);
        }
    }, [toastError, user, venueId]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const isDirty = useMemo(
        () => JSON.stringify(local) !== JSON.stringify(settings),
        [local, settings]
    );

    const patch = useCallback((updater: (current: VenueSettings) => VenueSettings) => {
        setLocal(current => (current ? updater(current) : current));
    }, []);

    const handleSave = useCallback(async () => {
        if (!venueId || !local || !settings) return;
        setSaving(true);
        try {
            const diff: Partial<VenueSettings> = {};
            for (const key of Object.keys(local) as Array<keyof VenueSettings>) {
                if (JSON.stringify(local[key]) !== JSON.stringify(settings[key])) {
                    (diff as any)[key] = local[key];
                }
            }

            const token = user ? await user.getIdToken() : "";
            const response = await fetch("/api/venue/settings", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ venueId, patch: diff }),
            });
            if (!response.ok) throw new Error("Save failed");

            const data = await response.json();
            const updated = data.settings ?? { ...settings, ...diff };
            setSettings(updated);
            setLocal(updated);
            toastSuccess("Settings saved", "Venue settings have been updated.");
        } catch (error) {
            toastError("Save failed", "Your changes could not be saved.");
        } finally {
            setSaving(false);
        }
    }, [local, settings, toastError, toastSuccess, user, venueId]);

    useEffect(() => {
        if (isDirty || saving) {
            setActions(
                <VenueActionButton variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
                </VenueActionButton>
            );
        } else {
            setActions(null);
        }
    }, [handleSave, isDirty, saving, setActions]);

    if (loading || !local) {
        return (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--c1rcle-orange)]" />
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--v-text-tertiary)]">
                    Loading Settings
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="inline-flex rounded-[24px] border border-[var(--v-border)] bg-[var(--v-card)] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-[18px] px-6 py-3 text-sm font-black transition-all",
                            activeTab === tab.id
                                ? "bg-[var(--v-elevated)] text-[var(--v-text-primary)] shadow-md"
                                : "text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)]"
                        )}
                    >
                        <tab.icon size={18} className={activeTab === tab.id ? "text-[var(--c1rcle-orange)]" : ""} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <BentoCard padding="lg" className="overflow-visible border-[var(--v-border)] shadow-[0_30px_90px_rgba(0,0,0,0.2)]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: 0.24 }}
                        className="space-y-8"
                    >
                        {activeTab === "general" ? (
                            <>
                                <SectionHeader
                                    title="General Settings"
                                    subtitle="Keep your venue contact details and operating preferences up to date."
                                    icon={Building2}
                                />
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <Field label="Admin Email" description="Used for internal alerts and account follow-up.">
                                        <input
                                            type="email"
                                            value={local.adminEmail}
                                            onChange={event =>
                                                patch(current => ({ ...current, adminEmail: event.target.value }))
                                            }
                                            className={inputClassName()}
                                        />
                                    </Field>
                                    <Field label="Support Hotline" description="Shown to staff or guests when support is needed.">
                                        <input
                                            value={local.supportHotline}
                                            onChange={event =>
                                                patch(current => ({ ...current, supportHotline: event.target.value }))
                                            }
                                            className={inputClassName()}
                                        />
                                    </Field>
                                    <Field label="Operational Timezone">
                                        <select
                                            value={local.operationalTimezone}
                                            onChange={event =>
                                                patch(current => ({
                                                    ...current,
                                                    operationalTimezone: event.target.value,
                                                }))
                                            }
                                            className={inputClassName()}
                                        >
                                            {TIMEZONES.map(timezone => (
                                                <option key={timezone} value={timezone}>
                                                    {timezone}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Primary Language">
                                        <select
                                            value={local.primaryLanguage}
                                            onChange={event =>
                                                patch(current => ({
                                                    ...current,
                                                    primaryLanguage: event.target.value,
                                                }))
                                            }
                                            className={inputClassName()}
                                        >
                                            {LANGUAGES.map(language => (
                                                <option key={language} value={language}>
                                                    {language}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                            </>
                        ) : null}

                        {activeTab === "payouts" ? (
                            <>
                                <SectionHeader
                                    title="Payouts & Bank"
                                    subtitle="Save the account details used to track where venue settlements should go."
                                    icon={Banknote}
                                />
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <Field label="Account Name">
                                        <input
                                            value={local.bankAccountName}
                                            onChange={event =>
                                                patch(current => ({
                                                    ...current,
                                                    bankAccountName: event.target.value,
                                                }))
                                            }
                                            className={inputClassName()}
                                        />
                                    </Field>
                                    <Field
                                        label="Account Reference"
                                        description="Store only a masked reference, never the full account number."
                                    >
                                        <input
                                            value={local.bankAccountMasked}
                                            onChange={event =>
                                                patch(current => ({
                                                    ...current,
                                                    bankAccountMasked: event.target.value,
                                                }))
                                            }
                                            placeholder="Ending in 4821"
                                            className={inputClassName()}
                                        />
                                    </Field>
                                    <Field label="Settlement Cadence" description="How often your payouts should be grouped.">
                                        <select
                                            value={local.settlementCadence}
                                            onChange={event =>
                                                patch(current => ({
                                                    ...current,
                                                    settlementCadence: event.target.value as VenueSettings["settlementCadence"],
                                                }))
                                            }
                                            className={inputClassName()}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </Field>
                                    <div className="rounded-[28px] border border-[var(--v-border)] bg-[var(--v-elevated)] p-6">
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="rounded-2xl bg-black/20 p-3">
                                                <CreditCard size={22} className="text-[var(--c1rcle-orange)]" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-[var(--v-text-primary)]">
                                                    Banking Snapshot
                                                </p>
                                                <p className="text-sm text-[var(--v-text-secondary)]">
                                                    Keep this current so settlements are easy to verify.
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-[var(--v-text-secondary)]">
                                            Account holder:{" "}
                                            <span className="font-semibold text-[var(--v-text-primary)]">
                                                {local.bankAccountName || "Not set"}
                                            </span>
                                        </p>
                                        <p className="mt-2 text-sm text-[var(--v-text-secondary)]">
                                            Account reference:{" "}
                                            <span className="font-semibold text-[var(--v-text-primary)]">
                                                {local.bankAccountMasked || "Not set"}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : null}

                        {activeTab === "notifications" ? (
                            <>
                                <SectionHeader
                                    title="Notifications"
                                    subtitle="Decide which alerts matter enough to reach your team."
                                    icon={Bell}
                                />
                                <div className="grid grid-cols-1 gap-4">
                                    <ToggleRow
                                        title="Revenue Updates"
                                        description="Alert the venue when ticket sales and revenue activity change."
                                        enabled={local.notifications.revenueUpdates}
                                        onToggle={() =>
                                            patch(current => ({
                                                ...current,
                                                notifications: {
                                                    ...current.notifications,
                                                    revenueUpdates: !current.notifications.revenueUpdates,
                                                },
                                            }))
                                        }
                                    />
                                    <ToggleRow
                                        title="Partner Requests"
                                        description="Get notified when hosts or partners need venue attention."
                                        enabled={local.notifications.partnerRequests}
                                        onToggle={() =>
                                            patch(current => ({
                                                ...current,
                                                notifications: {
                                                    ...current.notifications,
                                                    partnerRequests: !current.notifications.partnerRequests,
                                                },
                                            }))
                                        }
                                    />
                                    <ToggleRow
                                        title="Security Audit"
                                        description="See important alerts for staff access and live security changes."
                                        enabled={local.notifications.securityAudit}
                                        onToggle={() =>
                                            patch(current => ({
                                                ...current,
                                                notifications: {
                                                    ...current.notifications,
                                                    securityAudit: !current.notifications.securityAudit,
                                                },
                                            }))
                                        }
                                    />
                                    <ToggleRow
                                        title="Product Announcements"
                                        description="Receive occasional updates when the platform changes in meaningful ways."
                                        enabled={local.notifications.productAnnouncements}
                                        onToggle={() =>
                                            patch(current => ({
                                                ...current,
                                                notifications: {
                                                    ...current.notifications,
                                                    productAnnouncements: !current.notifications.productAnnouncements,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                            </>
                        ) : null}

                        {activeTab === "security" ? (
                            <>
                                <SectionHeader
                                    title="Security"
                                    subtitle="Keep owner-level access clear and protected without extra complexity."
                                    icon={Shield}
                                />
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    <div className="rounded-[30px] border border-[var(--v-border)] bg-[var(--v-elevated)] p-7">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--c1rcle-orange)]">
                                            Credentials
                                        </p>
                                        <h4 className="mt-3 text-2xl font-black tracking-tight text-[var(--v-text-primary)]">
                                            Master Password
                                        </h4>
                                        <p className="mt-2 text-sm leading-relaxed text-[var(--v-text-secondary)]">
                                            Record when your main venue password was last updated so the team can keep it fresh.
                                        </p>
                                        <input
                                            type="datetime-local"
                                            value={
                                                local.security.masterPasswordUpdatedAt
                                                    ? local.security.masterPasswordUpdatedAt.slice(0, 16)
                                                    : ""
                                            }
                                            onChange={event =>
                                                patch(current => ({
                                                    ...current,
                                                    security: {
                                                        ...current.security,
                                                        masterPasswordUpdatedAt: event.target.value
                                                            ? new Date(event.target.value).toISOString()
                                                            : null,
                                                    },
                                                }))
                                            }
                                            className={cn(inputClassName(), "mt-5")}
                                        />
                                    </div>

                                    <div className="rounded-[30px] border border-[var(--v-border)] bg-[var(--v-elevated)] p-7">
                                        <div className="flex items-start gap-4">
                                            <div className="rounded-2xl bg-black/20 p-3">
                                                <Smartphone size={22} className="text-[var(--c1rcle-orange)]" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--c1rcle-orange)]">
                                                    Protection
                                                </p>
                                                <h4 className="mt-2 text-2xl font-black tracking-tight text-[var(--v-text-primary)]">
                                                    Two-Factor Authentication
                                                </h4>
                                                <p className="mt-2 text-sm leading-relaxed text-[var(--v-text-secondary)]">
                                                    Toggle this on when you want an extra verification step for critical access.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                patch(current => ({
                                                    ...current,
                                                    security: {
                                                        ...current.security,
                                                        twoFactorEnabled: !current.security.twoFactorEnabled,
                                                    },
                                                }))
                                            }
                                            className={cn(
                                                "mt-6 inline-flex h-12 items-center justify-center rounded-full px-6 text-xs font-black uppercase tracking-[0.18em] transition-all",
                                                local.security.twoFactorEnabled
                                                    ? "bg-[var(--c1rcle-orange)] text-white"
                                                    : "border border-[var(--v-border)] bg-[var(--v-card)] text-[var(--v-text-primary)]"
                                            )}
                                        >
                                            {local.security.twoFactorEnabled ? "2FA Enabled" : "Enable 2FA"}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </motion.div>
                </AnimatePresence>
            </BentoCard>
        </div>
    );
}
