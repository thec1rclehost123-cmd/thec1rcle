"use client";

import { useEffect, useState } from "react";
import { Save, CreditCard, Lock, Smartphone } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { TabBar } from "@/components/ui/TabBar";
import { SettingsSection, SettingsRow } from "@/components/ui/SettingsSection";
import { Toggle } from "@/components/ui/Toggle";

// ── Shared input/select style ─────────────────────────────────────────────────
const fieldStyle: React.CSSProperties = {
    background: "var(--bg-fill)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--r-sm)",
    padding: "9px 12px",
    fontSize: "13px",
    outline: "none",
    width: "100%",
    transition: "border-color var(--t-base)",
};

function Field({ type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            type={type}
            style={fieldStyle}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--border-default)"; }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--border-subtle)"; }}
            {...props}
        />
    );
}

function SelectField({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            style={{ ...fieldStyle, appearance: "none" } as React.CSSProperties}
            onFocus={(e) => { (e.target as HTMLSelectElement).style.borderColor = "var(--border-default)"; }}
            onBlur={(e) => { (e.target as HTMLSelectElement).style.borderColor = "var(--border-subtle)"; }}
            {...props}
        >
            {children}
        </select>
    );
}

// ── Tab content panels ─────────────────────────────────────────────────────────

function GeneralPanel({ onChange }: { onChange: () => void }) {
    return (
        <div className="max-w-[600px]">
            <SettingsSection label="CONTACT">
                <SettingsRow
                    label="Admin Email"
                    description="Used for billing alerts and technical notifications"
                    control={<Field type="email" defaultValue="admin@highspirits.com" onChange={onChange} />}
                />
                <SettingsRow
                    label="Support Hotline"
                    description="Shown publicly for guest assistance"
                    control={<Field type="text" defaultValue="+91 98765 43210" onChange={onChange} />}
                />
            </SettingsSection>

            <SettingsSection label="LOCALIZATION">
                <SettingsRow
                    label="Timezone"
                    control={
                        <SelectField onChange={onChange}>
                            <option>(GMT+05:30) India Standard Time</option>
                            <option>(GMT+00:00) UTC</option>
                        </SelectField>
                    }
                />
                <SettingsRow
                    label="Language"
                    control={
                        <SelectField onChange={onChange}>
                            <option>English (International)</option>
                            <option>Hindi (Localized)</option>
                        </SelectField>
                    }
                />
                <SettingsRow
                    label="Currency"
                    description="Fixed to Indian Rupee for this market"
                    control={<Field defaultValue="₹ Indian Rupee (INR)" readOnly style={{ ...fieldStyle, opacity: 0.6, cursor: "not-allowed" }} />}
                />
            </SettingsSection>
        </div>
    );
}

function PayoutsPanel({ onChange }: { onChange: () => void }) {
    return (
        <div className="max-w-[600px]">
            <SettingsSection label="BANK ACCOUNT">
                <SettingsRow
                    label="Connect Bank Account"
                    description="Link an Indian savings or current account for settlements"
                    control={
                        <button
                            onClick={onChange}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-sm)] border border-[var(--border-default)] text-[13px] font-[500] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-all"
                        >
                            <CreditCard size={14} />
                            Connect Account
                        </button>
                    }
                    layout="inline"
                />
            </SettingsSection>

            <SettingsSection label="SETTLEMENT">
                <SettingsRow
                    label="Settlement Cadence"
                    description="How frequently funds are transferred to your bank account"
                    control={
                        <SelectField onChange={onChange}>
                            <option>T+2 Days (Standard)</option>
                            <option>T+1 Day (Express)</option>
                            <option>Weekly (Consolidated)</option>
                        </SelectField>
                    }
                />
            </SettingsSection>
        </div>
    );
}

function NotificationsPanel({ onChange }: { onChange: () => void }) {
    const [toggles, setToggles] = useState({
        revenue: true,
        partners: true,
        security: false,
        announcements: false,
    });

    const items = [
        { key: "revenue",       label: "Revenue Updates",       desc: "Real-time alerts for every ticket purchase" },
        { key: "partners",      label: "Partner Requests",      desc: "Alerts for collaboration and bookings" },
        { key: "security",      label: "Security Audit",        desc: "Scanner sync and staff login events" },
        { key: "announcements", label: "Product Announcements", desc: "Occasional updates about platform upgrades" },
    ] as const;

    return (
        <div className="max-w-[600px]">
            <SettingsSection label="EMAIL & PUSH">
                {items.map((item) => (
                    <SettingsRow
                        key={item.key}
                        label={item.label}
                        description={item.desc}
                        layout="inline"
                        control={
                            <Toggle
                                checked={toggles[item.key]}
                                onChange={(v) => {
                                    setToggles(prev => ({ ...prev, [item.key]: v }));
                                    onChange();
                                }}
                            />
                        }
                    />
                ))}
            </SettingsSection>
        </div>
    );
}

function SecurityPanel() {
    return (
        <div className="max-w-[600px]">
            <SettingsSection label="AUTHENTICATION">
                <SettingsRow
                    label="Password"
                    description="Update your admin account password"
                    layout="inline"
                    control={
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-sm)] border border-[var(--border-default)] text-[13px] font-[500] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-all">
                            <Lock size={14} />
                            Reset Password
                        </button>
                    }
                />
                <SettingsRow
                    label="Two-Factor Authentication"
                    description="Status: Deactivated — adds a second layer of verification at login"
                    layout="inline"
                    control={
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-sm)] border border-[var(--border-default)] text-[13px] font-[500] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-all">
                            <Smartphone size={14} />
                            Set Up 2FA
                        </button>
                    }
                />
            </SettingsSection>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

type SettingsTab = "general" | "payouts" | "notifications" | "security";

const TABS = [
    { key: "general",       label: "General"      },
    { key: "payouts",       label: "Payouts"      },
    { key: "notifications", label: "Notifications" },
    { key: "security",      label: "Security"     },
] as const;

export default function GeneralClient({ setActions }: { setActions: (actions: React.ReactNode) => void }) {
    const { success: toastSuccess } = useToast();
    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const markChanged = () => setHasChanges(true);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setHasChanges(false);
            toastSuccess("Settings saved", "Configuration has been updated.");
        }, 1500);
    };

    useEffect(() => {
        if (hasChanges || isSaving) {
            setActions(
                <VenueActionButton variant="primary" onClick={handleSave} disabled={isSaving}>
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Saving…" : "Save Changes"}
                </VenueActionButton>
            );
        } else {
            setActions(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasChanges, isSaving]);

    return (
        <div>
            {/* Inline tab bar — underline mode, no separate toolbar needed here */}
            <div className="mb-6 border-b border-[var(--border-subtle)]">
                <TabBar
                    mode="underline"
                    tabs={TABS.map(t => ({ key: t.key, label: t.label }))}
                    active={activeTab}
                    onChange={(k) => setActiveTab(k as SettingsTab)}
                />
            </div>

            {/* Content — instant switch, no AnimatePresence */}
            {activeTab === "general"       && <GeneralPanel       onChange={markChanged} />}
            {activeTab === "payouts"       && <PayoutsPanel       onChange={markChanged} />}
            {activeTab === "notifications" && <NotificationsPanel onChange={markChanged} />}
            {activeTab === "security"      && <SecurityPanel />}
        </div>
    );
}
