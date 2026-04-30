"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera, Upload, Loader2, Edit3, Save,
    Heart, ChevronLeft, CheckCircle2, MapPin,
    Phone, Globe, Instagram, Mail, Calendar, Image as ImageIcon,
    Clock, Users, Sparkles
} from "lucide-react";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface LivePreviewEditorProps {
    venueId: string;
    venue: any;
    highlights: any[];
    gallery: any[];
    facilities: any[];
    onUpdate: (updates: any) => Promise<void>;
    onRefresh: () => void;
}

export default function LivePreviewEditor({
    venueId,
    venue,
    highlights,
    gallery,
    facilities,
    onUpdate,
    onRefresh
}: LivePreviewEditorProps) {
    const { user } = useDashboardAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({
        name: venue.name || "",
        bio: venue.bio || venue.description || "",
        venueType: venue.venueType || venue.category || "Venue",
        city: venue.city || "",
        address: venue.address || "",
        phone: venue.phone || "",
        email: venue.email || "",
        website: venue.website || "",
        instagram: venue.socialLinks?.instagram || "",
    });
    const [saving, setSaving] = useState(false);

    // Local overrides for immediate preview update
    const [previewCover, setPreviewCover] = useState<string | null>(null);
    const [previewLogo, setPreviewLogo] = useState<string | null>(null);

    // Reset local overrides when venue prop changes (data was refreshed)
    useEffect(() => {
        setPreviewCover(null);
        setPreviewLogo(null);
    }, [venue.id, venue.coverURL, venue.photoURL, venue.image, venue.logo]);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (file: File, type: "cover" | "logo") => {
        if (!user) {
            console.error("[LivePreviewEditor] No user found for upload");
            return;
        }

        console.log(`[LivePreviewEditor] Starting server-side ${type} upload for:`, file.name);
        setUploadingField(type);

        try {
            // Prepare FormData for the server-side upload
            const formData = new FormData();
            formData.append("file", file);
            formData.append("venueId", venueId);
            formData.append("type", type);

            // Get Auth Token for the API call - force refresh to ensure token is valid
            const token = await user.getIdToken(true);
            console.log(`[LivePreviewEditor] Got auth token, length:`, token?.length);

            // Call our new backend upload API
            const response = await fetch("/api/partners/venues/upload", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                    // Note: Browser automatically sets Content-Type for FormData
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Upload failed");
            }

            const { url: downloadURL } = await response.json();
            console.log(`[LivePreviewEditor] Server-side upload successful! URL:`, downloadURL);

            // Update local preview state immediately for instant feedback
            if (type === "cover") {
                setPreviewCover(downloadURL);
            } else {
                setPreviewLogo(downloadURL);
            }

            // Map to all possible fields for backward compatibility across the entire guest portal
            const updates = type === "cover"
                ? {
                    image: downloadURL,
                    coverURL: downloadURL,
                    bannerImage: downloadURL,
                    coverImage: downloadURL
                }
                : {
                    logo: downloadURL,
                    photoURL: downloadURL,
                    logoImage: downloadURL
                };

            // Update Firestore via our existing update venue API
            await onUpdate(updates);

            console.log(`[LivePreviewEditor] Updates saved. Refreshing...`);
            // We still call onRefresh but the local overrides will stay until prop changes
            onRefresh();

        } catch (err: any) {
            console.error(`[LivePreviewEditor] ${type} upload FAILED:`, err);
            alert(`Upload Error: ${err.message}`);
        } finally {
            setUploadingField(null);
        }
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            await onUpdate({
                name: editValues.name,
                bio: editValues.bio,
                description: editValues.bio,
                venueType: editValues.venueType,
                city: editValues.city,
                address: editValues.address,
                phone: editValues.phone,
                email: editValues.email,
                website: editValues.website,
                socialLinks: {
                    instagram: editValues.instagram,
                },
            });
            setIsEditing(false);
            onRefresh();
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    };

    const coverImage = previewCover || venue.coverURL || venue.coverImage || venue.bannerImage || venue.image;
    const logo = previewLogo || venue.photoURL || venue.logoImage || venue.logo;
    const isVerified = venue.verified || venue.isVerified;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-text-primary">Live Preview</h2>
                    <p className="text-sm text-text-tertiary">
                        {uploadingField ? `Uploading ${uploadingField}...` : 'Design synced with your guest website.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {uploadingField && <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />}
                    <button
                        onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)}
                        disabled={saving || !!uploadingField}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isEditing
                            ? "bg-green-500 text-text-primary hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                            : "bg-surface-secondary text-text-primary hover:bg-surface-elevated"
                            }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? <><Save className="w-4 h-4" /> Save Details</> : <><Edit3 className="w-4 h-4" /> Edit Design</>}
                    </button>
                </div>
            </div>

            <div className={`relative bg-[#0A0A0A] rounded-3xl overflow-hidden border border-border-subtle shadow-2xl transition-all ${isEditing ? 'ring-2 ring-emerald-500/50' : ''}`}>
                <section className="relative w-full">
                    <div className="relative aspect-[16/10] w-full overflow-hidden group">
                        {coverImage ? <img src={coverImage} className={`w-full h-full object-cover ${uploadingField === 'cover' ? 'opacity-50 blur-sm' : ''}`} alt="" onError={(e) => console.error(`[LivePreviewEditor] Cover image failed to load:`, coverImage)} /> : <div className="w-full h-full bg-surface-secondary flex items-center justify-center"><ImageIcon className="w-16 h-16 text-text-primary/10" /></div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
                        {isEditing && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="px-6 py-3 bg-surface-elevated/10 backdrop-blur-md rounded-2xl border border-white/20 text-text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Camera className="w-4 h-4" /> Click Cover to Change</div></div>}
                        <div onClick={() => coverInputRef.current?.click()} className="absolute inset-0 z-20 cursor-pointer" />
                        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "cover")} />

                        <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-6 pointer-events-none">
                            <div className="flex items-end gap-4">
                                <div onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }} className="relative w-20 h-20 rounded-2xl overflow-hidden border-4 border-[#0A0A0A] shadow-2xl cursor-pointer group pointer-events-auto bg-surface-tertiary">
                                    {logo ? <img src={logo} className="w-full h-full object-cover" alt="" onError={(e) => console.error(`[LivePreviewEditor] Logo image failed to load:`, logo)} /> : <div className="w-full h-full flex items-center justify-center text-text-primary/20"><Upload className="w-6 h-6" /></div>}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">{uploadingField === "logo" ? <Loader2 className="w-5 h-5 text-text-primary animate-spin" /> : <Upload className="w-5 h-5 text-text-primary" />}</div>
                                </div>
                                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "logo")} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        {isEditing ? <input value={editValues.venueType} onChange={(e) => setEditValues(v => ({ ...v, venueType: e.target.value }))} className="px-3 py-1 bg-surface-elevated/10 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-text-primary w-24 text-center pointer-events-auto" /> : <span className="px-3 py-1 bg-surface-elevated/10 border border-border-subtle rounded-full text-[10px] font-black uppercase tracking-widest text-text-primary/80">{venue.venueType || venue.category || "Venue"}</span>}
                                        {isVerified && <span className="flex items-center gap-1 px-2 py-1 bg-[#F44A22]/20 rounded-full"><CheckCircle2 className="h-3 w-3 text-[#F44A22]" /><span className="text-[9px] font-black uppercase tracking-widest text-[#F44A22]">Verified</span></span>}
                                    </div>
                                    {isEditing ? <input value={editValues.name} onChange={(e) => setEditValues(v => ({ ...v, name: e.target.value }))} className="text-3xl font-black uppercase tracking-tighter text-text-primary bg-transparent border-b-2 border-white/30 focus:border-white outline-none w-full pointer-events-auto" /> : <h1 className="text-3xl font-black uppercase tracking-tighter text-text-primary leading-[0.9] drop-shadow-lg">{venue.name}</h1>}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="px-6 py-4 border-b border-border-subtle flex items-center gap-6">
                    <div className="flex items-center gap-2 text-text-primary/60"><Users className="w-4 h-4" /><span className="text-sm font-bold">{venue.followers || 0} followers</span></div>
                    <div className="flex items-center gap-2 text-text-primary/60"><Calendar className="w-4 h-4" /><span className="text-sm font-bold">{venue.eventsCount || 0} events</span></div>
                    <div className="flex items-center gap-2 text-text-primary/60"><MapPin className="w-4 h-4" />{isEditing ? <input value={editValues.city} onChange={(e) => setEditValues(v => ({ ...v, city: e.target.value }))} placeholder="City" className="text-sm font-bold bg-transparent border-b border-white/30 text-text-primary/60 w-32 focus:outline-none" /> : <span className="text-sm font-bold">{venue.city || "Add city"}</span>}</div>
                </div>

                <div className="px-6 py-6 border-b border-border-subtle">
                    <div className="flex items-center gap-3 mb-4"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-primary/40">About</span></div>
                    {isEditing ? <textarea value={editValues.bio} onChange={(e) => setEditValues(v => ({ ...v, bio: e.target.value }))} placeholder="Tell visitors about your venue..." rows={3} className="w-full p-4 bg-surface-elevated/5 border border-border-subtle rounded-xl text-text-primary text-sm resize-none focus:outline-none focus:border-white/30" /> : <p className="text-text-primary/70 text-sm leading-relaxed">{venue.bio || venue.description || "No description added yet."}</p>}
                </div>

                <div className="px-6 py-6 border-b border-border-subtle">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {highlights.map(h => (
                            <div key={h.id} className="flex-shrink-0 flex flex-col items-center gap-1">
                                <div className="w-14 h-14 rounded-full border-2 border-emerald-500/30 p-0.5 overflow-hidden"><img src={h.coverImage || h.images?.[0]} className="w-full h-full rounded-full object-cover" alt="" /></div>
                                <span className="text-[8px] font-bold uppercase text-text-primary/40">{h.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-6">
                    <div className="grid grid-cols-3 gap-2">
                        {gallery.slice(0, 3).map((p, i) => <div key={i} className="aspect-square rounded-xl overflow-hidden bg-surface-elevated/5"><img src={p.imageUrl} className="w-full h-full object-cover" alt="" /></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}
