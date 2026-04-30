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
    Quote,
    Disc3,
    Headphones,
    TrendingUp,
    Zap,
    ChevronRight,
    MoreHorizontal,
    AlertTriangle
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { AnimatePresence, motion } from "framer-motion";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { formatDate, formatNumber } from "@/lib/utils/format";

// Genre options for hosts
const GENRE_OPTIONS = [
    "Techno", "House", "Deep House", "Tech House", "Minimal",
    "Trance", "Progressive", "Melodic", "Afro House", "Amapiano",
    "Bollywood", "Hip-hop", "Trap", "Bass", "Dubstep",
    "Drum & Bass", "Commercial", "Open Format", "Lounge", "Chill"
];

const STYLE_TAGS = [
    "Underground", "Mainstream", "Exclusive", "Boutique",
    "Festival", "Club", "Afterhours", "Day Party",
    "Rooftop", "Warehouse", "Intimate", "High Energy"
];

const ROLE_OPTIONS = ["DJ", "Promoter", "Collective", "Artist", "Producer", "Label"];

export default function HostPageManagement() {
    const { profile, user } = useDashboardAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"identity" | "content" | "media" | "engagement" | "broadcast">("identity");
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    // Broadcast state
    const [broadcastTitle, setBroadcastTitle] = useState("");
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastStatus, setBroadcastStatus] = useState<"idle" | "success" | "error">("idle");
    const [broadcastError, setBroadcastError] = useState<string>("");

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
        setIsError(false);
        try {
            const partnerId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/profile?profileId=${partnerId}&type=host&stats=true`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                setIsError(true);
            }
        } catch (err) {
            setIsError(true);
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
                    type: "host",
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
                    type: "host",
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
                    type: "host",
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
                    type: "host",
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
                    type: "host",
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "modal" | "composer" | "gallery") => {
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

    const handleGenreToggle = (genre: string) => {
        const currentGenres = data?.profile?.genres || [];
        const newGenres = currentGenres.includes(genre)
            ? currentGenres.filter((g: string) => g !== genre)
            : [...currentGenres, genre];
        handleUpdateProfile({ genres: newGenres });
    };

    const handleStyleTagToggle = (tag: string) => {
        const currentTags = data?.profile?.styleTags || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter((t: string) => t !== tag)
            : [...currentTags, tag];
        handleUpdateProfile({ styleTags: newTags });
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
                <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: "var(--v-orange)" }} />
                <p className="font-bold uppercase tracking-widest text-[10px]" style={{ color: "var(--v-text-tertiary)" }}>Syncing Page Presence...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="py-24 flex flex-col items-center justify-center gap-4">
                <AlertTriangle className="h-8 w-8" style={{ color: "var(--v-error)" }} />
                <p className="font-semibold text-sm" style={{ color: "var(--v-text-secondary)" }}>Failed to load page data</p>
                <button
                    onClick={fetchProfileData}
                    className="px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-primary)" }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <VenuePageShell
            title="Page Management"
            subtitle={data?.profile?.tagline || "Curate how your public profile appears to guests and partners"}
            actions={
                <div className="flex items-center gap-3">
                    {data?.profile?.slug && (
                        <a
                            href={`${process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || ''}/host/${data.profile.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <VenueActionButton variant="secondary">
                                <Globe className="w-4 h-4 mr-2" /> View Live
                                <ExternalLink className="w-3 h-3 ml-1" />
                            </VenueActionButton>
                        </a>
                    )}
                    <VenueActionButton variant="primary" onClick={() => handleUpdateProfile({})} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        <span className="ml-2">{saveStatus === "saved" ? "Saved" : "Publish"}</span>
                    </VenueActionButton>
                </div>
            }
        >
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-[32px] p-6 border" style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}>
                <QuickStat value={data?.stats?.followersCount || 0} label="Followers" icon={Users} />
                <QuickStat value={data?.stats?.postsCount || 0} label="Posts" icon={FileText} />
                <QuickStat value={data?.stats?.totalLikes || 0} label="Total Engagement" icon={Heart} />
                <QuickStat value={data?.stats?.totalViews || 0} label="Page Views" icon={Eye} />
            </div>

            {/* Tab Navigation */}
            <div className="flex p-1 bg-surface-secondary rounded-xl border border-border-subtle overflow-x-auto scrollbar-hide">
                {[
                    { id: "identity", label: "Identity", icon: Settings },
                    { id: "content", label: "Content", icon: FileText },
                    { id: "media", label: "Media", icon: ImageIcon },
                    { id: "broadcast", label: "Broadcast", icon: Zap },
                    { id: "engagement", label: "Engagement", icon: TrendingUp }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-2 px-4 whitespace-nowrap flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-all ${activeTab === tab.id
                            ? "bg-surface-base text-text-primary shadow-sm"
                            : "text-text-tertiary hover:text-text-secondary"
                            }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="bg-surface-base rounded-2xl border border-border-subtle overflow-hidden min-h-[500px] shadow-sm">
                <div className="p-6 md:p-8">
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
                                <section className="space-y-5">
                                    <SectionHeader title="Core Identity" subtitle="The fundamentals of your public presence" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <FormField label="Display Name" placeholder="Your stage name or brand" defaultValue={data?.profile?.displayName} onSave={(v: string) => handleUpdateProfile({ displayName: v })} />
                                        <FormField label="Tagline" placeholder="A one-liner that defines you" defaultValue={data?.profile?.tagline} onSave={(v: string) => handleUpdateProfile({ tagline: v })} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Neighborhood</label>
                                            <FormField placeholder="e.g. Bandra West, Indiranagar" defaultValue={data?.profile?.neighborhood} onSave={(v: string) => handleUpdateProfile({ neighborhood: v })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Category Tag</label>
                                            <select
                                                value={data?.profile?.categoryTag || "Host"}
                                                onChange={(e) => handleUpdateProfile({ categoryTag: e.target.value })}
                                                className="w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all appearance-none"
                                            >
                                                {["Host", "Venue", "Brand", "Promoter", "Collective"].map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <FormField label="Bio / Story" placeholder="Tell your story, describe your sound, share your journey..." defaultValue={data?.profile?.bio} onSave={(v: string) => handleUpdateProfile({ bio: v })} multiline rows={5} />

                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Role / Type</label>
                                        <div className="flex flex-wrap gap-2">
                                            {ROLE_OPTIONS.map((role) => (
                                                <button
                                                    key={role}
                                                    onClick={() => handleUpdateProfile({ role })}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${data?.profile?.role === role
                                                        ? "bg-surface-secondary text-text-primary shadow-sm"
                                                        : "bg-surface-secondary/50 text-text-secondary hover:bg-surface-elevated border border-border-subtle"
                                                        }`}
                                                >
                                                    {role}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* CTA Layer - New Section */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Action Layer" subtitle="Configure primary call-to-action buttons for your page" icon={Zap} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <FormField
                                            label="WhatsApp Number"
                                            placeholder="+91..."
                                            icon={Phone}
                                            defaultValue={data?.profile?.whatsapp}
                                            onSave={(v: string) => handleUpdateProfile({ whatsapp: v })}
                                        />
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Primary CTA Type</label>
                                            <select
                                                value={data?.profile?.primaryCta || "follow"}
                                                onChange={(e) => handleUpdateProfile({ primaryCta: e.target.value })}
                                                className="w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all appearance-none"
                                            >
                                                <option value="follow">Follow Only</option>
                                                <option value="whatsapp">Contact via WhatsApp</option>
                                                <option value="call">Phone Call</option>
                                                <option value="website">Visit Website</option>
                                                <option value="tickets">Buy Tickets (Featured)</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                {/* Visual Identity */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Visual Identity" subtitle="Cover image for your public page" />
                                    <div
                                        onClick={() => { setPhotoModal({ field: "coverURL", currentUrl: data?.profile?.coverURL }); setPhotoInputUrl(data?.profile?.coverURL || ""); }}
                                        className="aspect-[21/9] md:aspect-[24/5] w-full bg-surface-secondary rounded-2xl border border-border-subtle flex flex-col items-center justify-center group hover:border-border-strong transition-all cursor-pointer overflow-hidden relative"
                                    >
                                        {data?.profile?.coverURL ? (
                                            <img src={data.profile.coverURL} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="p-3 bg-surface-elevated rounded-xl">
                                                    <ImageIcon className="h-6 w-6 text-text-tertiary" />
                                                </div>
                                                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Upload Cover Image</p>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[10px] font-bold text-text-primary text-center uppercase tracking-widest">Click to Change</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Genres & Style */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Sound & Style" subtitle="Help guests discover you by genre and vibe" icon={Music} />

                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Genres</label>
                                        <div className="flex flex-wrap gap-2">
                                            {GENRE_OPTIONS.map((genre) => (
                                                <button
                                                    key={genre}
                                                    onClick={() => handleGenreToggle(genre)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${data?.profile?.genres?.includes(genre)
                                                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-text-primary shadow-sm"
                                                        : "bg-surface-secondary/50 text-text-secondary hover:bg-surface-elevated border border-border-subtle"
                                                        }`}
                                                >
                                                    {genre}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Style Tags</label>
                                        <div className="flex flex-wrap gap-2">
                                            {STYLE_TAGS.map((tag) => (
                                                <button
                                                    key={tag}
                                                    onClick={() => handleStyleTagToggle(tag)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${data?.profile?.styleTags?.includes(tag)
                                                        ? "bg-surface-secondary text-text-primary shadow-sm"
                                                        : "bg-surface-secondary/50 text-text-secondary hover:bg-surface-elevated border border-border-subtle"
                                                        }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* Social & Contact */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Social & Contact" subtitle="Connect your channels and let fans find you everywhere" icon={Link2} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                        <FormField
                                            label="Instagram"
                                            placeholder="@yourhandle"
                                            icon={Instagram}
                                            defaultValue={data?.profile?.socialLinks?.instagram}
                                            onSave={(v: string) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, instagram: v } })}
                                        />
                                        <FormField
                                            label="Twitter / X"
                                            placeholder="@yourhandle"
                                            icon={Twitter}
                                            defaultValue={data?.profile?.socialLinks?.twitter}
                                            onSave={(v: string) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, twitter: v } })}
                                        />
                                        <FormField
                                            label="SoundCloud"
                                            placeholder="soundcloud.com/..."
                                            icon={Disc3}
                                            defaultValue={data?.profile?.socialLinks?.soundcloud}
                                            onSave={(v: string) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, soundcloud: v } })}
                                        />
                                        <FormField
                                            label="Spotify"
                                            placeholder="open.spotify.com/artist/..."
                                            icon={Headphones}
                                            defaultValue={data?.profile?.socialLinks?.spotify}
                                            onSave={(v: string) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, spotify: v } })}
                                        />
                                        <FormField
                                            label="Website"
                                            placeholder="https://..."
                                            icon={Globe}
                                            defaultValue={data?.profile?.website}
                                            onSave={(v: string) => handleUpdateProfile({ website: v })}
                                        />
                                        <FormField
                                            label="Email"
                                            placeholder="booking@..."
                                            icon={Mail}
                                            defaultValue={data?.profile?.email}
                                            onSave={(v: string) => handleUpdateProfile({ email: v })}
                                        />
                                        <FormField
                                            label="Location"
                                            placeholder="City, Country"
                                            icon={MapPinIcon}
                                            defaultValue={data?.profile?.city}
                                            onSave={(v) => handleUpdateProfile({ city: v })}
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
                                className="space-y-10"
                            >
                                {/* Posts Timeline */}
                                <section className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Timeline Updates" subtitle="Share news, announcements, and behind-the-scenes" />
                                        <button
                                            onClick={() => setIsComposerOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary text-text-primary rounded-xl text-[10px] font-bold hover:bg-surface-tertiary transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            New Post
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                        {data?.posts?.map((post: any) => (
                                            <PostCard key={post.id} post={post} onDelete={() => handleDeletePost(post.id)} />
                                        ))}
                                        {(!data?.posts || data.posts.length === 0) && (
                                            <div className="col-span-full py-12 text-center bg-surface-secondary/30 rounded-2xl border border-dashed border-border-subtle">
                                                <FileText className="w-8 h-8 text-border-subtle mx-auto mb-3" />
                                                <p className="text-text-tertiary text-xs font-medium">No posts yet. Share your first update!</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Highlights */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Story Highlights" subtitle="Pin your best moments to the top of your page" icon={Camera} />
                                        <button
                                            onClick={handleCreateHighlight}
                                            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary text-text-primary rounded-xl text-[10px] font-bold border border-border-subtle hover:bg-surface-elevated transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Highlight
                                        </button>
                                    </div>

                                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                        {data?.highlights?.map((h: any) => (
                                            <HighlightCard key={h.id} highlight={h} onDelete={() => handleDeleteHighlight(h.id)} />
                                        ))}
                                        {(!data?.highlights || data.highlights.length === 0) && (
                                            <div className="w-full py-8 text-center bg-surface-secondary/30 rounded-2xl border border-dashed border-border-subtle">
                                                <Camera className="w-6 h-6 text-border-subtle mx-auto mb-2" />
                                                <p className="text-text-tertiary text-xs font-medium">No highlights added yet</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Press Snippets */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Press & Features" subtitle="Showcase media mentions and press coverage" icon={Quote} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {data?.profile?.pressSnippets?.map((snippet: any, idx: number) => (
                                            <div key={idx} className="p-5 bg-surface-secondary/50 rounded-xl border border-border-subtle">
                                                <Quote className="w-4 h-4 text-text-tertiary mb-2" />
                                                <p className="text-text-secondary text-xs mb-2 italic">"{snippet.quote}"</p>
                                                <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">{snippet.source}</p>
                                            </div>
                                        ))}
                                        <button className="p-5 bg-surface-secondary/30 rounded-xl border border-dashed border-border-subtle flex flex-col items-center justify-center gap-2 hover:bg-surface-secondary transition-all group">
                                            <Plus className="w-5 h-5 text-text-tertiary group-hover:text-text-secondary" />
                                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Add Press Quote</span>
                                        </button>
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
                                className="space-y-10"
                            >
                                {/* Photo Gallery */}
                                <section className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Photo Gallery" subtitle="Showcase your best shots from events and performances" />
                                        <button
                                            onClick={() => { setPhotoModal({ field: "photos", currentUrl: "" }); setPhotoInputUrl(""); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary text-text-primary rounded-xl text-[10px] font-bold hover:bg-surface-tertiary transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Photo
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                                        {data?.profile?.photos?.map((photo: string, idx: number) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-border-subtle group">
                                                <img src={photo} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                                <button
                                                    onClick={() => {
                                                        const newPhotos = data.profile.photos.filter((p: string) => p !== photo);
                                                        handleUpdateProfile({ photos: newPhotos });
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!data?.profile?.photos || data.profile.photos.length === 0) && (
                                            <div className="col-span-full py-12 text-center bg-surface-secondary/30 rounded-2xl border border-dashed border-border-subtle">
                                                <ImageIcon className="w-8 h-8 text-border-subtle mx-auto mb-3" />
                                                <p className="text-text-tertiary text-xs font-medium">No photos uploaded yet</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Videos & Aftermovies */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader title="Videos & Aftermovies" subtitle="Share recaps, aftermovies, and performance clips" icon={Video} />
                                        <button
                                            onClick={() => setVideoModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary text-text-primary rounded-xl text-[10px] font-bold border border-border-subtle hover:bg-surface-elevated transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Video
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                        {data?.profile?.videos?.map((video: any) => (
                                            <VideoCard key={video.id} video={video} onDelete={() => handleRemoveVideo(video.id)} />
                                        ))}
                                        {(!data?.profile?.videos || data.profile.videos.length === 0) && (
                                            <div className="col-span-full py-12 text-center bg-surface-secondary/30 rounded-2xl border border-dashed border-border-subtle">
                                                <Video className="w-8 h-8 text-border-subtle mx-auto mb-3" />
                                                <p className="text-text-tertiary text-xs font-medium">No videos added yet</p>
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
                                className="space-y-10"
                            >
                                {/* Followers Overview */}
                                <section className="space-y-5">
                                    <SectionHeader title="Audience Overview" subtitle="Understand your community and reach" icon={Users} />
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <EngagementStat label="Total Followers" value={data?.stats?.followersCount || 0} change="+12%" positive />
                                        <EngagementStat label="This Month" value="—" change="" positive={false} />
                                        <EngagementStat label="Engagement Rate" value={`${((data?.stats?.totalLikes || 0) / Math.max(data?.stats?.followersCount || 1, 1) * 100).toFixed(1)}%`} change="+3%" positive />
                                        <EngagementStat label="Page Views" value={data?.stats?.totalViews || 0} change="+24%" positive />
                                    </div>
                                </section>

                                {/* Follower Growth */}
                                <section className="space-y-6 pt-8 border-t border-border-subtle">
                                    <SectionHeader title="Follower Growth" subtitle="Track your audience expansion over time" icon={TrendingUp} />
                                    <div className="bg-surface-secondary/30 rounded-3xl border border-border-subtle p-8 flex items-center justify-center h-40">
                                        <p className="text-[13px] text-text-tertiary">Growth data not yet available</p>
                                    </div>
                                </section>

                                {/* Demographics */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Audience Demographics" subtitle="Who your followers are" icon={Users} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                        {/* Age Distribution */}
                                        <div className="bg-surface-secondary/30 rounded-2xl border border-border-subtle p-6 space-y-4">
                                            <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Age Bands</h4>
                                            {[
                                                { range: "18-21", pct: 22, color: "bg-violet-500" },
                                                { range: "21-25", pct: 41, color: "bg-indigo-500" },
                                                { range: "25-30", pct: 24, color: "bg-sky-500" },
                                                { range: "30-35", pct: 9, color: "bg-teal-500" },
                                                { range: "35+", pct: 4, color: "bg-slate-500" },
                                            ].map((band) => (
                                                <div key={band.range} className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-text-secondary">{band.range}</span>
                                                        <span className="text-[11px] font-bold text-text-tertiary">{band.pct}%</span>
                                                    </div>
                                                    <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                                                        <div className={`h-full ${band.color} rounded-full transition-all`} style={{ width: `${band.pct}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Gender Split */}
                                        <div className="bg-surface-secondary/30 rounded-2xl border border-border-subtle p-6 space-y-4">
                                            <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Gender Split</h4>
                                            <div className="flex items-center justify-center gap-6 py-2">
                                                <div className="text-center">
                                                    <div className="w-16 h-16 rounded-full bg-indigo-500/20 border-4 border-indigo-500 flex items-center justify-center mb-2">
                                                        <span className="text-lg font-black text-indigo-400">58%</span>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Male</p>
                                                </div>
                                                <div className="text-center">
                                                    <div className="w-16 h-16 rounded-full bg-pink-500/20 border-4 border-pink-500 flex items-center justify-center mb-2">
                                                        <span className="text-lg font-black text-pink-400">38%</span>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Female</p>
                                                </div>
                                                <div className="text-center">
                                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 border-[3px] border-purple-500 flex items-center justify-center mb-2">
                                                        <span className="text-xs font-black text-purple-400">4%</span>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Other</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top Cities */}
                                        <div className="bg-surface-secondary/30 rounded-2xl border border-border-subtle p-6 space-y-4">
                                            <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Top Cities</h4>
                                            {[
                                                { city: "Pune", pct: 48 },
                                                { city: "Mumbai", pct: 28 },
                                                { city: "Bangalore", pct: 12 },
                                                { city: "Delhi", pct: 7 },
                                                { city: "Others", pct: 5 },
                                            ].map((c, i) => (
                                                <div key={c.city} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-lg bg-surface-secondary flex items-center justify-center text-[10px] font-black text-text-tertiary">{i + 1}</span>
                                                        <span className="text-[12px] font-bold text-text-primary">{c.city}</span>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-text-tertiary">{c.pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* Engagement Patterns */}
                                <section className="space-y-5 pt-6 border-t border-border-subtle">
                                    <SectionHeader title="Engagement Patterns" subtitle="When your audience is most active" icon={Zap} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <div className="bg-surface-secondary/30 rounded-2xl border border-border-subtle p-6 space-y-4">
                                            <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Best Posting Times</h4>
                                            {[
                                                { day: "Friday", time: "7:00 PM - 9:00 PM", engagement: "Highest" },
                                                { day: "Saturday", time: "1:00 PM - 3:00 PM", engagement: "High" },
                                                { day: "Thursday", time: "8:00 PM - 10:00 PM", engagement: "Good" },
                                            ].map((slot) => (
                                                <div key={slot.day} className="flex items-center justify-between p-3 bg-surface-secondary/30 rounded-xl">
                                                    <div>
                                                        <p className="text-[11px] font-bold text-text-primary">{slot.day}</p>
                                                        <p className="text-[9px] text-text-tertiary">{slot.time}</p>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${slot.engagement === "Highest" ? "text-emerald-400" :
                                                            slot.engagement === "High" ? "text-blue-400" : "text-text-tertiary"
                                                        }`}>{slot.engagement}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-surface-secondary/30 rounded-2xl border border-border-subtle p-6 space-y-4">
                                            <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Content Performance</h4>
                                            {[
                                                { type: "Event Announcements", rate: "8.4%", icon: "🎪" },
                                                { type: "Behind-the-Scenes", rate: "6.2%", icon: "🎬" },
                                                { type: "Lineup Reveals", rate: "11.1%", icon: "🎧" },
                                                { type: "Aftermovies", rate: "9.7%", icon: "📹" },
                                            ].map((content) => (
                                                <div key={content.type} className="flex items-center justify-between p-3 bg-surface-secondary/30 rounded-xl">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-base">{content.icon}</span>
                                                        <p className="text-[11px] font-bold text-text-primary">{content.type}</p>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-emerald-400">{content.rate}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </motion.div>
                        )}

                        {activeTab === "broadcast" && (
                            <motion.div
                                key="broadcast"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <section className="space-y-6">
                                    <SectionHeader
                                        title="Push Broadcast"
                                        subtitle="Send a direct notification to all your followers on THE C1RCLE"
                                        icon={Zap}
                                    />

                                    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 rounded-[2rem] p-8 space-y-6">
                                        <div className="space-y-5">
                                            <FormField
                                                label="Notification Title"
                                                placeholder="e.g. New Event Dropping Tonight! 🔥"
                                                value={broadcastTitle}
                                                onChange={setBroadcastTitle}
                                            />
                                            <FormField
                                                label="Message Body"
                                                placeholder="Details about your announcement..."
                                                multiline
                                                rows={4}
                                                value={broadcastMessage}
                                                onChange={setBroadcastMessage}
                                            />
                                        </div>

                                        <div className="pt-6 border-t border-white/5 space-y-4">
                                            <div className="flex items-center gap-3 text-accent-primary">
                                                <Users className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Target: {data?.stats?.followersCount || 0} Followers</span>
                                            </div>

                                            {broadcastStatus === "success" && (
                                                <div className="flex items-center gap-3 py-3 px-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest">Broadcast delivered to all followers</span>
                                                </div>
                                            )}
                                            {broadcastStatus === "error" && (
                                                <div className="flex items-center gap-3 py-3 px-5 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                                    <X className="w-4 h-4 text-red-400" />
                                                    <span className="text-[11px] font-bold text-red-300 uppercase tracking-widest">{broadcastError || "Failed to send broadcast"}</span>
                                                </div>
                                            )}

                                            <button
                                                disabled={!broadcastTitle || !broadcastMessage || isBroadcasting}
                                                onClick={async () => {
                                                    setIsBroadcasting(true);
                                                    setBroadcastStatus("idle");
                                                    setBroadcastError("");
                                                    try {
                                                        const res = await fetch("/api/partners/hosts/broadcast", {
                                                            method: "POST",
                                                            headers: {
                                                                "Content-Type": "application/json",
                                                                ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}),
                                                            },
                                                            body: JSON.stringify({
                                                                hostId: profile?.activeMembership?.partnerId,
                                                                title: broadcastTitle,
                                                                message: broadcastMessage
                                                            })
                                                        });
                                                        if (res.ok) {
                                                            setBroadcastStatus("success");
                                                            setBroadcastTitle("");
                                                            setBroadcastMessage("");
                                                            setTimeout(() => setBroadcastStatus("idle"), 5000);
                                                        } else {
                                                            const errData = await res.json().catch(() => ({}));
                                                            setBroadcastError(errData.error || "Service temporarily unavailable");
                                                            setBroadcastStatus("error");
                                                            setTimeout(() => setBroadcastStatus("idle"), 5000);
                                                        }
                                                    } catch (err) {
                                                        setBroadcastError("Network error. Please try again.");
                                                        setBroadcastStatus("error");
                                                        setTimeout(() => setBroadcastStatus("idle"), 5000);
                                                    } finally {
                                                        setIsBroadcasting(false);
                                                    }
                                                }}
                                                className="w-full py-4 bg-surface-elevated text-text-primary rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50"
                                            >
                                                {isBroadcasting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send Broadcast Now"}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <div className="p-6 bg-surface-secondary/30 rounded-2xl border border-border-subtle">
                                            <h4 className="text-[10px] font-bold text-text-primary mb-2 uppercase tracking-widest">Auto-Broadcasts</h4>
                                            <p className="text-[10px] text-text-tertiary leading-relaxed">Followers are automatically notified when you launch a new ticketed event.</p>
                                        </div>
                                        <div className="p-6 bg-surface-secondary/30 rounded-2xl border border-border-subtle">
                                            <h4 className="text-[10px] font-bold text-text-primary mb-2 uppercase tracking-widest">Delivery Time</h4>
                                            <p className="text-[10px] text-text-tertiary leading-relaxed">Broadcasts are delivered instantly via Mobile Push and In-App Notifications.</p>
                                        </div>
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
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-text-primary mb-1">Update Image</h2>
                            <p className="text-text-tertiary text-xs mb-5">
                                Upload a new {photoModal.field === 'photoURL' ? 'profile photo' : photoModal.field === 'coverURL' ? 'cover image' : 'gallery photo'}
                            </p>

                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "modal")} />

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-video rounded-2xl bg-surface-secondary border-2 border-dashed border-border-subtle flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-surface-elevated transition-all group overflow-hidden relative"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-8 h-8 text-text-tertiary animate-spin" />
                                ) : (
                                    <>
                                        <div className="p-4 bg-surface-elevated rounded-2xl group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6 text-text-tertiary" />
                                        </div>
                                        <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Click to Upload</p>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-3 mt-5">
                                <button onClick={() => setPhotoModal(null)} className="flex-1 py-2.5 bg-surface-secondary text-text-secondary rounded-xl text-xs font-bold hover:bg-surface-elevated transition-all">
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
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-text-primary mb-1">Add Video</h2>
                            <p className="text-text-tertiary text-xs mb-5">
                                Add a YouTube, Vimeo, or SoundCloud link
                            </p>

                            <div className="space-y-4">
                                <FormField label="Video Title" placeholder="e.g. Summer 2024 Aftermovie" value={newVideo.title} onChange={(v) => setNewVideo({ ...newVideo, title: v })} inline />
                                <FormField label="Video URL" placeholder="https://youtube.com/..." value={newVideo.url} onChange={(v) => setNewVideo({ ...newVideo, url: v })} inline />

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Type</label>
                                    <div className="flex gap-2">
                                        {["aftermovie", "recap", "promo", "live"].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setNewVideo({ ...newVideo, type })}
                                                className={`px-4 py-2 rounded-lg text-[11px] font-bold capitalize ${newVideo.type === type
                                                    ? "bg-surface-secondary text-text-primary"
                                                    : "bg-surface-secondary text-text-secondary"
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-5">
                                <button onClick={() => setVideoModal(false)} className="flex-1 py-2.5 bg-surface-secondary text-text-secondary rounded-xl text-xs font-bold">Cancel</button>
                                <button onClick={handleAddVideo} disabled={!newVideo.url || !newVideo.title} className="flex-1 py-2.5 bg-surface-secondary text-text-primary rounded-xl text-xs font-bold disabled:opacity-50">Add Video</button>
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
                            <div className="flex-1 p-6 border-r border-border-subtle">
                                <h2 className="text-lg font-bold text-text-primary mb-5">New Post</h2>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Content</label>
                                        <textarea
                                            value={composerContent}
                                            onChange={(e) => setComposerContent(e.target.value)}
                                            placeholder="What's happening?"
                                            className="w-full h-40 p-4 bg-surface-secondary border border-border-subtle rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Image</label>
                                        <input type="file" ref={composerFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "composer")} />
                                        <button
                                            onClick={() => composerFileInputRef.current?.click()}
                                            className="w-full py-8 border-2 border-dashed border-border-subtle rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-surface-secondary transition-all"
                                        >
                                            <Upload className="w-6 h-6 text-text-tertiary" />
                                            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                                {composerImage ? "Change Image" : "Upload Image"}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreatePost}
                                    disabled={isSaving || !composerContent}
                                    className="w-full mt-5 py-3 bg-surface-secondary text-text-primary rounded-xl text-xs font-bold disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Post"}
                                </button>
                            </div>

                            <div className="w-full md:w-80 bg-surface-secondary p-6">
                                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">Preview</p>
                                <div className="bg-surface-base rounded-2xl overflow-hidden border border-border-subtle">
                                    {composerImage && <img src={composerImage} className="w-full aspect-video object-cover" alt="" />}
                                    <div className="p-3">
                                        <p className="text-xs text-text-secondary line-clamp-4">
                                            {composerContent || "Your post content..."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </VenuePageShell>
    );
}

// Helper Components
function QuickStat({ value, label, icon: Icon }: { value: number | string; label: string; icon: any }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-surface-elevated/10 rounded-xl">
                <Icon className="w-4 h-4 text-text-primary/60" />
            </div>
            <div>
                <p className="text-xl font-bold text-text-primary">{typeof value === 'number' ? formatNumber(value) : value}</p>
                <p className="text-[9px] font-bold text-text-primary/40 uppercase tracking-widest">{label}</p>
            </div>
        </div>
    );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon?: any }) {
    return (
        <div className="flex items-start gap-3">
            {Icon && (
                <div className="p-1.5 bg-surface-secondary rounded-lg">
                    <Icon className="w-3.5 h-3.5 text-text-tertiary" />
                </div>
            )}
            <div>
                <h3 className="text-sm font-bold text-text-primary">{title}</h3>
                <p className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</p>
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

    const inputClasses = "w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-border-strong transition-all";

    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">{label}</label>
            <div className="relative">
                {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />}
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
        <div className="bg-surface-secondary/50 rounded-2xl border border-border-subtle overflow-hidden group hover:border-border-strong transition-all">
            {post.imageUrl && (
                <div className="aspect-video w-full overflow-hidden">
                    <img src={post.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                </div>
            )}
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">
                        {formatDate(post.createdAt)}
                    </span>
                    <button onClick={onDelete} className="p-1 text-text-placeholder hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
                <p className="text-xs text-text-secondary line-clamp-3 mb-3">{post.content}</p>
                <div className="flex items-center gap-3 pt-2 mt-auto border-t border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-tertiary">
                        <Heart className="h-3 w-3" />
                        <span className="text-[10px] font-bold">{post.likes || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-tertiary">
                        <Eye className="h-3 w-3" />
                        <span className="text-[10px] font-bold">{post.views || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HighlightCard({ highlight, onDelete }: { highlight: any; onDelete: () => void }) {
    return (
        <div className="flex-shrink-0 group relative">
            <div className="w-24 h-24 rounded-full border-2 border-border-strong p-1 mb-3 transition-transform group-hover:scale-105">
                <div className="w-full h-full rounded-full bg-surface-secondary flex items-center justify-center" style={{ backgroundColor: `${highlight.color}15` }}>
                    <Camera className="w-6 h-6 text-text-tertiary" />
                </div>
            </div>
            <p className="text-[11px] font-bold text-text-secondary text-center truncate w-24">{highlight.title}</p>
            <button
                onClick={onDelete}
                className="absolute -top-1 -right-1 p-1.5 bg-surface-elevated rounded-full shadow-sm border border-border-subtle text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}

function VideoCard({ video, onDelete }: { video: any; onDelete: () => void }) {
    return (
        <div className="bg-surface-secondary/50 rounded-2xl border border-border-subtle overflow-hidden group hover:border-border-strong transition-all">
            <div className="aspect-video w-full bg-surface-secondary flex items-center justify-center relative">
                <Play className="w-12 h-12 text-text-primary/60" />
                <span className="absolute top-3 left-3 px-2 py-1 bg-black/50 rounded-lg text-[10px] font-bold text-text-primary uppercase tracking-widest">
                    {video.type}
                </span>
            </div>
            <div className="p-4 flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary truncate">{video.title}</p>
                <button onClick={onDelete} className="p-1.5 text-text-placeholder hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function EngagementStat({ label, value, change, positive }: { label: string; value: number | string; change: string; positive: boolean }) {
    return (
        <div className="p-3 bg-surface-secondary/50 rounded-xl border border-border-subtle">
            <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xl font-bold text-text-primary mb-0.5">{typeof value === 'number' ? formatNumber(value) : value}</p>
            <span className={`text-[9px] font-bold ${positive ? "text-emerald-500" : "text-red-500"}`}>{change}</span>
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
                className={`relative bg-surface-base rounded-3xl shadow-2xl border border-border-subtle overflow-hidden ${wide ? "w-full max-w-3xl" : "w-full max-w-md"}`}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-surface-secondary rounded-xl z-10">
                    <X className="w-5 h-5 text-text-tertiary" />
                </button>
                {children}
            </motion.div>
        </div>
    );
}
