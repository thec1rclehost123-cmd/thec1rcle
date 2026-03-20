"use client";

import { useState, useEffect, useCallback } from "react";
import {
    User,
    Mail,
    Instagram,
    Phone,
    MapPin,
    CheckCircle2,
    ShieldCheck,
    Edit3,
    Save,
    Loader2,
    Globe,
    Copy,
    Sparkles
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilePage({ setActions }: { setActions?: (node: React.ReactNode) => void }) {
    const { profile, user: authUser } = useDashboardAuth() as any;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const [formData, setFormData] = useState({
        displayName: "",
        email: "",
        phone: "",
        instagram: "",
        bio: "",
        city: "Pune",
        username: ""
    });

    const [linkCopied, setLinkCopied] = useState(false);
    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        async function fetchProfile() {
            if (!promoterId) return;
            try {
                const res = await fetch(`/api/profile?profileId=${promoterId}&type=promoter`);
                if (!res.ok) throw new Error("Failed to fetch");
                const { profile: data } = await res.json();

                if (data) {
                    setFormData({
                        displayName: data.displayName || data.name || "",
                        email: data.email || "",
                        phone: data.phone || data.contactPhone || "",
                        instagram: data.instagram || "",
                        bio: data.bio || data.summary || "",
                        city: data.city || "Pune",
                        username: data.username || ""
                    });
                }
            } catch (err) {
                console.error("Failed to fetch promoter:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [promoterId]);

    const handleSave = useCallback(async () => {
        if (!promoterId) return;
        setSaving(true);
        try {
            const token = await authUser?.getIdToken();
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    profileId: promoterId,
                    type: "promoter",
                    action: "updateProfile",
                    data: {
                        displayName: formData.displayName,
                        phone: formData.phone,
                        instagram: formData.instagram,
                        bio: formData.bio,
                        city: formData.city,
                        username: formData.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                        updatedAt: new Date().toISOString()
                    }
                })
            });
            if (!res.ok) throw new Error("Update failed");
            setEditMode(false);
        } catch (err) {
            alert("Failed to save changes");
        } finally {
            setSaving(false);
        }
    }, [promoterId, formData, authUser]);

    // Integrate with SettingsHub actions if available
    useEffect(() => {
        if (setActions) {
            setActions(
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => editMode ? setEditMode(false) : setEditMode(true)}
                        className={cn(
                            "h-10 px-6 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2",
                            editMode 
                                ? "bg-white/5 border border-white/10 text-white/60 hover:text-white" 
                                : "bg-white text-black hover:bg-white/90"
                        )}
                    >
                        {editMode ? "Cancel" : <><Edit3 className="w-4 h-4" /> Edit Profile</>}
                    </button>
                    {editMode && (
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="h-10 px-8 rounded-xl bg-[var(--v-orange)] text-black text-[13px] font-black uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    )}
                </div>
            );
        }
    }, [editMode, saving, handleSave, setActions]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
                <Loader2 className="w-12 h-12 text-[var(--v-orange)] animate-spin" />
                <p className="text-[14px] font-black uppercase tracking-[0.3em] text-white">Loading Persona</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Identity Card */}
            <BentoCard className="relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-br from-[#FF6B00] via-[#FF8533] to-[#FF4D00] opacity-10 blur-3xl group-hover:opacity-20 transition-opacity" />
                
                <div className="relative z-10 p-10 flex flex-col md:flex-row items-center md:items-end gap-10">
                    <div className="relative group/avatar">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-[var(--v-orange)] to-orange-300 rounded-[2.5rem] blur opacity-20 group-hover/avatar:opacity-40 transition-opacity" />
                        <div className="relative w-32 h-32 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center overflow-hidden">
                            <span className="text-4xl font-black text-[var(--v-orange)]">
                                {formData.displayName?.[0] || <User className="w-10 h-10" />}
                            </span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-[var(--v-orange)] p-2 rounded-xl shadow-lg shadow-orange-500/20">
                            <Sparkles className="w-4 h-4 text-black" />
                        </div>
                    </div>

                    <div className="space-y-4 text-center md:text-left flex-1">
                        <div className="space-y-1">
                            <div className="flex items-center justify-center md:justify-start gap-4">
                                <h1 className="text-3xl font-black text-white tracking-tight">
                                    {formData.displayName || "Unknown Identity"}
                                </h1>
                                <div className="p-1 rounded-full bg-[var(--v-success)]/20 border border-[var(--v-success)]/20">
                                    <CheckCircle2 className="w-5 h-5 text-[var(--v-success)]" />
                                </div>
                            </div>
                            <p className="text-[14px] font-medium text-[var(--v-text-tertiary)] uppercase tracking-[0.2em]">
                                Verified Promoter Identity — c1rcle Partner
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            {formData.city && <Tag icon={MapPin}>{formData.city}</Tag>}
                            {formData.instagram && <Tag icon={Instagram}>{formData.instagram}</Tag>}
                            <Tag icon={ShieldCheck} className="bg-white/5 border-white/10 text-white/50">Lvl 1 Reputation</Tag>
                        </div>
                    </div>
                </div>
            </BentoCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Contact Information */}
                <BentoCard className="p-10 space-y-10">
                    <header className="space-y-1">
                        <h3 className="text-[18px] font-black text-white">Contact Details</h3>
                        <p className="text-[13px] text-[var(--v-text-tertiary)]">How event hosts and venues can reach you.</p>
                    </header>

                    <div className="grid gap-6">
                        <ProfileItem
                            icon={Mail}
                            label="Email Address"
                            value={formData.email}
                            readOnly
                        />
                        <ProfileItem
                            icon={Phone}
                            label="Phone Number"
                            value={formData.phone}
                            editing={editMode}
                            onChange={(val) => setFormData({ ...formData, phone: val })}
                            placeholder="+91 00000 00000"
                        />
                        <ProfileItem
                            icon={Instagram}
                            label="Instagram Handle"
                            value={formData.instagram}
                            editing={editMode}
                            onChange={(val) => setFormData({ ...formData, instagram: val })}
                            placeholder="@username"
                        />
                    </div>
                </BentoCard>

                {/* Bio / About Section */}
                <BentoCard className="p-10 space-y-10 flex flex-col">
                    <header className="space-y-1">
                        <h3 className="text-[18px] font-black text-white">The Manifesto</h3>
                        <p className="text-[13px] text-[var(--v-text-tertiary)]">Define your reach, audience, and value proposition.</p>
                    </header>

                    <div className="flex-1 min-h-[160px]">
                        {editMode ? (
                            <textarea
                                className="w-full h-full bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-[14px] font-bold text-white focus:border-[var(--v-orange)]/50 focus:bg-white/[0.05] outline-none transition-all resize-none"
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                placeholder="Describe your experience and network..."
                            />
                        ) : (
                            <div className="h-full p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center relative group">
                                <div className="absolute top-4 left-6 text-4xl text-white/5 font-serif font-black">"</div>
                                <p className="text-[15px] font-medium text-white/80 leading-relaxed text-center italic relative z-10 px-4">
                                    {formData.bio || "No biography provided. Share your impact with potential partners!"}
                                </p>
                                <div className="absolute bottom-4 right-6 text-4xl text-white/5 font-serif font-black translate-y-2">"</div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 rounded-2xl bg-[var(--v-orange)]/[0.03] border border-[var(--v-orange)]/10">
                        <header className="flex items-center justify-between mb-4">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[var(--v-orange)]">Personal Brand URL</p>
                            {formData.username && !editMode && (
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`https://c1rcle.app/${formData.username}`);
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 1500);
                                    }}
                                    className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-black text-white hover:bg-white/10 transition-all flex items-center gap-2"
                                >
                                    {linkCopied ? <CheckCircle2 className="w-3 h-3 text-[var(--v-success)]" /> : <Copy className="w-3 h-3 text-white/40" />}
                                    {linkCopied ? "Copied" : "Copy Link"}
                                </button>
                            )}
                        </header>
                        
                        {editMode ? (
                            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5">
                                <span className="text-[13px] font-bold text-white/20">c1rcle.app/</span>
                                <input
                                    className="flex-1 bg-transparent border-0 p-0 text-[13px] font-black text-white outline-none"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                    placeholder="handle"
                                />
                            </div>
                        ) : (
                            <p className="text-[15px] font-black text-white truncate">
                                {formData.username ? `c1rcle.app/${formData.username}` : "Set a handle to activate"}
                            </p>
                        )}
                    </div>
                </BentoCard>
            </div>
        </div>
    );
}

