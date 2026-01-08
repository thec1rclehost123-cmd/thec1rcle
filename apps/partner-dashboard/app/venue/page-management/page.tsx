"use client";

import { useState, useEffect, useRef } from "react";
import {
    Plus,
    Image as ImageIcon,
    FileText,
    Sparkles,
    Trash2,
    Upload,
    Loader2,
    Eye,
    ThumbsUp,
    Camera,
    Layout,
    Heart,
    MessageCircle,
    TrendingUp,
    ChevronRight,
    X,
    CheckCircle2,
    Settings,
    Globe,
    ExternalLink,
    Instagram,
    Twitter,
    Mail,
    Phone,
    MapPin as MapPinIcon,
    Users
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { AnimatePresence, motion } from "framer-motion";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function VenuePageManagementPage() {
    const { profile } = useDashboardAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"details" | "posts" | "highlights" | "followers">("details");

    // Post Composer State
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerContent, setComposerContent] = useState("");
    const [composerImage, setComposerImage] = useState("");
    const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");

    // Photo Edit Modal State
    const [photoModal, setPhotoModal] = useState<{ field: string; currentUrl: string } | null>(null);
    const [photoInputUrl, setPhotoInputUrl] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const composerFileInputRef = useRef<HTMLInputElement>(null);

    // Auto-save draft
    useEffect(() => {
        if (isComposerOpen) {
            const timer = setTimeout(() => {
                setDraftStatus("saving");
                localStorage.setItem(`post_draft_${profile?.activeMembership?.partnerId}`, JSON.stringify({ content: composerContent, image: composerImage }));
                setTimeout(() => setDraftStatus("saved"), 800);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [composerContent, composerImage, isComposerOpen]);

    // Load draft
    useEffect(() => {
        if (isComposerOpen) {
            const draft = localStorage.getItem(`post_draft_${profile?.activeMembership?.partnerId}`);
            if (draft) {
                const { content, image } = JSON.parse(draft);
                if (!composerContent) setComposerContent(content);
                if (!composerImage) setComposerImage(image);
            }
        }
    }, [isComposerOpen]);

    const fetchProfileData = async () => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsLoading(true);
        try {
            const partnerId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/profile?profileId=${partnerId}&type=club&stats=true`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error("Profile fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfileData();
    }, [profile]);

    const handleUpdateProfile = async (updates: any) => {
        if (!profile?.activeMembership?.partnerId || !profile?.uid) return;
        setIsSaving(true);
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile.activeMembership.partnerId,
                    type: "venue",
                    action: "updateProfile",
                    data: updates
                })
            });
            if (res.ok) {
                fetchProfileData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreatePost = async () => {
        if (!composerContent) return;
        setIsSaving(true);
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "venue",
                    action: "createPost",
                    data: { content: composerContent, imageUrl: composerImage }
                })
            });
            localStorage.removeItem(`post_draft_${profile?.activeMembership?.partnerId}`);
            setComposerContent("");
            setComposerImage("");
            setIsComposerOpen(false);
            fetchProfileData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("Delete this post?")) return;
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "venue",
                    action: "deletePost",
                    data: { postId }
                })
            });
            fetchProfileData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateHighlight = async () => {
        const title = window.prompt("Enter highlight title:");
        if (!title) return;

        setIsSaving(true);
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "venue",
                    action: "createHighlight",
                    data: { title, color: "#111111" }
                })
            });
            fetchProfileData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteHighlight = async (highlightId: string) => {
        if (!window.confirm("Delete this highlight?")) return;
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "venue",
                    action: "deleteHighlight",
                    data: { highlightId }
                })
            });
            fetchProfileData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdatePhoto = async (overrideUrl?: string) => {
        const urlToUse = overrideUrl || photoInputUrl;
        if (!photoModal || !urlToUse) return;
        setIsSaving(true);
        try {
            if (photoModal.field === "photos") {
                const currentPhotos = data?.profile?.photos || [];
                await fetch("/api/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        profileId: profile?.activeMembership?.partnerId,
                        type: "venue",
                        action: "updateProfile",
                        data: { photos: [...currentPhotos, urlToUse] }
                    })
                });
            } else {
                await fetch("/api/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        profileId: profile?.activeMembership?.partnerId,
                        type: "venue",
                        action: "addPhoto",
                        data: { field: photoModal.field, url: urlToUse }
                    })
                });
            }
            setPhotoModal(null);
            setPhotoInputUrl("");
            fetchProfileData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "modal" | "composer") => {
        const file = e.target.files?.[0];
        if (!file || !profile?.activeMembership?.partnerId) return;

        setIsSaving(true);
        try {
            const storage = getFirebaseStorage();
            const storageRef = ref(storage, `partners/${profile.activeMembership.partnerId}/uploads/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            if (target === "modal") {
                setPhotoInputUrl(downloadURL);
                // Straight upload: auto-save for profile photos
                await handleUpdatePhoto(downloadURL);
            } else {
                setComposerImage(downloadURL);
            }
        } catch (err) {
            console.error("Upload error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 text-[var(--text-tertiary)] animate-spin mb-4" />
                <p className="text-[var(--text-tertiary)] font-bold uppercase tracking-widest text-[10px]">Syncing Venue Presence...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            {/* Apple Pro Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em]">Presence Control</span>
                        <div className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                        <span className="text-[10px] font-bold text-[var(--state-confirmed)] uppercase tracking-[0.2em]">Verified Venue</span>
                    </div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                        {data?.profile?.displayName || "Venue Profile"}
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    {data?.profile?.slug && (
                        <a
                            href={`/venue/${data.profile.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-[12px] font-bold border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all group"
                        >
                            <Globe className="w-4 h-4" />
                            <span>View Public Page</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                    )}
                    <button
                        onClick={() => handleUpdateProfile({})}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-[var(--text-primary)] text-[var(--surface-primary)] rounded-xl text-[12px] font-bold shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Publish Changes
                    </button>
                </div>
            </div>

            {/* Apple Style Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SimpleStatCard label="Followers" value={data?.stats?.followersCount || 0} icon={Heart} />
                <SimpleStatCard label="Posts" value={data?.stats?.postsCount || 0} icon={Layout} />
                <SimpleStatCard label="Total Likes" value={data?.stats?.totalLikes || 0} icon={TrendingUp} />
                <SimpleStatCard label="Page Views" value={data?.stats?.totalViews || 0} icon={Eye} />
            </div>

            {/* Main Editor Surface */}
            <div className="bg-[var(--surface-primary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden min-h-[600px] shadow-sm">
                {/* Segmented Control / Tabs */}
                <div className="flex p-1 bg-[var(--surface-secondary)]/50 border-b border-[var(--border-subtle)]">
                    <button
                        onClick={() => setActiveTab("details")}
                        className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-2xl text-[11px] font-bold transition-all ${activeTab === "details" ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}
                    >
                        <Settings className="w-4 h-4" />
                        Identity
                    </button>
                    <button
                        onClick={() => setActiveTab("posts")}
                        className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-2xl text-[11px] font-bold transition-all ${activeTab === "posts" ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}
                    >
                        <FileText className="w-4 h-4" />
                        Posts
                    </button>
                    <button
                        onClick={() => setActiveTab("highlights")}
                        className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-2xl text-[11px] font-bold transition-all ${activeTab === "highlights" ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}
                    >
                        <Camera className="w-4 h-4" />
                        Highlights
                    </button>
                    <button
                        onClick={() => setActiveTab("followers")}
                        className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-2xl text-[11px] font-bold transition-all ${activeTab === "followers" ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}
                    >
                        <Users className="w-4 h-4" />
                        Followers
                    </button>
                </div>

                <div className="p-8 md:p-12">
                    {activeTab === "details" && (
                        <div className="max-w-4xl space-y-12">
                            {/* Visual Identity Section */}
                            <section>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-6">Visual Identity</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">Profile Avatar</p>
                                        <div
                                            onClick={() => { setPhotoModal({ field: "photoURL", currentUrl: data?.profile?.photoURL }); setPhotoInputUrl(data?.profile?.photoURL || ""); }}
                                            className="aspect-square w-32 md:w-40 bg-[var(--surface-secondary)] rounded-3xl border border-[var(--border-subtle)] flex flex-col items-center justify-center group hover:border-[var(--border-strong)] transition-all cursor-pointer overflow-hidden relative shadow-inner"
                                        >
                                            {data?.profile?.photoURL ? (
                                                <img src={data.profile.photoURL} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                            ) : (
                                                <Upload className="h-6 w-6 text-[var(--text-tertiary)]" />
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-md py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] font-bold text-white text-center">Edit</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">Discovery Header</p>
                                        <div
                                            onClick={() => { setPhotoModal({ field: "coverURL", currentUrl: data?.profile?.coverURL }); setPhotoInputUrl(data?.profile?.coverURL || ""); }}
                                            className="aspect-[16/9] w-full bg-[var(--surface-secondary)] rounded-3xl border border-[var(--border-subtle)] flex flex-col items-center justify-center group hover:border-[var(--border-strong)] transition-all cursor-pointer overflow-hidden relative shadow-inner"
                                        >
                                            {data?.profile?.coverURL ? (
                                                <img src={data.profile.coverURL} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                            ) : (
                                                <ImageIcon className="h-8 w-8 text-[var(--text-tertiary)]" />
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-md py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] font-bold text-white text-center">Edit Header</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Editorial Details Section */}
                            <section className="space-y-8 pt-8 border-t border-[var(--border-subtle)]">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-6">Editorial & Vibe</h3>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Venue Title</label>
                                        <input
                                            type="text"
                                            defaultValue={data?.profile?.displayName}
                                            onBlur={(e) => handleUpdateProfile({ displayName: e.target.value })}
                                            className="w-full px-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                            placeholder="Venue Name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Biography & Atmosphere</label>
                                        <textarea
                                            defaultValue={data?.profile?.bio}
                                            onBlur={(e) => handleUpdateProfile({ bio: e.target.value })}
                                            className="w-full px-5 py-4 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none min-h-[160px] leading-relaxed"
                                            placeholder="Describe the experience, the music, and the vibe..."
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Social & Contact Section */}
                            <section className="space-y-8 pt-8 border-t border-[var(--border-subtle)]">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-6">Social & Contact</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Instagram (@handle)</label>
                                        <div className="relative">
                                            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.socialLinks?.instagram}
                                                onBlur={(e) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, instagram: e.target.value } })}
                                                className="w-full pl-12 pr-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                                placeholder="my_venue"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Website URL</label>
                                        <div className="relative">
                                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.website}
                                                onBlur={(e) => handleUpdateProfile({ website: e.target.value })}
                                                className="w-full pl-12 pr-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                                placeholder="https://myvenue.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Official Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                                            <input
                                                type="email"
                                                defaultValue={data?.profile?.email}
                                                onBlur={(e) => handleUpdateProfile({ email: e.target.value })}
                                                className="w-full pl-12 pr-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                                placeholder="hello@myvenue.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Phone Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.phone}
                                                onBlur={(e) => handleUpdateProfile({ phone: e.target.value })}
                                                className="w-full pl-12 pr-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                                placeholder="+91 00000 00000"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Location Section */}
                            <section className="space-y-8 pt-8 border-t border-[var(--border-subtle)]">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-6">Location Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">City</label>
                                        <input
                                            type="text"
                                            defaultValue={data?.profile?.city}
                                            onBlur={(e) => handleUpdateProfile({ city: e.target.value })}
                                            className="w-full px-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                            placeholder="Pune"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] ml-1">Address / Area</label>
                                        <div className="relative">
                                            <MapPinIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.address}
                                                onBlur={(e) => handleUpdateProfile({ address: e.target.value })}
                                                className="w-full pl-12 pr-5 py-3 bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] rounded-xl text-[13px] font-bold text-[var(--text-primary)] focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all outline-none"
                                                placeholder="Koregaon Park, Pune"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Photos Gallery Section */}
                            <section className="space-y-8 pt-8 border-t border-[var(--border-subtle)]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Gallery Photos</h3>
                                    <button
                                        onClick={() => { setPhotoModal({ field: "photos", currentUrl: "" }); setPhotoInputUrl(""); }}
                                        className="px-4 py-2 bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-xl text-[10px] font-bold uppercase tracking-widest border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all"
                                    >
                                        Add Photo
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {data?.profile?.photos?.map((photo: string, idx: number) => (
                                        <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border-subtle)] group">
                                            <img src={photo} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                            <button
                                                onClick={async () => {
                                                    const newPhotos = data.profile.photos.filter((p: string) => p !== photo);
                                                    handleUpdateProfile({ photos: newPhotos });
                                                }}
                                                className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {(!data?.profile?.photos || data.profile.photos.length === 0) && (
                                        <div className="col-span-full py-12 text-center bg-[var(--surface-secondary)]/30 rounded-3xl border border-dashed border-[var(--border-subtle)]">
                                            <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">No gallery photos added</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === "posts" && (
                        <div className="space-y-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Public Timeline</h3>
                                    <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Post updates reflecting on your public venue page.</p>
                                </div>
                                <button
                                    onClick={() => setIsComposerOpen(true)}
                                    className="px-5 py-2.5 bg-[var(--text-primary)] text-[var(--surface-primary)] rounded-xl font-bold text-[12px] hover:opacity-90 transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Entry
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {data?.posts?.map((post: any) => (
                                    <div key={post.id} className="bg-[var(--surface-secondary)]/30 border border-[var(--border-subtle)] rounded-2xl group overflow-hidden hover:border-[var(--border-strong)] transition-all">
                                        {post.imageUrl && (
                                            <div className="aspect-[4/3] w-full overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                                                <img src={post.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                            </div>
                                        )}
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                                                    {new Date(post.createdAt).toLocaleDateString()}
                                                </span>
                                                <button
                                                    onClick={() => handleDeletePost(post.id)}
                                                    className="p-1.5 text-[var(--text-placeholder)] hover:text-[var(--state-risk)] transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <p className="text-[13px] font-medium text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-6">{post.content}</p>
                                            <div className="flex items-center gap-6 pt-4 border-t border-[var(--border-subtle)]">
                                                <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                                                    <Heart className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-bold">{post.likes || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                                                    <Eye className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-bold">{post.views || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "highlights" && (
                        <div className="space-y-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Venue Stories</h3>
                                    <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Pin key highlights or recent story moments.</p>
                                </div>
                                <button
                                    onClick={handleCreateHighlight}
                                    className="px-5 py-2.5 bg-[var(--text-primary)] text-[var(--surface-primary)] rounded-xl font-bold text-[12px] hover:opacity-90 transition-all"
                                >
                                    Add Story
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {data?.highlights?.map((h: any) => (
                                    <div key={h.id} className="group relative flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-full p-1 border-2 border-[var(--border-strong)] mb-3 transition-transform group-hover:scale-105">
                                            <div
                                                className="w-full h-full rounded-full flex items-center justify-center bg-[var(--surface-secondary)] text-[var(--text-tertiary)] transition-all overflow-hidden"
                                                style={{ backgroundColor: `${h.color}10` }}
                                            >
                                                <Camera className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <p className="text-[11px] font-bold text-[var(--text-secondary)]">{h.title}</p>
                                        <button
                                            onClick={() => handleDeleteHighlight(h.id)}
                                            className="absolute -top-1 -right-1 p-1.5 bg-[var(--surface-elevated)] rounded-full shadow-sm border border-[var(--border-subtle)] text-[var(--state-risk)] opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "followers" && (
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">Followers</h3>
                                <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Manage and view the community following your venue.</p>
                            </div>

                            <div className="bg-[var(--surface-secondary)]/30 rounded-3xl border border-[var(--border-subtle)] p-20 text-center">
                                <Users className="w-12 h-12 text-[var(--border-subtle)] mx-auto mb-6" />
                                <h4 className="text-[13px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-widest">Community Insights Coming Soon</h4>
                                <p className="text-[12px] text-[var(--text-secondary)] max-w-sm mx-auto">We're building a deeper way for you to engage with your {data?.stats?.followersCount || 0} followers.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Post Composer Modal (Apple Pro Style) */}
            <AnimatePresence>
                {isComposerOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsComposerOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-2xl bg-[var(--surface-primary)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-subtle)] flex flex-col max-h-[90vh]"
                        >
                            <div className="px-8 py-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-secondary)]/30">
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--text-primary)]">New Entry</h2>
                                    <p className="text-[11px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
                                        {draftStatus === "saving" ? "Auto-saving..." : draftStatus === "saved" ? "Draft Stored Local" : "Enter post details"}
                                    </p>
                                </div>
                                <button onClick={() => setIsComposerOpen(false)} className="p-2 hover:bg-[var(--surface-secondary)] rounded-full transition-colors">
                                    <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8 overflow-y-auto">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest ml-1">Message</label>
                                    <textarea
                                        value={composerContent}
                                        onChange={(e) => setComposerContent(e.target.value)}
                                        placeholder="What's happening at the venue?"
                                        className="w-full h-32 bg-[var(--surface-secondary)]/50 p-5 rounded-2xl text-[14px] font-medium text-[var(--text-primary)] outline-none focus:bg-[var(--surface-primary)] focus:border-[var(--border-strong)] transition-all border border-[var(--border-subtle)] leading-relaxed shadow-inner"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest ml-1">Media Asset</label>
                                    <input
                                        type="file"
                                        ref={composerFileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, "composer")}
                                    />
                                    <button
                                        onClick={() => composerFileInputRef.current?.click()}
                                        className="w-full py-10 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-[var(--surface-secondary)]/50 transition-all group"
                                    >
                                        <div className="p-3 bg-[var(--surface-secondary)] rounded-full group-hover:scale-110 transition-transform">
                                            <Upload className="w-5 h-5 text-[var(--text-tertiary)]" />
                                        </div>
                                        <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                                            {composerImage ? "Change Media Asset" : "Upload Direct Image / Video"}
                                        </p>
                                    </button>
                                </div>

                                {/* Preview Card */}
                                <div className="pt-4">
                                    <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest ml-1 mb-4 text-center">Preview Output</p>
                                    <div className="max-w-xs mx-auto bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-md">
                                        {composerImage && <img src={composerImage} className="aspect-square w-full object-cover" alt="" />}
                                        <div className="p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-4 h-4 rounded-md bg-[var(--text-primary)]" />
                                                <div className="h-2 w-16 bg-[var(--border-subtle)] rounded-full" />
                                            </div>
                                            <p className="text-[12px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                                                {composerContent || "Your editorial content will appear here..."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-[var(--border-subtle)] bg-[var(--surface-secondary)]/30">
                                <button
                                    onClick={handleCreatePost}
                                    disabled={isSaving || !composerContent}
                                    className="w-full py-4 bg-[var(--text-primary)] text-[var(--surface-primary)] rounded-2xl text-[13px] font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Post Entry"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Photo Edit Modal (Apple Pro Tone) */}
            <AnimatePresence>
                {photoModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPhotoModal(null)}
                            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="relative w-full max-w-md bg-[var(--surface-primary)] rounded-3xl shadow-2xl border border-[var(--border-subtle)] p-8"
                        >
                            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Update Visual</h2>
                            <p className="text-[12px] text-[var(--text-tertiary)] font-medium mb-8">
                                Specify the URL for the {photoModal.field === 'photoURL' ? 'profile avatar' : 'cover header'}.
                            </p>

                            <div className="space-y-6">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, "modal")}
                                />

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full aspect-video rounded-2xl bg-[var(--surface-secondary)] border-2 border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-all group overflow-hidden relative"
                                >
                                    {photoInputUrl ? (
                                        <img src={photoInputUrl} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        <>
                                            <div className="p-4 bg-[var(--surface-primary)] rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-[var(--text-tertiary)]" />
                                            </div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] text-center px-6">
                                                Tap to select and upload straight from device
                                            </p>
                                        </>
                                    )}
                                    {isSaving && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setPhotoModal(null)}
                                        className="flex-1 py-4 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-2xl text-[12px] font-bold hover:bg-[var(--surface-elevated)] transition-all uppercase tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SimpleStatCard({ label, value, icon: Icon }: any) {
    return (
        <div className="bg-[var(--surface-primary)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm hover:border-[var(--border-strong)] transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                    <Icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-4 h-4 text-[var(--state-confirmed)] opacity-40" />
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-1">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{label}</p>
        </div>
    );
}
