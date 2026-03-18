"use client";

import { useState, useEffect } from "react";
import {
    Bell,
    Shield,
    Globe,
    CreditCard,
    Palette,
    LogOut,
    ChevronRight,
    ToggleLeft,
    ToggleRight,
    Loader2,
    CheckCircle2,
    Moon,
    Sun,
    Smartphone
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";

interface SettingsSection {
    id: string;
    title: string;
    icon: any;
    description: string;
}

const SECTIONS: SettingsSection[] = [
    { id: "notifications", title: "Notifications", icon: Bell, description: "Control what alerts you receive" },
    { id: "privacy", title: "Privacy & Visibility", icon: Shield, description: "Manage your public profile visibility" },
    { id: "payments", title: "Payment Preferences", icon: CreditCard, description: "Default payout method and details" },
    { id: "links", title: "Link Defaults", icon: Globe, description: "Default settings for generated links" },
];

export default function SettingsPage() {
    const { profile, user } = useDashboardAuth();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [settings, setSettings] = useState({
        // Notifications
        notifyNewSale: true,
        notifyCheckIn: true,
        notifyPayout: true,
        notifyPartnership: true,
        notifyWeeklyReport: true,
        emailDigest: false,

        // Privacy
        profilePublic: true,
        showEarnings: false,
        showSalesCount: true,
        discoverableByHosts: true,

        // Payments
        defaultPaymentMethod: "upi" as "upi" | "bank_transfer",
        defaultUpiId: "",
        autoRequestPayout: false,
        minimumPayoutAmount: 500,

        // Links
        defaultChannel: "" as string,
        includeUtmParams: true,
    });

    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        // Load saved settings from API/localStorage
        const saved = localStorage.getItem(`promoter_settings_${promoterId}`);
        if (saved) {
            try {
                setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
            } catch { }
        }
    }, [promoterId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save to localStorage for now, can be persisted to Firestore
            localStorage.setItem(`promoter_settings_${promoterId}`, JSON.stringify(settings));

            // Also try to save to server
            const token = await user?.getIdToken();
            await fetch('/api/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    profileId: promoterId,
                    type: "promoter",
                    action: "updateSettings",
                    data: { settings, updatedAt: new Date().toISOString() }
                })
            }).catch(() => { /* silently fail, localStorage is backup */ });

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-7 rounded-full transition-all duration-200 ${checked ? "bg-emerald-500" : "bg-surface-tertiary"}`}
        >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
        </button>
    );

    return (
        <VenuePageShell
            title="Settings"
            subtitle="Customize your promoter experience, notifications, and preferences"
            actions={
                <VenueActionButton variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
                    <span className="ml-2">{saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}</span>
                </VenueActionButton>
            }
        >

            {/* Notifications */}
            <SettingsCard title="Notifications" icon={Bell} description="Control which alerts you receive">
                <SettingsRow label="New Sale Alerts" description="Get notified when someone buys through your link">
                    <Toggle checked={settings.notifyNewSale} onChange={v => setSettings(p => ({ ...p, notifyNewSale: v }))} />
                </SettingsRow>
                <SettingsRow label="Check-in Notifications" description="Know when your guests enter the event">
                    <Toggle checked={settings.notifyCheckIn} onChange={v => setSettings(p => ({ ...p, notifyCheckIn: v }))} />
                </SettingsRow>
                <SettingsRow label="Payout Updates" description="Track payout request status changes">
                    <Toggle checked={settings.notifyPayout} onChange={v => setSettings(p => ({ ...p, notifyPayout: v }))} />
                </SettingsRow>
                <SettingsRow label="Partnership Activity" description="New connection requests and approvals">
                    <Toggle checked={settings.notifyPartnership} onChange={v => setSettings(p => ({ ...p, notifyPartnership: v }))} />
                </SettingsRow>
                <SettingsRow label="Weekly Performance Report" description="Receive a summary of your weekly stats">
                    <Toggle checked={settings.notifyWeeklyReport} onChange={v => setSettings(p => ({ ...p, notifyWeeklyReport: v }))} />
                </SettingsRow>
                <SettingsRow label="Email Digest" description="Receive a daily email with key metrics" last>
                    <Toggle checked={settings.emailDigest} onChange={v => setSettings(p => ({ ...p, emailDigest: v }))} />
                </SettingsRow>
            </SettingsCard>

            {/* Privacy */}
            <SettingsCard title="Privacy & Visibility" icon={Shield} description="Manage your public presence">
                <SettingsRow label="Public Profile" description="Allow hosts to find you in the promoter directory">
                    <Toggle checked={settings.profilePublic} onChange={v => setSettings(p => ({ ...p, profilePublic: v }))} />
                </SettingsRow>
                <SettingsRow label="Show Sales Count" description="Display your total sales on public profile">
                    <Toggle checked={settings.showSalesCount} onChange={v => setSettings(p => ({ ...p, showSalesCount: v }))} />
                </SettingsRow>
                <SettingsRow label="Discoverable by Hosts" description="Appear in host search results for partnerships" last>
                    <Toggle checked={settings.discoverableByHosts} onChange={v => setSettings(p => ({ ...p, discoverableByHosts: v }))} />
                </SettingsRow>
            </SettingsCard>

            {/* Payments */}
            <SettingsCard title="Payment Preferences" icon={CreditCard} description="Default payout settings">
                <SettingsRow label="Default Payment Method" description="Auto-fill when requesting payouts">
                    <select
                        value={settings.defaultPaymentMethod}
                        onChange={e => setSettings(p => ({ ...p, defaultPaymentMethod: e.target.value as any }))}
                        className="px-4 py-2 rounded-xl bg-surface-secondary border border-border-default text-sm font-semibold focus:outline-none focus:border-border-strong"
                    >
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                    </select>
                </SettingsRow>
                {settings.defaultPaymentMethod === "upi" && (
                    <SettingsRow label="Default UPI ID" description="Pre-fill your UPI ID for quick payouts">
                        <input
                            type="text"
                            value={settings.defaultUpiId}
                            onChange={e => setSettings(p => ({ ...p, defaultUpiId: e.target.value }))}
                            placeholder="you@upi"
                            className="px-4 py-2 rounded-xl bg-surface-secondary border border-border-default text-sm font-semibold focus:outline-none focus:border-border-strong w-48 text-right"
                        />
                    </SettingsRow>
                )}
                <SettingsRow label="Minimum Payout Amount" description="Won't process below this threshold" last>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm text-text-tertiary">₹</span>
                        <input
                            type="number"
                            value={settings.minimumPayoutAmount}
                            onChange={e => setSettings(p => ({ ...p, minimumPayoutAmount: parseInt(e.target.value) || 0 }))}
                            className="px-3 py-2 rounded-xl bg-surface-secondary border border-border-default text-sm font-semibold focus:outline-none focus:border-border-strong w-24 text-right"
                        />
                    </div>
                </SettingsRow>
            </SettingsCard>

            {/* Link Defaults */}
            <SettingsCard title="Link Defaults" icon={Globe} description="Configure how your links behave">
                <SettingsRow label="Include UTM Parameters" description="Append tracking params for your own analytics" last>
                    <Toggle checked={settings.includeUtmParams} onChange={v => setSettings(p => ({ ...p, includeUtmParams: v }))} />
                </SettingsRow>
            </SettingsCard>

        </VenuePageShell>
    );
}

function SettingsCard({ title, icon: Icon, description, children }: {
    title: string;
    icon: any;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-surface-elevated rounded-[2rem] border border-border-default overflow-hidden">
            <div className="p-6 pb-0">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-surface-secondary flex items-center justify-center">
                        <Icon className="w-4.5 h-4.5 text-text-tertiary" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-text-primary">{title}</h3>
                        <p className="text-[11px] text-text-placeholder font-medium">{description}</p>
                    </div>
                </div>
            </div>
            <div className="px-6 py-4">{children}</div>
        </div>
    );
}

function SettingsRow({ label, description, children, last = false }: {
    label: string;
    description: string;
    children: React.ReactNode;
    last?: boolean;
}) {
    return (
        <div className={`flex items-center justify-between py-4 ${!last ? "border-b border-border-subtle" : ""}`}>
            <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-semibold text-text-primary">{label}</p>
                <p className="text-[11px] text-text-placeholder font-medium mt-0.5">{description}</p>
            </div>
            {children}
        </div>
    );
}
