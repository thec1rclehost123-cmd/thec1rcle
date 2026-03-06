"use client";

import { useEffect, useState } from "react";
import {
    Layout,
    Image as ImageIcon,
    FileText,
    Sparkles,
    Plus,
    Trash2,
    Upload,
    Check,
    AlertCircle,
    Loader2,
    Eye,
    ThumbsUp,
    Camera,
    X,
    CheckCircle2,
    Instagram,
    Twitter,
    Globe,
    Mail,
    Phone,
    MapPin as MapPinIcon,
    Users
} from "lucide-react";
import Image from "next/image";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { AnimatePresence, motion } from "framer-motion";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRef } from "react";

const dateFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default function HostProfilePage() {
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
                localStorage.setItem(`host_post_draft_${profile?.activeMembership?.partnerId}`, JSON.stringify({ content: composerContent, image: composerImage }));
                setTimeout(() => setDraftStatus("saved"), 800);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [composerContent, composerImage, isComposerOpen]);

    // Load draft
    useEffect(() => {
        if (isComposerOpen) {
            const draft = localStorage.getItem(`host_post_draft_${profile?.activeMembership?.partnerId}`);
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
            const res = await fetch(`/api/profile?profileId=${partnerId}&type=host&stats=true`);
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
                    type: "host",
                    action: "updateProfile",
                    data: updates,
                    user: { uid: profile.uid, name: profile.displayName }
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
                    type: "host",
                    action: "createPost",
                    data: { content: composerContent, imageUrl: composerImage },
                    user: { uid: profile?.uid, name: profile?.displayName }
                })
            });
            localStorage.removeItem(`host_post_draft_${profile?.activeMembership?.partnerId}`);
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
        const color = window.prompt("Enter color (e.g., #4F46E5):", "#4F46E5");

        setIsSaving(true);
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "host",
                    action: "createHighlight",
                    data: { title, color: color || "#4F46E5" },
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
                        type: "host",
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
                        type: "host",
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
                <Loader2 className="h-10 w-10 text-text-placeholder animate-spin mb-4" />
                <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">Syncing Public Presence...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-default pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-text-primary tracking-tight flex items-center gap-4 uppercase">
                        Public Page
                    </h1>
                    <p className="text-text-tertiary text-lg font-medium mt-3">Curate how your host profile appears to guests and potential partners.</p>
                </div>
                <div className="flex items-center gap-4">
                    {data?.profile?.slug && (
                        <a
                            href={`/host/${data.profile.slug}`}
                            target="_blank"
                            className="flex items-center gap-2 px-6 py-4 bg-surface-tertiary text-text-tertiary rounded-2xl text-[10px] font-black uppercase tracking-widest border border-border-default hover:bg-surface-secondary transition-all group"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 group-hover:animate-pulse" />
                            Live on Website
                        </a>
                    )}
                    <button
                        onClick={() => handleUpdateProfile({})}
                        disabled={isSaving}
                        className="flex items-center gap-3 px-8 py-4 bg-surface-secondary text-text-primary rounded-2xl text-sm font-bold shadow-xl hover:bg-surface-tertiary transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-surface-elevated p-8 rounded-[2.5rem] border border-border-default shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Followers</p>
                    <p className="text-4xl font-black text-text-primary">{data?.stats?.followersCount || 0}</p>
                </div>
                <div className="bg-surface-elevated p-8 rounded-[2.5rem] border border-border-default shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Posts</p>
                    <p className="text-4xl font-black text-text-primary">{data?.stats?.postsCount || 0}</p>
                </div>
                <div className="bg-surface-elevated p-8 rounded-[2.5rem] border border-border-default shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Total Highs</p>
                    <p className="text-4xl font-black text-text-primary">{data?.stats?.totalLikes || 0}</p>
                </div>
                <div className="bg-surface-elevated p-8 rounded-[2.5rem] border border-border-default shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Page Views</p>
                    <p className="text-4xl font-black text-text-primary">{data?.stats?.totalViews || 0}</p>
                </div>
            </div>

            {/* Main Editor */}
            <div className="bg-surface-elevated rounded-[2.5rem] border border-border-default shadow-sm overflow-hidden min-h-[600px]">
                <div className="flex border-b border-border-subtle bg-surface-tertiary/30">
                    <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")} icon={Layout} label="Core Details" />
                    <TabButton active={activeTab === "posts"} onClick={() => setActiveTab("posts")} icon={FileText} label="Posts & Updates" />
                    <TabButton active={activeTab === "highlights"} onClick={() => setActiveTab("highlights")} icon={Camera} label="Highlights" />
                    <TabButton active={activeTab === "followers"} onClick={() => setActiveTab("followers")} icon={Users} label="Followers" />
                </div>

                <div className="p-10">
                    {activeTab === "details" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-4 ml-1">Identity & Branding</label>
                                    <input
                                        type="text"
                                        defaultValue={data?.profile?.displayName}
                                        onBlur={(e) => handleUpdateProfile({ displayName: e.target.value })}
                                        className="w-full p-6 bg-surface-tertiary border border-border-default rounded-3xl text-sm font-bold focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all"
                                        placeholder="Stage Name / Organization"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-4 ml-1">The Narrative (Bio)</label>
                                    <textarea
                                        defaultValue={data?.profile?.bio}
                                        onBlur={(e) => handleUpdateProfile({ bio: e.target.value })}
                                        className="w-full p-6 bg-surface-tertiary border border-border-default rounded-3xl text-sm font-medium focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all min-h-[200px]"
                                        placeholder="Tell your story..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-4 ml-1">Visual Assets</label>
                                <div className="grid grid-cols-2 gap-6">
                                    <div
                                        onClick={() => { setPhotoModal({ field: "photoURL", currentUrl: data?.profile?.photoURL }); setPhotoInputUrl(data?.profile?.photoURL || ""); }}
                                        className="aspect-square bg-surface-tertiary rounded-[2rem] border-2 border-dashed border-border-default flex flex-col items-center justify-center p-6 text-center group hover:border-indigo-400 transition-all cursor-pointer overflow-hidden relative"
                                    >
                                        {data?.profile?.photoURL ? (
                                            <Image src={data.profile.photoURL} fill className="object-cover grayscale hover:grayscale-0 transition-all" alt="" sizes="(max-width: 768px) 100vw, 50vw" />
                                        ) : (
                                            <>
                                                <div className="h-12 w-12 rounded-2xl bg-surface-elevated shadow-sm flex items-center justify-center mb-4 text-text-tertiary group-hover:text-indigo-600">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Profile Image</p>
                                            </>
                                        )}
                                    </div>
                                    <div
                                        onClick={() => { setPhotoModal({ field: "coverURL", currentUrl: data?.profile?.coverURL }); setPhotoInputUrl(data?.profile?.coverURL || ""); }}
                                        className="aspect-square bg-surface-tertiary rounded-[2rem] border-2 border-dashed border-border-default flex flex-col items-center justify-center p-6 text-center group hover:border-emerald-400 transition-all cursor-pointer overflow-hidden relative"
                                    >
                                        {data?.profile?.coverURL ? (
                                            <Image src={data.profile.coverURL} fill className="object-cover grayscale hover:grayscale-0 transition-all" alt="" sizes="(max-width: 768px) 100vw, 50vw" />
                                        ) : (
                                            <>
                                                <div className="h-12 w-12 rounded-2xl bg-surface-elevated shadow-sm flex items-center justify-center mb-4 text-text-tertiary group-hover:text-emerald-600">
                                                    <ImageIcon className="h-6 w-6" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Cover Card</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Social & Contact Section */}
                            <div className="col-span-full space-y-8 pt-10 border-t border-border-subtle">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Social & Contact Presence</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-bold text-text-secondary ml-1">Instagram (@handle)</label>
                                        <div className="relative">
                                            <Instagram className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-placeholder" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.socialLinks?.instagram}
                                                onBlur={(e) => handleUpdateProfile({ socialLinks: { ...data?.profile?.socialLinks, instagram: e.target.value } })}
                                                className="w-full pl-16 pr-6 py-5 bg-surface-tertiary border border-border-default rounded-3xl text-sm font-bold focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                                placeholder="my_handle"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-bold text-text-secondary ml-1">Website URL</label>
                                        <div className="relative">
                                            <Globe className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-placeholder" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.website}
                                                onBlur={(e) => handleUpdateProfile({ website: e.target.value })}
                                                className="w-full pl-16 pr-6 py-5 bg-surface-tertiary border border-border-default rounded-3xl text-sm font-bold focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                                placeholder="https://mysite.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-bold text-text-secondary ml-1">Official Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-placeholder" />
                                            <input
                                                type="email"
                                                defaultValue={data?.profile?.email}
                                                onBlur={(e) => handleUpdateProfile({ email: e.target.value })}
                                                className="w-full pl-16 pr-6 py-5 bg-surface-tertiary border border-border-default rounded-3xl text-sm font-bold focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                                placeholder="contact@host.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-bold text-text-secondary ml-1">Location / Base City</label>
                                        <div className="relative">
                                            <MapPinIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-placeholder" />
                                            <input
                                                type="text"
                                                defaultValue={data?.profile?.city}
                                                onBlur={(e) => handleUpdateProfile({ city: e.target.value })}
                                                className="w-full pl-16 pr-6 py-5 bg-surface-tertiary border border-border-default rounded-3xl text-sm font-bold focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                                placeholder="Bangalore, India"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Photos Gallery Section */}
                            <div className="col-span-full space-y-8 pt-10 border-t border-border-subtle">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Media Gallery</h3>
                                    <button
                                        onClick={() => { setPhotoModal({ field: "photos", currentUrl: "" }); setPhotoInputUrl(""); }}
                                        className="px-6 py-3 bg-surface-secondary text-text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-tertiary transition-all"
                                    >
                                        Add Media
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {data?.profile?.photos?.map((photo: string, idx: number) => (
                                        <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden border border-border-subtle group">
                                            <Image src={photo} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" sizes="(max-width: 768px) 50vw, 20vw" />
                                            <button
                                                onClick={async () => {
                                                    const newPhotos = data.profile.photos.filter((p: string) => p !== photo);
                                                    handleUpdateProfile({ photos: newPhotos });
                                                }}
                                                className="absolute top-4 right-4 p-2 bg-surface-elevated/80 backdrop-blur-md rounded-xl text-rose-500 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-rose-500 hover:text-text-primary"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {(!data?.profile?.photos || data.profile.photos.length === 0) && (
                                        <div className="col-span-full py-20 text-center bg-surface-tertiary rounded-[3rem] border-2 border-dashed border-border-subtle">
                                            <p className="text-text-tertiary text-sm font-medium">No gallery media added yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "posts" && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between bg-indigo-900 rounded-3xl p-8 text-text-primary shadow-xl shadow-indigo-100">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Timeline Updates</h3>
                                    <p className="text-text-primary/60 text-xs font-bold mt-1 uppercase tracking-widest">Share news, lineups, or limited drops.</p>
                                </div>
                                <button
                                    onClick={() => setIsComposerOpen(true)}
                                    className="px-8 py-3 bg-surface-elevated text-indigo-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-900/20"
                                >
                                    New Post
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {data?.posts?.map((post: any) => (
                                    <div key={post.id} className="p-0 bg-surface-tertiary rounded-3xl border border-border-subtle group relative overflow-hidden transition-all hover:shadow-md">
                                        {post.imageUrl && (
                                            <div className="relative aspect-video w-full overflow-hidden border-b border-border-subtle">
                                                <Image src={post.imageUrl} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" sizes="(max-width: 768px) 100vw, 50vw" />
                                            </div>
                                        )}
                                        <div className="p-8">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                                                    {post.createdAt ? dateFormatter.format(new Date(post.createdAt)) : 'Recently'}
                                                </span>
                                                <button
                                                    onClick={() => handleDeletePost(post.id)}
                                                    className="p-2 text-text-placeholder hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <p className="text-sm font-medium text-text-secondary leading-relaxed mb-6">{post.content}</p>
                                            <div className="flex items-center gap-6 pt-4 border-t border-border-subtle">
                                                <div className="flex items-center gap-2 text-text-tertiary">
                                                    <ThumbsUp className="h-4 w-4" />
                                                    <span className="text-[10px] font-bold">{post.likes || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-text-tertiary">
                                                    <Eye className="h-4 w-4" />
                                                    <span className="text-[10px] font-bold">{post.views || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "highlights" && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between bg-surface-secondary rounded-3xl p-8 text-text-primary shadow-xl shadow-slate-200">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Moment Vault</h3>
                                    <p className="text-text-primary/60 text-xs font-bold mt-1 uppercase tracking-widest">Pin your best performance reels to the top.</p>
                                </div>
                                <button
                                    onClick={handleCreateHighlight}
                                    className="px-8 py-3 bg-surface-elevated text-text-primary rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                                >
                                    New Highlight
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {data?.highlights?.map((h: any) => (
                                    <div key={h.id} className="group relative">
                                        <div
                                            className="aspect-square rounded-[2rem] border-2 border-border-subtle flex items-center justify-center transition-all group-hover:scale-110 shadow-sm overflow-hidden"
                                            style={{ backgroundColor: `${h.color}10` }}
                                        >
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center text-text-primary shadow-lg"
                                                style={{ backgroundColor: h.color }}
                                            >
                                                <Camera className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <p className="text-center mt-3 text-[10px] font-black uppercase tracking-widest text-text-tertiary">{h.title}</p>
                                        <button
                                            onClick={() => handleDeleteHighlight(h.id)}
                                            className="absolute -top-2 -right-2 p-2 bg-surface-elevated rounded-full shadow-lg border border-border-subtle text-rose-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {(!data?.highlights || data.highlights.length === 0) && (
                                <div className="flex flex-col items-center justify-center py-20 bg-surface-tertiary/50 rounded-[3rem] border-2 border-dashed border-border-subtle">
                                    <p className="text-text-tertiary text-sm font-medium">No highlights yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "followers" && (
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-text-primary border-b border-border-subtle pb-6">Your Community</h3>
                                <p className="text-text-tertiary text-sm font-medium mt-6">Engage with the {data?.stats?.followersCount || 0} guests following your journey.</p>
                            </div>

                            <div className="bg-surface-tertiary rounded-[3rem] border border-border-default p-24 text-center">
                                <Users className="w-16 h-16 text-text-placeholder mx-auto mb-8" />
                                <h4 className="text-lg font-black text-text-primary mb-3 uppercase tracking-tight">Host Insights Incoming</h4>
                                <p className="text-text-tertiary max-w-sm mx-auto font-medium">We're building advanced audience analytics for our top hosts. Stay tuned.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Photo Edit Modal (consistent with Venue) */}
            <AnimatePresence>
                {photoModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPhotoModal(null)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-surface-elevated rounded-[2.5rem] shadow-2xl overflow-hidden border border-border-default p-10"
                        >
                            <div className="mb-8">
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Update Visuals</h3>
                                <p className="text-text-tertiary text-[10px] font-black uppercase tracking-widest mt-1">Specify {photoModal.field === 'photos' ? 'gallery' : photoModal.field} source URL</p>
                            </div>

                            <div className="space-y-8">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, "modal")}
                                />

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full aspect-square md:aspect-video rounded-[3rem] bg-surface-tertiary border-4 border-dashed border-border-subtle flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-surface-secondary hover:border-border-default transition-all group overflow-hidden relative"
                                >
                                    {photoInputUrl ? (
                                        <Image src={photoInputUrl} fill className="object-cover" alt="Preview" sizes="(max-width: 768px) 100vw, 50vw" />
                                    ) : (
                                        <>
                                            <div className="p-6 md:p-8 bg-surface-elevated rounded-full shadow-2xl group-hover:scale-110 transition-transform">
                                                <Upload className="w-8 h-8 text-indigo-600" />
                                            </div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-text-tertiary text-center px-12 leading-relaxed">
                                                Tap to select and upload straight from device
                                            </p>
                                        </>
                                    )}
                                    {isSaving && (
                                        <div className="absolute inset-0 bg-surface-elevated/60 backdrop-blur-md flex items-center justify-center">
                                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={() => setPhotoModal(null)}
                                        className="flex-1 py-5 bg-surface-secondary text-text-tertiary rounded-3xl text-xs font-black uppercase tracking-widest hover:bg-surface-tertiary transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Post Composer Modal */}
            <AnimatePresence>
                {isComposerOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-24">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsComposerOpen(false)}
                            className="absolute inset-0 bg-indigo-900/40 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 40, scale: 0.95 }}
                            className="relative w-full max-w-4xl bg-surface-elevated rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[70vh] max-h-[800px]"
                        >
                            {/* Editor Section */}
                            <div className="flex-1 flex flex-col border-r border-border-subtle">
                                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                    <h2 className="text-lg font-black uppercase tracking-tight">Post Update</h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-placeholder">
                                            {draftStatus === "saving" ? "Saving..." : draftStatus === "saved" ? "Draft Saved" : ""}
                                        </span>
                                        <button onClick={() => setIsComposerOpen(false)} className="p-2 hover:bg-surface-tertiary rounded-full transition-colors">
                                            <X className="h-5 w-5 text-text-tertiary" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-10 space-y-8">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Narrative</label>
                                        <textarea
                                            value={composerContent}
                                            onChange={(e) => setComposerContent(e.target.value)}
                                            placeholder="Announce your next move..."
                                            className="w-full h-40 bg-surface-tertiary p-6 rounded-3xl text-sm font-medium focus:bg-surface-elevated focus:ring-4 focus:ring-indigo-50 transition-all border border-border-subtle"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Visual Media</label>
                                        <input
                                            type="file"
                                            ref={composerFileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, "composer")}
                                        />
                                        <button
                                            onClick={() => composerFileInputRef.current?.click()}
                                            className="w-full py-16 border-4 border-dashed border-slate-50 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-surface-tertiary/50 transition-all group"
                                        >
                                            <div className="p-4 bg-surface-tertiary rounded-full group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                                                {composerImage ? "Change Media Asset" : "Upload Direct from Device"}
                                            </p>
                                        </button>
                                    </div>
                                </div>
                                <div className="p-8 border-t border-slate-50 bg-surface-tertiary/50">
                                    <button
                                        onClick={handleCreatePost}
                                        disabled={isSaving || !composerContent}
                                        className="w-full py-5 bg-indigo-600 text-text-primary rounded-3xl text-xs font-black uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Share with Community"}
                                    </button>
                                </div>
                            </div>

                            {/* Preview Section */}
                            <div className="w-full md:w-[380px] bg-surface-tertiary p-10 flex flex-col">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-8">Page Preview</label>
                                <div className="flex-1 flex flex-center items-center">
                                    <div className="w-full bg-surface-elevated rounded-[2.5rem] shadow-xl border border-border-default overflow-hidden group">
                                        {composerImage ? (
                                            <div className="relative aspect-square w-full">
                                                <Image src={composerImage} fill className="object-cover" alt="" sizes="(max-width: 768px) 100vw, 50vw" />
                                            </div>
                                        ) : (
                                            <div className="aspect-square w-full bg-surface-secondary flex items-center justify-center">
                                                <ImageIcon className="h-8 w-8 text-text-placeholder" />
                                            </div>
                                        )}
                                        <div className="p-8 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-6 w-6 rounded-lg bg-indigo-600" />
                                                <div className="h-2 w-20 bg-surface-secondary rounded-full" />
                                            </div>
                                            <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                                                {composerContent || "Your message will appear here..."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-8 text-center text-[10px] font-bold text-text-tertiary uppercase tracking-widest leading-relaxed">
                                    Post will appear in your timeline instantly.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TabButton({ active, icon: Icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-6 flex flex-col items-center gap-2 border-b-2 transition-all ${active
                ? "border-slate-900 bg-surface-elevated"
                : "border-transparent text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary/50"
                }`}
        >
            <Icon className={`h-5 w-5 ${active ? "text-text-primary" : "text-text-placeholder"}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}
