"use client";

import { useState } from "react";
import {
    Settings,
    CreditCard,
    Bell,
    Shield,
    Smartphone,
    Mail,
    Lock,
    Globe,
    Receipt,
    Percent,
    Clock,
    UserCheck,
    CheckCircle2,
    AlertCircle,
    Save,
    ChevronRight,
    Building2,
    Banknote
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function VenueSettingsPage() {
    const [activeTab, setActiveTab] = useState<"general" | "ticketing" | "payouts" | "notifications" | "security">("general");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1500);
    };

    const tabs = [
        { id: "general", label: "General", icon: Settings },
        { id: "ticketing", label: "Ticketing & Taxes", icon: Receipt },
        { id: "payouts", label: "Payouts & Bank", icon: Banknote },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "security", label: "Security", icon: Shield },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <Settings className="w-10 h-10" />
                        Platform Settings
                    </h1>
                    <p className="text-slate-400 text-sm font-medium mt-2 uppercase tracking-widest">Manage your venue's technical & operational core</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn btn-primary min-w-[140px]"
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                        {!isSaving && <Save className="w-4 h-4 ml-2" />}
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                            }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                <AnimatePresence mode="wait">
                    {activeTab === "general" && (
                        <motion.div
                            key="general"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="p-8 md:p-12 space-y-10"
                        >
                            <SectionHeader title="Basic Configuration" subtitle="Primary identity and contact settings" icon={Building2} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormGroup label="Admin Contact Email" description="Used for technical alerts and billing.">
                                    <input type="email" defaultValue="admin@highspirits.com" className="form-input" />
                                </FormGroup>
                                <FormGroup label="Support Contact" description="Displayed to customers on tickets.">
                                    <input type="text" defaultValue="+91 98765 43210" className="form-input" />
                                </FormGroup>
                                <FormGroup label="Timezone" description="Affects event listings and logs.">
                                    <select className="form-input">
                                        <option>(GMT+05:30) India Standard Time</option>
                                        <option>(GMT+00:00) UTC</option>
                                    </select>
                                </FormGroup>
                                <FormGroup label="Default Language" description="Primary language for customer comms.">
                                    <select className="form-input">
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
                            className="p-8 md:p-12 space-y-10"
                        >
                            <SectionHeader title="Taxation & Fees" subtitle="Manage how fees and taxes are calculated" icon={Percent} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormGroup label="GST Rate (%)" description="Standard GST applied to all tickets.">
                                    <input type="number" defaultValue="18" className="form-input" />
                                </FormGroup>
                                <FormGroup label="Platform Fee Strategy" description="How the platform fee is displayed.">
                                    <select className="form-input">
                                        <option>Customer Pays (Added to price)</option>
                                        <option>Venue Absorbs (Subtracted from price)</option>
                                    </select>
                                </FormGroup>
                            </div>

                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-indigo-500" />
                                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Tax Compliance Notice</h4>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Ensure your GST number is correctly updated in <b>Page Presence &gt; Business Details</b>. All invoices generated by C1RCLE will use these settings for calculating settlements.
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
                            className="p-8 md:p-12 space-y-10"
                        >
                            <SectionHeader title="Financial Settlements" subtitle="Manage bank accounts and payout cycles" icon={CreditCard} />

                            <div className="space-y-6">
                                <div className="p-6 border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-indigo-100 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                            <Banknote className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">HDFC BANK LTD</p>
                                            <p className="text-[10px] font-medium text-slate-400 tracking-widest mt-0.5 uppercase">SAVINGS •••• 8821</p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">Verified</span>
                                </div>

                                <button className="w-full py-4 border border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2">
                                    <Plus className="w-3 h-3" /> Add Bank Account
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                                <FormGroup label="Payout Cycle" description="When revenue is transferred to you.">
                                    <select className="form-input">
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
                            className="p-8 md:p-12 space-y-10"
                        >
                            <SectionHeader title="Notification Controls" subtitle="Select what you want to be alerted about" icon={Bell} />

                            <div className="space-y-4">
                                <ToggleItem title="New Reservations" description="Receive email & push for every table request." defaultChecked />
                                <ToggleItem title="Ticket Sales" description="Instant alert for high-value ticket purchases." defaultChecked />
                                <ToggleItem title="Host/Promoter Requests" description="Alert when partners want to collaborate." defaultChecked />
                                <ToggleItem title="Revenue Summaries" description="Daily digest of your venue's earnings." />
                                <ToggleItem title="Marketing Broadcasts" description="Updates about new C1RCLE features." />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "security" && (
                        <motion.div
                            key="security"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="p-8 md:p-12 space-y-10"
                        >
                            <SectionHeader title="Access & Security" subtitle="Protect your venue dashboard account" icon={Shield} />

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormGroup label="Current Password" description="Enter your existing password.">
                                        <input type="password" placeholder="••••••••" className="form-input" />
                                    </FormGroup>
                                    <div />
                                    <FormGroup label="New Password" description="Min 8 characters.">
                                        <input type="password" placeholder="••••••••" className="form-input" />
                                    </FormGroup>
                                    <FormGroup label="Confirm Password" description="Repeat new password.">
                                        <input type="password" placeholder="••••••••" className="form-input" />
                                    </FormGroup>
                                </div>

                                <div className="pt-8 border-t border-slate-50">
                                    <div className="flex items-center justify-between p-6 bg-slate-900 rounded-3xl text-white">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                                <Smartphone className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Two-Factor Authentication</p>
                                                <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-0.5">Secure your login with TOTP</p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Enable 2FA</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Support Components
function SectionHeader({ title, subtitle, icon: Icon }: any) {
    return (
        <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

function FormGroup({ label, description, children }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                {label}
            </label>
            {children}
            <p className="text-[10px] text-slate-400 font-medium">{description}</p>
        </div>
    );
}

function ToggleItem({ title, description, defaultChecked }: any) {
    const [enabled, setEnabled] = useState(defaultChecked || false);
    return (
        <div className="flex items-center justify-between p-6 rounded-2xl border border-slate-50 hover:bg-slate-50/50 transition-all group">
            <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{title}</p>
                <p className="text-xs text-slate-400">{description}</p>
            </div>
            <button
                onClick={() => setEnabled(!enabled)}
                className={`w-12 h-6 rounded-full relative transition-all ${enabled ? 'bg-indigo-600 shadow-inner' : 'bg-slate-200'}`}
            >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${enabled ? 'left-7' : 'left-1'}`} />
            </button>
        </div>
    );
}

function Plus({ className }: any) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}
