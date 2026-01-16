"use client";

import { useState, useEffect } from "react";
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
    Loader2
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function ProfilePage() {
    const { profile, user: authUser } = useDashboardAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const [formData, setFormData] = useState({
        displayName: "",
        email: "",
        phone: "",
        instagram: "",
        bio: "",
        city: "Pune"
    });

    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        async function fetchProfile() {
            if (!promoterId) return;
            try {
                const db = getFirebaseDb();
                const docRef = doc(db, "promoters", promoterId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setFormData({
                        displayName: data.displayName || data.name || "",
                        email: data.email || "",
                        phone: data.phone || data.contactPhone || "",
                        instagram: data.instagram || "",
                        bio: data.bio || data.summary || "",
                        city: data.city || "Pune"
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

    const handleSave = async () => {
        if (!promoterId) return;
        setSaving(true);
        try {
            const db = getFirebaseDb();
            await updateDoc(doc(db, "promoters", promoterId), {
                displayName: formData.displayName,
                phone: formData.phone,
                instagram: formData.instagram,
                bio: formData.bio,
                city: formData.city,
                updatedAt: new Date().toISOString()
            });
            setEditMode(false);
        } catch (err) {
            alert("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#007aff]" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header / ID Card */}
            <div className="relative overflow-hidden bg-white rounded-[2rem] border border-[rgba(0,0,0,0.06)] shadow-sm">
                <div className="h-32 bg-gradient-to-r from-[#007aff] to-[#5856d6]" />
                <div className="px-8 pb-8">
                    <div className="relative flex items-end justify-between -mt-12 mb-6">
                        <div className="flex items-end gap-6">
                            <div className="w-24 h-24 rounded-3xl bg-white border-4 border-white shadow-xl overflow-hidden">
                                <div className="w-full h-full bg-[#f5f5f7] flex items-center justify-center font-black text-2xl text-[#007aff]">
                                    {formData.displayName?.[0] || "P"}
                                </div>
                            </div>
                            <div className="pb-1">
                                <h1 className="text-2xl font-bold text-[#1d1d1f] flex items-center gap-2">
                                    {formData.displayName}
                                    <CheckCircle2 className="w-5 h-5 text-[#007aff]" />
                                </h1>
                                <p className="text-sm font-medium text-[#86868b]">Verified Promoter — Since 2026</p>
                            </div>
                        </div>
                        <button
                            onClick={() => editMode ? handleSave() : setEditMode(true)}
                            disabled={saving}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${editMode
                                    ? "bg-[#007aff] text-white hover:bg-[#0066cc]"
                                    : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                                }`}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                            {editMode ? "Save Changes" : "Edit Profile"}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                        {/* Info Section */}
                        <div className="space-y-6">
                            <SectionHeader title="Contact Information" />
                            <div className="space-y-4">
                                <ProfileItem
                                    icon={Mail}
                                    label="Email Address"
                                    value={formData.email}
                                    readOnly
                                />
                                <ProfileItem
                                    icon={Phone}
                                    label="Contact Number"
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
                                <ProfileItem
                                    icon={MapPin}
                                    label="Primary City"
                                    value={formData.city}
                                    editing={editMode}
                                    onChange={(val) => setFormData({ ...formData, city: val })}
                                />
                            </div>
                        </div>

                        {/* Bio / About Section */}
                        <div className="space-y-6">
                            <SectionHeader title="About / Background" />
                            <div className="p-6 rounded-2xl bg-[#f5f5f7] border border-[rgba(0,0,0,0.02)]">
                                {editMode ? (
                                    <textarea
                                        className="w-full bg-white border-0 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-[#007aff] outline-none min-h-[120px]"
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Briefly describe your reach and experience..."
                                    />
                                ) : (
                                    <p className="text-sm font-medium text-[#1d1d1f] leading-relaxed italic">
                                        "{formData.bio || "No biography provided. Tell venues and hosts about your impact!"}"
                                    </p>
                                )}
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Reputation Shield</p>
                                    <p className="text-[11px] text-[#86868b] leading-tight">Your verified status and connection stats are automatically included in partnership requests.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionHeader({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-4">
            <h3 className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest whitespace-nowrap">{title}</h3>
            <div className="h-px bg-[rgba(0,0,0,0.06)] w-full" />
        </div>
    );
}

function ProfileItem({ icon: Icon, label, value, readOnly, editing, onChange, placeholder }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest ml-1">{label}</label>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${editing && !readOnly
                    ? "bg-white border-[#007aff] shadow-sm"
                    : "bg-[#f5f5f7] border-transparent"
                }`}>
                <Icon className={`w-4 h-4 ${editing && !readOnly ? "text-[#007aff]" : "text-[#86868b]"}`} />
                {editing && !readOnly ? (
                    <input
                        className="flex-1 bg-transparent border-0 p-0 text-sm font-semibold outline-none"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                    />
                ) : (
                    <span className={`text-sm font-semibold ${value ? "text-[#1d1d1f]" : "text-[#86868b] italic"}`}>
                        {value || `Set your ${label.toLowerCase()}`}
                    </span>
                )}
            </div>
        </div>
    );
}