function Tag({ children, icon: Icon, className }: any) {
    return (
        <div className={cn("px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[12px] font-bold text-white/80 transition-all hover:bg-white/10 hover:border-white/20", className)}>
            <Icon className="w-3.5 h-3.5 text-[var(--v-orange)]" />
            {children}
        </div>
    );
}

function ProfileItem({ icon: Icon, label, value, readOnly, editing, onChange, placeholder }: any) {
    return (
        <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)] ml-1">{label}</label>
            <div className={cn(
                "flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-300",
                editing && !readOnly 
                    ? "bg-white/[0.05] border-[var(--v-orange)]/50 shadow-[0_0_20px_rgba(255,107,0,0.05)]" 
                    : "bg-white/[0.02] border-white/5"
            )}>
                <Icon className={cn("w-4 h-4", editing && !readOnly ? "text-[var(--v-orange)]" : "text-white/20")} />
                {editing && !readOnly ? (
                    <input
                        className="flex-1 bg-transparent border-0 p-0 text-[14px] font-bold text-white outline-none placeholder:text-white/10"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                    />
                ) : (
                    <span className={cn("text-[14px] font-bold truncate", value ? "text-white" : "text-white/20 italic")}>
                        {value || `Set your ${label.toLowerCase()}`}
                    </span>
                )}
            </div>
        </div>
    );
}
