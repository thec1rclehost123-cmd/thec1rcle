"use client";

import { useEffect, useState } from "react";
import { 
    Shield, 
    Save, 
    Settings, 
    Banknote, 
    Bell, 
    Building2,
    Lock,
    Smartphone,
    Globe,
    CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";

const SectionHeader = ({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: any }) => (
    <div className="flex items-start gap-4 mb-6">
        {Icon && (
            <div className="p-2.5 rounded-xl bg-surface-tertiary border border-border-default shadow-sm">
                <Icon size={20} className="text-text-primary" />
            </div>
        )}
        <div>
            <h3 className="text-lg font-bold text-text-primary leading-tight">{title}</h3>
            {subtitle && <p className="text-sm text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
    </div>
);

const FormGroup = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="space-y-2">
        <label className="text-[12px] font-bold uppercase tracking-wider text-text-secondary ml-0.5 block">
            {label}
        </label>
        {children}
        {description && <p className="text-[11px] text-text-tertiary leading-normal px-0.5">{description}</p>}
    </div>
);

const inputStyle: React.CSSProperties = {
    background: "var(--surface-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
};

export default function GeneralClient({ setActions }: { setActions: (actions: React.ReactNode) => void }) {
    const { success: toastSuccess } = useToast();
    const [activeTab, setActiveTab] = useState<"general" | "payouts" | "notifications" | "security">("general");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setHasChanges(false);
            toastSuccess("Settings saved", "Platform configuration has been updated.");
        }, 1500);
    };

    useEffect(() => {
        if (hasChanges || isSaving) {
            setActions(
                <VenueActionButton variant="primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
                </VenueActionButton>
            );
        } else {
            setActions(null);
        }
    }, [hasChanges, isSaving, setActions]);

    const tabs = [
        { id: "general",       label: "General",           icon: Settings },
        { id: "payouts",       label: "Payouts & Bank",    icon: Banknote },
        { id: "notifications", label: "Notifications",     icon: Bell     },
        { id: "security",      label: "Security",          icon: Shield   },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Secondary Tab Control */}
            <div className="flex p-1.5 bg-surface-secondary/50 backdrop-blur-md rounded-2xl gap-1 border border-border-subtle inline-flex">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-surface-elevated text-text-primary shadow-lg border border-border-default scale-[1.02]"
                                : "text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary"
                        )}
                    >
                        <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-accent-primary" : "text-text-tertiary")} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-12 xl:col-span-10 xl:col-start-2">
                    <BentoCard padding="lg" className="overflow-visible shadow-2xl border-border-default">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="space-y-10"
                            >
                                {activeTab === "general" && (
                                    <>
                                        <SectionHeader 
                                            title="Basic Configuration" 
                                            subtitle="Manage your venue's technical and operational identity" 
                                            icon={Building2} 
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <FormGroup label="Admin Email" description="Used for technical alerts and billing audits">
                                                <input 
                                                    type="email" 
                                                    defaultValue="admin@highspirits.com" 
                                                    style={inputStyle} 
                                                    onChange={() => setHasChanges(true)}
                                                    className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                                />
                                            </FormGroup>
                                            <FormGroup label="Support Hotline" description="Publicly available for customer assistance">
                                                <input 
                                                    type="text" 
                                                    defaultValue="+91 98765 43210" 
                                                    style={inputStyle} 
                                                    onChange={() => setHasChanges(true)}
                                                    className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                                />
                                            </FormGroup>
                                            <FormGroup label="Operational Timezone">
                                                <select 
                                                    style={inputStyle} 
                                                    onChange={() => setHasChanges(true)}
                                                    className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 appearance-none"
                                                >
                                                    <option>(GMT+05:30) India Standard Time</option>
                                                    <option>(GMT+00:00) UTC</option>
                                                </select>
                                            </FormGroup>
                                            <FormGroup label="Primary Language">
                                                <select 
                                                    style={inputStyle} 
                                                    onChange={() => setHasChanges(true)}
                                                    className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 appearance-none"
                                                >
                                                    <option>English (International)</option>
                                                    <option>Hindi (Localized)</option>
                                                </select>
                                            </FormGroup>
                                        </div>
                                    </>
                                )}

                                {activeTab === "payouts" && (
                                    <>
                                        <SectionHeader 
                                            title="Financial Infrastructure" 
                                            subtitle="Secure destination for event revenue and settlements" 
                                            icon={Banknote} 
                                        />
                                        <div className="space-y-8">
                                            <div className="p-12 rounded-[2.5rem] bg-surface-secondary border-2 border-dashed border-border-strong flex flex-col items-center justify-center text-center py-16 group hover:border-accent-primary/30 transition-all cursor-pointer">
                                                <div className="p-6 rounded-3xl bg-surface-elevated shadow-xl mb-6 group-hover:scale-110 transition-transform duration-500">
                                                    <CreditCard size={40} className="text-text-placeholder" />
                                                </div>
                                                <p className="font-black text-text-primary text-2xl tracking-tight">Connect Bank Account</p>
                                                <p className="text-base text-text-tertiary max-w-[340px] mt-2 leading-relaxed italic">Link an Indian savings or current account for next-day settlements.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-border-subtle">
                                                <FormGroup label="Settlement Cadence">
                                                    <select 
                                                        style={inputStyle} 
                                                        onChange={() => setHasChanges(true)}
                                                        className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 appearance-none"
                                                    >
                                                        <option>T+2 Days (Standard)</option>
                                                        <option>T+1 Day (Express)</option>
                                                        <option>Weekly (Consolidated)</option>
                                                    </select>
                                                </FormGroup>
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                {activeTab === "notifications" && (
                                    <>
                                        <SectionHeader 
                                            title="Alert Preferences" 
                                            subtitle="Fine-tune how you receive system-wide intelligence" 
                                            icon={Bell} 
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: "Revenue Updates", desc: "Real-time notifications for every ticket purchase" },
                                                { label: "Partner Requests", desc: "Alerts for collaboration and table bookings" },
                                                { label: "Security Audit", desc: "Push alerts for scanner sync and staff logins" },
                                                { label: "Product Announcements", desc: "Occasional updates about platform upgrades" }
                                            ].map((n, i) => (
                                                <div key={i} className="flex items-center justify-between p-6 bg-surface-secondary/40 rounded-[2rem] border border-border-subtle hover:bg-surface-secondary/60 transition-all group shadow-sm">
                                                    <div className="pr-4">
                                                        <p className="text-[15px] font-bold text-text-primary group-hover:text-accent-primary transition-colors">{n.label}</p>
                                                        <p className="text-[12px] text-text-tertiary mt-0.5 leading-normal">{n.desc}</p>
                                                    </div>
                                                    <div 
                                                        className="h-7 w-12 bg-accent-primary rounded-full relative cursor-pointer shrink-0" 
                                                        onClick={() => setHasChanges(true)}
                                                    >
                                                        <div className="absolute right-1 top-1 h-5 w-5 bg-white rounded-full shadow-lg" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {activeTab === "security" && (
                                    <>
                                        <SectionHeader 
                                            title="Access Guardian" 
                                            subtitle="Highest level protection for your administrative workspace" 
                                            icon={Shield} 
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="p-8 rounded-[2.5rem] bg-red-400/[0.03] border border-red-500/10 flex flex-col h-full">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="p-4 rounded-2xl bg-red-500/10 text-red-500 shadow-sm">
                                                        <Lock size={28} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-text-primary">System Credentials</h4>
                                                        <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mt-0.5">Sensitive Area</p>
                                                    </div>
                                                </div>
                                                <div className="mt-auto">
                                                    <button className="w-full py-4 bg-text-primary text-text-inverse rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-text-primary/10 hover:shadow-text-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                                        Update Master Password
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-8 rounded-[2.5rem] bg-surface-secondary/30 border border-border-subtle flex flex-col h-full">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="p-4 rounded-2xl bg-accent-primary/10 text-accent-primary shadow-sm">
                                                        <Smartphone size={28} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-text-primary">Two-Factor Auth</h4>
                                                        <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mt-0.5">Status: Deactivated</p>
                                                    </div>
                                                </div>
                                                <div className="mt-auto">
                                                    <button className="w-full py-4 border-2 border-border-strong rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-surface-tertiary transition-all">
                                                        Initialize Setup
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </BentoCard>
                </div>
            </div>
        </div>
    );
}
