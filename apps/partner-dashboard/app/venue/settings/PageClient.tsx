"use client";

import { useState } from "react";
import {
    Settings,
    CreditCard,
    Bell,
    Shield,
    Smartphone,
    Receipt,
    Percent,
    Building2,
    Banknote,
    AlertCircle,
    Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";

const inputStyle: React.CSSProperties = {
    background: "var(--v-elevated)",
    color: "var(--v-text-primary)",
    border: "1px solid var(--v-border)",
    borderRadius: 12,
    padding: "9px 14px",
    fontSize: 13,
    outline: "none",
    width: "100%",
};

export default function VenueSettingsPage() {
    const { success: toastSuccess } = useToast();
    const [activeTab, setActiveTab] = useState<"general" | "ticketing" | "payouts" | "notifications" | "security">("general");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            toastSuccess("Settings saved", "Platform configuration has been updated.");
        }, 1500);
    };

    const tabs = [
        { id: "general",       label: "General",           icon: Settings },
        { id: "ticketing",     label: "Ticketing & Taxes", icon: Receipt  },
        { id: "payouts",       label: "Payouts & Bank",    icon: Banknote },
        { id: "notifications", label: "Notifications",     icon: Bell     },
        { id: "security",      label: "Security",          icon: Shield   },
    ];

    return (
        <VenuePageShell
            title="Settings"
            subtitle="Manage your venue's technical and operational core"
            actions={
                <VenueActionButton variant="primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
                </VenueActionButton>
            }
        >
            {/* Tab navigation */}
            <div
                className="flex p-1 rounded-xl overflow-x-auto gap-0.5"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap px-2"
                        style={{
                            background: activeTab === tab.id ? "var(--v-elevated)" : "transparent",
                            color: activeTab === tab.id ? "var(--v-text-primary)" : "var(--v-text-muted)",
                        }}
                    >
                        <tab.icon className="w-3 h-3 flex-shrink-0" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            <BentoCard padding="md">
                <AnimatePresence mode="wait">
                    {activeTab === "general" && (
                        <motion.div
                            key="general"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-5"
                        >
                            <SectionHeader title="Basic Configuration" subtitle="Primary identity and contact settings" icon={Building2} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormGroup label="Admin Contact Email" description="Used for technical alerts and billing.">
                                    <input type="email" defaultValue="admin@highspirits.com" style={inputStyle} />
                                </FormGroup>
                                <FormGroup label="Support Contact" description="Displayed to customers on tickets.">
                                    <input type="text" defaultValue="+91 98765 43210" style={inputStyle} />
                                </FormGroup>
                                <FormGroup label="Timezone" description="Affects event listings and logs.">
                                    <select style={inputStyle}>
                                        <option>(GMT+05:30) India Standard Time</option>
                                        <option>(GMT+00:00) UTC</option>
                                    </select>
                                </FormGroup>
                                <FormGroup label="Default Language" description="Primary language for customer comms.">
                                    <select style={inputStyle}>
                                        <option>English (Global)</option>
                                        <option>Hindi (India)</option>
                                    </select>
                                </FormGroup>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "ticketing" && (
                        <motion.div
                            key="ticketing"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-5"
                        >
                            <SectionHeader title="Taxation & Fees" subtitle="Manage how fees and taxes are calculated" icon={Percent} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormGroup label="GST Rate (%)" description="Standard GST applied to all tickets.">
                                    <input type="number" defaultValue="18" style={inputStyle} />
                                </FormGroup>
                                <FormGroup label="Platform Fee Strategy" description="How the platform fee is displayed.">
                                    <select style={inputStyle}>
                                        <option>Customer Pays (Added to price)</option>
                                        <option>Venue Absorbs (Subtracted from price)</option>
                                    </select>
                                </FormGroup>
                            </div>
                            <div
                                className="p-3 rounded-xl flex items-start gap-2.5"
                                style={{ background: "var(--v-info-bg)", border: "1px solid rgba(129,140,248,0.2)" }}
                            >
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--v-info)" }} />
                                <p className="text-[11px] leading-relaxed" style={{ color: "var(--v-text-secondary)" }}>
                                    Ensure your GST number is correctly updated in <b>Page Presence › Business Details</b>. All invoices generated by C1RCLE will use these settings for calculating settlements.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "payouts" && (
                        <motion.div
                            key="payouts"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-5"
                        >
                            <SectionHeader title="Financial Settlements" subtitle="Manage bank accounts and payout cycles" icon={CreditCard} />
                            <div className="space-y-2">
                                <div
                                    className="flex items-center justify-between p-4 rounded-xl"
                                    style={{ border: "1px solid var(--v-border)", background: "var(--v-elevated)" }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                                            style={{ background: "var(--v-card)" }}
                                        >
                                            <Banknote className="w-4 h-4" style={{ color: "var(--v-text-muted)" }} />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>HDFC BANK LTD</p>
                                            <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>SAVINGS **** 8821</p>
                                        </div>
                                    </div>
                                    <span
                                        className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                                        style={{ background: "var(--v-success-bg)", color: "var(--v-success)" }}
                                    >
                                        Verified
                                    </span>
                                </div>
                                <button
                                    className="w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all hover:brightness-125 flex items-center justify-center gap-2"
                                    style={{ border: "1px dashed var(--v-border)", color: "var(--v-text-muted)" }}
                                >
                                    + Add Bank Account
                                </button>
                            </div>
                            <div
                                className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                                style={{ borderTop: "1px solid var(--v-border)" }}
                            >
                                <FormGroup label="Payout Cycle" description="When revenue is transferred to you.">
                                    <select style={inputStyle}>
                                        <option>T+2 Days (Rolling)</option>
                                        <option>Weekly (Every Monday)</option>
                                        <option>Monthly (1st of month)</option>
                                    </select>
                                </FormGroup>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "notifications" && (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-5"
                        >
                            <SectionHeader title="Notification Controls" subtitle="Select what you want to be alerted about" icon={Bell} />
                            <div className="space-y-1.5">
                                <ToggleItem title="New Reservations"         description="Receive email and push for every table request."    defaultChecked />
                                <ToggleItem title="Ticket Sales"             description="Instant alert for high-value ticket purchases."     defaultChecked />
                                <ToggleItem title="Host/Promoter Requests"   description="Alert when partners want to collaborate."           defaultChecked />
                                <ToggleItem title="Revenue Summaries"        description="Daily digest of your venue earnings." />
                                <ToggleItem title="Marketing Broadcasts"     description="Updates about new C1RCLE features." />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "security" && (
                        <motion.div
                            key="security"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-5"
                        >
                            <SectionHeader title="Access & Security" subtitle="Protect your venue dashboard account" icon={Shield} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormGroup label="Current Password" description="Enter your existing password.">
                                    <input type="password" placeholder="........" style={inputStyle} />
                                </FormGroup>
                                <div />
                                <FormGroup label="New Password" description="Min 8 characters.">
                                    <input type="password" placeholder="........" style={inputStyle} />
                                </FormGroup>
                                <FormGroup label="Confirm Password" description="Repeat new password.">
                                    <input type="password" placeholder="........" style={inputStyle} />
                                </FormGroup>
                            </div>
                            <div className="pt-4" style={{ borderTop: "1px solid var(--v-border)" }}>
                                <div
                                    className="flex items-center justify-between p-4 rounded-xl"
                                    style={{ background: "var(--v-elevated)" }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                                            style={{ background: "var(--v-info-bg)" }}
                                        >
                                            <Smartphone className="w-4 h-4" style={{ color: "var(--v-info)" }} />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>Two-Factor Authentication</p>
                                            <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>Secure your login with TOTP</p>
                                        </div>
                                    </div>
                                    <button
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all hover:brightness-110"
                                        style={{ background: "var(--v-info)", color: "#fff" }}
                                    >
                                        Enable 2FA
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </BentoCard>
        </VenuePageShell>
    );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: any }) {
    return (
        <div className="flex items-center gap-3">
            <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--v-elevated)" }}
            >
                <Icon className="w-4 h-4" style={{ color: "var(--v-text-secondary)" }} />
            </div>
            <div>
                <h3 className="text-[16px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{title}</h3>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>{subtitle}</p>
            </div>
        </div>
    );
}

function FormGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="v-label block">{label}</label>
            {children}
            {description && <p className="text-[10px]" style={{ color: "var(--v-text-muted)" }}>{description}</p>}
        </div>
    );
}

function ToggleItem({ title, description, defaultChecked }: { title: string; description: string; defaultChecked?: boolean }) {
    const [enabled, setEnabled] = useState(defaultChecked || false);
    return (
        <div
            className="flex items-center justify-between p-3 rounded-xl transition-colors"
            style={{ background: "var(--v-elevated)" }}
        >
            <div>
                <p className="text-[12px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--v-text-muted)" }}>{description}</p>
            </div>
            <button
                onClick={() => setEnabled(!enabled)}
                className="w-10 h-5.5 rounded-full relative transition-all flex-shrink-0 ml-3"
                style={{ background: enabled ? "var(--v-orange)" : "var(--v-card)", width: 40, height: 22 }}
                role="switch"
                aria-checked={enabled}
            >
                <div
                    className="absolute top-[3px] w-4 h-4 rounded-full shadow-md transition-all"
                    style={{ background: "rgba(255,255,255,0.9)", left: enabled ? "calc(100% - 19px)" : "3px" }}
                />
            </button>
        </div>
    );
}
