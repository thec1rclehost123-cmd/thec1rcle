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
    Heart,
    Camera,
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
    Users,
    Music,
    Play,
    Video,
    Link2,
    Award,
    Quote,
    Building2,
    Clock,
    Wifi,
    Car,
    UtensilsCrossed,
    TrendingUp,
    Zap,
    Calendar
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { AnimatePresence, motion } from "framer-motion";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Venue vibe options
const VIBE_OPTIONS = [
    "Techno", "House", "Deep House", "Tech House", "Minimal",
    "Trance", "Progressive", "Melodic", "Afro House", "Amapiano",
    "Bollywood", "Hip-hop", "Commercial", "Open Format", "Lounge",
    "Live Music", "Jazz", "Acoustic", "Electronic"
];

const VENUE_TYPES = [
    "Nightclub", "Lounge", "Bar", "Rooftop", "Pool Club",
    "Warehouse", "Festival Ground", "Concert Hall", "Restaurant & Bar"
];

const AMENITY_OPTIONS = [
    { id: "parking", label: "Valet Parking", icon: Car },
    { id: "wifi", label: "Free WiFi", icon: Wifi },
    { id: "food", label: "Food Service", icon: UtensilsCrossed },
    { id: "vip", label: "VIP Areas", icon: Award },
    { id: "outdoor", label: "Outdoor Space", icon: Building2 },
    { id: "smoking", label: "Smoking Area", icon: Clock }
];

export default function VenuePageManagement() {
    const { profile } = useDashboardAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"identity" | "content" | "media" | "engagement">("identity");
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    // Modal states
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerContent, setComposerContent] = useState("");
    const [composerImage, setComposerImage] = useState("");
    const [photoModal, setPhotoModal] = useState<{ field: string; currentUrl: string } | null>(null);
    const [photoInputUrl, setPhotoInputUrl] = useState("");
    const [videoModal, setVideoModal] = useState(false);
    const [newVideo, setNewVideo] = useState({ url: "", type: "aftermovie", title: "" });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const composerFileInputRef = useRef<HTMLInputElement>(null);

    const fetchProfileData = async () => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsLoading(true);
        try {
            const partnerId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/profile?profileId=${partnerId}&type=venue&stats=true`);
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
        setSaveStatus("saving");
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile.activeMembership.partnerId,
                    type: "venue",
                    action: "updateProfile",
                    data: updates,
                    user: { uid: profile.uid, name: profile.displayName }
                })
            });
            if (res.ok) {
                fetchProfileData();
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 2000);
            }
        } catch (err) {
            console.error(err);
            setSaveStatus("idle");
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
                    data: { content: composerContent, imageUrl: composerImage },
                    user: { uid: profile?.uid, name: profile?.displayName }
                })
            });
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
                    data: { postId },
                    user: { uid: profile?.uid }
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
                    data: { title, color: "#111111" },
                    user: { uid: profile?.uid, name: profile?.displayName }
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
                    data: { highlightId },
                    user: { uid: profile?.uid }
                })
            });
            fetchProfileData();
        } catch (err) {
            console.error(err);
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

            if (target === "modal" && photoModal) {
                if (photoModal.field === "photos") {
                    const currentPhotos = data?.profile?.photos || [];
                    await handleUpdateProfile({ photos: [...currentPhotos, downloadURL] });
                } else {
                    await handleUpdateProfile({ [photoModal.field]: downloadURL });
                }
                setPhotoModal(null);
                setPhotoInputUrl("");
            } else if (target === "composer") {
                setComposerImage(downloadURL);
            }
        } catch (err) {
            console.error("Upload error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleVibeToggle = (vibe: string) => {
        const currentVibes = data?.profile?.genres || [];
        const newVibes = currentVibes.includes(vibe)
            ? currentVibes.filter((v: string) => v !== vibe)
            : [...currentVibes, vibe];
        handleUpdateProfile({ genres: newVibes });
    };

    const handleAmenityToggle = (amenityId: string) => {
        const currentAmenities = data?.profile?.amenities || [];
        const newAmenities = currentAmenities.includes(amenityId)
            ? currentAmenities.filter((a: string) => a !== amenityId)
            : [...currentAmenities, amenityId];
        handleUpdateProfile({ amenities: newAmenities });
    };

    const handleAddVideo = async () => {
        if (!newVideo.url || !newVideo.title) return;
        const currentVideos = data?.profile?.videos || [];
        await handleUpdateProfile({ videos: [...currentVideos, { ...newVideo, id: Date.now() }] });
        setNewVideo({ url: "", type: "aftermovie", title: "" });
        setVideoModal(false);
    };

    const handleRemoveVideo = async (videoId: number) => {
        const currentVideos = data?.profile?.videos || [];
        await handleUpdateProfile({ videos: currentVideos.filter((v: any) => v.id !== videoId) });
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
            {/* Premium Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 md:p-12">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-start gap-6">
                        {/* Profile Avatar */}
                        <div
                            onClick={() => { setPhotoModal({ field: "photoURL", currentUrl: data?.profile?.photoURL }); setPhotoInputUrl(data?.profile?.photoURL || ""); }}
                            className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-2 border-white/20 cursor-pointer group"
                        >
                            {data?.profile?.photoURL ? (
                                <img src={data.profile.photoURL} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                            ) : (
                                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                    <Upload className="w-8 h-8 text-white/40" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold text-white/60 uppercase tracking-widest">
                                    {data?.profile?.venueType || "Venue"}
                                </span>
                                {data?.profile?.isVerified && (
                                    <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                        <CheckCircle2 className="w-3 h-3" /> Verified
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                                {data?.profile?.displayName || data?.profile?.name || "Your Venue"}
                            </h1>
                            <p className="text-white/50 text-sm font-medium max-w-md flex items-center gap-2">
                                <MapPinIcon className="w-4 h-4" />
                                {data?.profile?.address || data?.profile?.city || "Add your location"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {data?.profile?.slug && (
                            <a
                                href={`${process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || ''}/venue/${data.profile.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl text-[11px] font-bold border border-white/10 hover:bg-white/20 transition-all group"
                            >
                                <Globe className="w-4 h-4" />
                                <span>View Live</span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                        )}
                        <div className="flex items-center gap-2">
                            {saveStatus === "saved" && (
                                <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                                    <CheckCircle2 className="w-3 h-3" /> Saved
                                </span>
                            )}
                            <button
                                onClick={() => handleUpdateProfile({})}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl text-[11px] font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Publish
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="relative mt-8 pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    <QuickStat value={data?.stats?.followersCount || 0} label="Followers" icon={Users} />
                    <QuickStat value={data?.stats?.postsCount || 0} label="Posts" icon={FileText} />
                    <QuickStat value={data?.stats?.totalLikes || 0} label="Total Engagement" icon={Heart} />
                    <QuickStat value={data?.stats?.totalViews || 0} label="Page Views" icon={Eye} />
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex p-1.5 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-subtle)]">
                {[
                    { id: "identity", label: "Identity", icon: Settings },
                    { id: "content", label: "Content", icon: FileText },
                    { id: "media", label: "Media", icon: ImageIcon },
                    { id: "engagement", label: "Engagement", icon: TrendingUp }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-xl text-[11px] font-bold transition-all ${activeTab === tab.id
                                ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="bg-[var(--surface-primary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden min-h-[600px] shadow-sm">
                <div className="p-8 md:p-10">
                    <AnimatePresence mode="wait">
                        {activeTab === "identity" && (
                            <motion.div
                                key="identity"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-12"
                            >
                                {/* Core Identity */}
                                <section className="space-y-6">
                                    <SectionHeader title="Venue Identity" subtitle="The fundamentals of your public presence" icon={Building2} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField label="Venue Name" placeholder="Your venue's official name" defaultValue={data?.profile?.displayName} onSave={(v) => handleUpdateProfile({ displayName: v })} />
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Venue Type</label>
                                            <select
                                                value={data?.profile?.venueType || ""}
                                                onChange={(e) => handleUpdateProfile({ venueType: e.target.value })}
                                                className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                                            >
                                                <option value="">Select type...</option>
                                                {VENUE_TYPES.map((type) => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <FormField label="Description" placeholder="Describe the experience, the atmosphere, what makes you unique..." defaultValue={data?.profile?.bio} onSave={(v) => handleUpdateProfile({ bio: v })} multiline rows={5} />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField label="Capacity" placeholder="e.g. 500 guests" defaultValue={data?.profile?.capacity} onSave={(v) => handleUpdateProfile({ capacity: v })} />
                                        <FormField label="Opening Hours" placeholder="e.g. Thu-Sun, 10PM - 4AM" icon={Clock} defaultValue={data?.profile?.openingHours} onSave={(v) => handleUpdateProfile({ openingHours: v })} />
                                    </div>
                                </section>

                                {/* Visual Identity */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <SectionHeader title="Visual Identity" subtitle="Cover image for your public page" />
                                    <div
                                        onClick={() => { setPhotoModal({ field: "coverURL", currentUrl: data?.profile?.coverURL }); setPhotoInputUrl(data?.profile?.coverURL || ""); }}
                                        className="aspect-[21/9] w-full bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-subtle)] flex flex-col items-center justify-center group hover:border-[var(--border-strong)] transition-all cursor-pointer overflow-hidden relative"
                                    >
                                        {data?.profile?.coverURL ? (
                                            <img src={data.profile.coverURL} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-4 bg-[var(--surface-elevated)] rounded-2xl">
                                                    <ImageIcon className="h-8 w-8 text-[var(--text-tertiary)]" />
                                                </div>
                                                <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Upload Cover Image</p>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[11px] font-bold text-white text-center uppercase tracking-widest">Click to Change</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Music & Vibe */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <SectionHeader title="Music & Vibe" subtitle="Help guests discover you by genre and atmosphere" icon={Music} />

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Music Genres</label>
                                        <div className="flex flex-wrap gap-2">
                                            {VIBE_OPTIONS.map((vibe) => (
                                                <button
                                                    key={vibe}
                                                    onClick={() => handleVibeToggle(vibe)}
                                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${data?.profile?.genres?.includes(vibe)
                                                            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm"
                                                            : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)]"
                                                        }`}
                                                >
                                                    {vibe}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* Amenities */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <SectionHeader title="Amenities & Features" subtitle="Highlight what makes your venue special" icon={Award} />

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {AMENITY_OPTIONS.map((amenity) => {
                                            const isActive = data?.profile?.amenities?.includes(amenity.id);
                                            return (
                                                <button
                                                    key={amenity.id}
                                                    onClick={() => handleAmenityToggle(amenity.id)}
                                                    className={`p-4 rounded-2xl border transition-all flex items-center gap-3 ${isActive
                                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                                                            : "bg-[var(--surface-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                                                        }`}
                                                >
                                                    <amenity.icon className="w-5 h-5" />
                                                    <span className="text-sm font-medium">{amenity.label}</span>
                                                    {isActive && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* Location & Contact */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <SectionHeader title="Location & Contact" subtitle="Help guests find and reach you" icon={MapPinIcon} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            label="Full Address"
                                            placeholder="123 Party Street..."
                                            icon={MapPinIcon}
                                            defaultValue={data?.profile?.address}
                                            onSave={(v) => handleUpdateProfile({ address: v })}
                                        />
                                        <FormField
                                            label="City"
                                            placeholder="Pune"
                                            defaultValue={data?.profile?.city}
                                            onSave={(v) => handleUpdateProfile({ city: v })}
                                        />
                                        <FormField
                                            label="Phone"
                                            placeholder="+91 00000 00000"
                                            icon={Phone}
                                            defaultValue={data?.profile?.phone}
                                            onSave={(v) => handleUpdateProfile({ phone: v })}
                                        />
                                        <FormField
                                            label="Email"
                                            placeholder="reservations@..."
                                            icon={Mail}
                                            defaultValue={data?.profile?.email}
                                            onSave={(v) => handleUpdateProfile({ email: v })}
                                        />
                                        <FormField
                                            label="Instagram"
                                            placeholder="@yourhandle"
                                            icon={Instagram}
                                            defaultValue={data?.profile?.socialLinks?.instagram}
                                            onSave={(v) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, instagram: v } })}
                                        />
                                        <FormField
                                            label="Website"
                                            placeholder="https://..."
                                            icon={Globe}
                                            defaultValue={data?.profile?.website}
                                            onSave={(v) => handleUpdateProfile({ website: v })}
                                        />
                                    </div>
                                </section>
                            </motion.div>
                        )}

                        {activeTab === "content" && (
                            <motion.div
                                key="content"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-12"
                            >
                                {/* Posts Timeline */}
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Timeline Updates" subtitle="Share news, announcements, and event highlights" />
                                        <button
                                            onClick={() => setIsComposerOpen(true)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Post
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {data?.posts?.map((post: any) => (
                                            <PostCard key={post.id} post={post} onDelete={() => handleDeletePost(post.id)} />
                                        ))}
                                        {(!data?.posts || data.posts.length === 0) && (
                                            <div className="col-span-full py-16 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                                                <FileText className="w-10 h-10 text-[var(--border-subtle)] mx-auto mb-4" />
                                                <p className="text-[var(--text-tertiary)] text-sm font-medium">No posts yet. Share your first update!</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Highlights */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Story Highlights" subtitle="Pin your best moments to the top of your page" icon={Camera} />
                                        <button
                                            onClick={handleCreateHighlight}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-xl text-[11px] font-bold border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Highlight
                                        </button>
                                    </div>

                                    <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                                        {data?.highlights?.map((h: any) => (
                                            <HighlightCard key={h.id} highlight={h} onDelete={() => handleDeleteHighlight(h.id)} />
                                        ))}
                                        {(!data?.highlights || data.highlights.length === 0) && (
                                            <div className="w-full py-12 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                                                <Camera className="w-8 h-8 text-[var(--border-subtle)] mx-auto mb-3" />
                                                <p className="text-[var(--text-tertiary)] text-sm font-medium">No highlights added yet</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Upcoming Events Preview */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <SectionHeader title="Upcoming Events" subtitle="Events scheduled at your venue" icon={Calendar} />
                                    <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl p-8 text-center border border-[var(--border-subtle)]">
                                        <Calendar className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-4" />
                                        <p className="text-[var(--text-secondary)] text-sm font-medium">Events from your calendar will appear here</p>
                                        <a href="/venue/calendar" className="inline-flex items-center gap-2 mt-4 text-[11px] font-bold text-slate-600 hover:text-slate-900 uppercase tracking-widest">
                                            Go to Calendar <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </section>
                            </motion.div>
                        )}

                        {activeTab === "media" && (
                            <motion.div
                                key="media"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-12"
                            >
                                {/* Photo Gallery */}
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Photo Gallery" subtitle="Showcase your venue's atmosphere and past events" />
                                        <button
                                            onClick={() => { setPhotoModal({ field: "photos", currentUrl: "" }); setPhotoInputUrl(""); }}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Photo
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {data?.profile?.photos?.map((photo: string, idx: number) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-[var(--border-subtle)] group">
                                                <img src={photo} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                                <button
                                                    onClick={() => {
                                                        const newPhotos = data.profile.photos.filter((p: string) => p !== photo);
                                                        handleUpdateProfile({ photos: newPhotos });
                                                    }}
                                                    className="absolute top-2 right-2 p-2 bg-black/40 backdrop-blur-md rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!data?.profile?.photos || data.profile.photos.length === 0) && (
                                            <div className="col-span-full py-16 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                                                <ImageIcon className="w-10 h-10 text-[var(--border-subtle)] mx-auto mb-4" />
                                                <p className="text-[var(--text-tertiary)] text-sm font-medium">No photos uploaded yet</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Videos */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Videos & Recaps" subtitle="Share venue tours, event recaps, and aftermovies" icon={Video} />
                                        <button
                                            onClick={() => setVideoModal(true)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-xl text-[11px] font-bold border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Video
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {data?.profile?.videos?.map((video: any) => (
                                            <VideoCard key={video.id} video={video} onDelete={() => handleRemoveVideo(video.id)} />
                                        ))}
                                        {(!data?.profile?.videos || data.profile.videos.length === 0) && (
                                            <div className="col-span-full py-16 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                                                <Video className="w-10 h-10 text-[var(--border-subtle)] mx-auto mb-4" />
                                                <p className="text-[var(--text-tertiary)] text-sm font-medium">No videos added yet</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </motion.div>
                        )}

                        {activeTab === "engagement" && (
                            <motion.div
                                key="engagement"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-12"
                            >
                                {/* Followers Overview */}
                                <section className="space-y-6">
                                    <SectionHeader title="Audience Overview" subtitle="Understand your community and reach" icon={Users} />
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <EngagementStat label="Total Followers" value={data?.stats?.followersCount || 0} change="+18%" positive />
                                        <EngagementStat label="This Month" value={Math.floor((data?.stats?.followersCount || 0) * 0.2)} change="+12%" positive />
                                        <EngagementStat label="Engagement Rate" value={`${((data?.stats?.totalLikes || 0) / Math.max(data?.stats?.followersCount || 1, 1) * 100).toFixed(1)}%`} change="+5%" positive />
                                        <EngagementStat label="Page Views" value={data?.stats?.totalViews || 0} change="+32%" positive />
                                    </div>
                                </section>

                                {/* Coming Soon */}
                                <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                                    <div className="bg-gradient-to-br from-emerald-900 to-slate-800 rounded-3xl p-12 text-center">
                                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                            <Zap className="w-8 h-8 text-emerald-400" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Advanced Analytics Coming Soon</h3>
                                        <p className="text-white/60 max-w-md mx-auto text-sm">
                                            Deep audience insights, booking patterns, and engagement analytics are on the way.
                                        </p>
                                    </div>
                                </section>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Photo Upload Modal */}
            <AnimatePresence>
                {photoModal && (
                    <Modal onClose={() => setPhotoModal(null)}>
                        <div className="p-8">
                            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Update Image</h2>
                            <p className="text-[var(--text-tertiary)] text-sm mb-6">
                                Upload a new {photoModal.field === 'photoURL' ? 'venue logo' : photoModal.field === 'coverURL' ? 'cover image' : 'gallery photo'}
                            </p>

                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "modal")} />

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-video rounded-2xl bg-[var(--surface-secondary)] border-2 border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-all group overflow-hidden relative"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-8 h-8 text-[var(--text-tertiary)] animate-spin" />
                                ) : (
                                    <>
                                        <div className="p-4 bg-[var(--surface-elevated)] rounded-2xl group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6 text-[var(--text-tertiary)]" />
                                        </div>
                                        <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Click to Upload</p>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setPhotoModal(null)} className="flex-1 py-3 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-sm font-bold hover:bg-[var(--surface-elevated)] transition-all">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Video Add Modal */}
            <AnimatePresence>
                {videoModal && (
                    <Modal onClose={() => setVideoModal(false)}>
                        <div className="p-8">
                            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Add Video</h2>
                            <p className="text-[var(--text-tertiary)] text-sm mb-6">
                                Add a YouTube, Vimeo, or other video link
                            </p>

                            <div className="space-y-4">
                                <FormField label="Video Title" placeholder="e.g. Venue Tour 2024" value={newVideo.title} onChange={(v) => setNewVideo({ ...newVideo, title: v })} inline />
                                <FormField label="Video URL" placeholder="https://youtube.com/..." value={newVideo.url} onChange={(v) => setNewVideo({ ...newVideo, url: v })} inline />

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Type</label>
                                    <div className="flex gap-2">
                                        {["tour", "recap", "promo", "event"].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setNewVideo({ ...newVideo, type })}
                                                className={`px-4 py-2 rounded-lg text-[11px] font-bold capitalize ${newVideo.type === type
                                                        ? "bg-slate-900 text-white"
                                                        : "bg-[var(--surface-secondary)] text-[var(--text-secondary)]"
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setVideoModal(false)} className="flex-1 py-3 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-sm font-bold">Cancel</button>
                                <button onClick={handleAddVideo} disabled={!newVideo.url || !newVideo.title} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Add Video</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Post Composer Modal */}
            <AnimatePresence>
                {isComposerOpen && (
                    <Modal onClose={() => setIsComposerOpen(false)} wide>
                        <div className="flex flex-col md:flex-row max-h-[85vh]">
                            <div className="flex-1 p-8 border-r border-[var(--border-subtle)]">
                                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">New Post</h2>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Content</label>
                                        <textarea
                                            value={composerContent}
                                            onChange={(e) => setComposerContent(e.target.value)}
                                            placeholder="What's happening at the venue?"
                                            className="w-full h-40 p-4 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Image</label>
                                        <input type="file" ref={composerFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "composer")} />
                                        <button
                                            onClick={() => composerFileInputRef.current?.click()}
                                            className="w-full py-8 border-2 border-dashed border-[var(--border-subtle)] rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-[var(--surface-secondary)] transition-all"
                                        >
                                            <Upload className="w-6 h-6 text-[var(--text-tertiary)]" />
                                            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                                                {composerImage ? "Change Image" : "Upload Image"}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreatePost}
                                    disabled={isSaving || !composerContent}
                                    className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Post"}
                                </button>
                            </div>

                            <div className="w-full md:w-80 bg-[var(--surface-secondary)] p-8">
                                <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-4">Preview</p>
                                <div className="bg-[var(--surface-primary)] rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
                                    {composerImage && <img src={composerImage} className="w-full aspect-video object-cover" alt="" />}
                                    <div className="p-4">
                                        <p className="text-sm text-[var(--text-secondary)] line-clamp-4">
                                            {composerContent || "Your post content..."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper Components
function QuickStat({ value, label, icon: Icon }: { value: number | string; label: string; icon: any }) {
    return (
        <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
                <Icon className="w-5 h-5 text-white/60" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</p>
            </div>
        </div>
    );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon?: any }) {
    return (
        <div className="flex items-start gap-4">
            {Icon && (
                <div className="p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                    <Icon className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
            )}
            <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm text-[var(--text-tertiary)]">{subtitle}</p>
            </div>
        </div>
    );
}

function FormField({ label, placeholder, defaultValue, value, onSave, onChange, multiline, rows, icon: Icon, inline }: any) {
    const [localValue, setLocalValue] = useState(value ?? defaultValue ?? "");

    useEffect(() => {
        if (value !== undefined) setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (onSave && localValue !== defaultValue) {
            onSave(localValue);
        }
    };

    const handleChange = (e: any) => {
        setLocalValue(e.target.value);
        if (onChange) onChange(e.target.value);
    };

    const inputClasses = "w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-[var(--border-strong)] transition-all";

    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{label}</label>
            <div className="relative">
                {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />}
                {multiline ? (
                    <textarea
                        value={localValue}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        rows={rows || 4}
                        className={`${inputClasses} resize-none`}
                    />
                ) : (
                    <input
                        type="text"
                        value={localValue}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        className={`${inputClasses} ${Icon ? "pl-12" : ""}`}
                    />
                )}
            </div>
        </div>
    );
}

function PostCard({ post, onDelete }: { post: any; onDelete: () => void }) {
    return (
        <div className="bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)] overflow-hidden group hover:border-[var(--border-strong)] transition-all">
            {post.imageUrl && (
                <div className="aspect-video w-full overflow-hidden">
                    <img src={post.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                </div>
            )}
            <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                        {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    <button onClick={onDelete} className="p-1.5 text-[var(--text-placeholder)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4">{post.content}</p>
                <div className="flex items-center gap-4 pt-3 border-t border-[var(--border-subtle)]">
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
    );
}

function HighlightCard({ highlight, onDelete }: { highlight: any; onDelete: () => void }) {
    return (
        <div className="flex-shrink-0 group relative">
            <div className="w-24 h-24 rounded-full border-2 border-[var(--border-strong)] p-1 mb-3 transition-transform group-hover:scale-105">
                <div className="w-full h-full rounded-full bg-[var(--surface-secondary)] flex items-center justify-center" style={{ backgroundColor: `${highlight.color}15` }}>
                    <Camera className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
            </div>
            <p className="text-[11px] font-bold text-[var(--text-secondary)] text-center truncate w-24">{highlight.title}</p>
            <button
                onClick={onDelete}
                className="absolute -top-1 -right-1 p-1.5 bg-[var(--surface-elevated)] rounded-full shadow-sm border border-[var(--border-subtle)] text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}

function VideoCard({ video, onDelete }: { video: any; onDelete: () => void }) {
    return (
        <div className="bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)] overflow-hidden group hover:border-[var(--border-strong)] transition-all">
            <div className="aspect-video w-full bg-slate-900 flex items-center justify-center relative">
                <Play className="w-12 h-12 text-white/60" />
                <span className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">
                    {video.type}
                </span>
            </div>
            <div className="p-4 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{video.title}</p>
                <button onClick={onDelete} className="p-1.5 text-[var(--text-placeholder)] hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function EngagementStat({ label, value, change, positive }: { label: string; value: number | string; change: string; positive: boolean }) {
    return (
        <div className="p-6 bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-2">{label}</p>
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            <span className={`text-[11px] font-bold ${positive ? "text-emerald-500" : "text-red-500"}`}>{change}</span>
        </div>
    );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={`relative bg-[var(--surface-primary)] rounded-3xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden ${wide ? "w-full max-w-3xl" : "w-full max-w-md"}`}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-[var(--surface-secondary)] rounded-xl z-10">
                    <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
                {children}
            </motion.div>
        </div>
    );
}
