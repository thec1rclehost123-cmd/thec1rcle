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
    Camera
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function HostProfilePage() {
    const { profile } = useDashboardAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"details" | "posts" | "highlights">("details");

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
        const content = window.prompt("Enter post content:");
        if (!content) return;
        setIsSaving(true);
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "host",
                    action: "createPost",
                    data: { content },
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

    const handleUpdatePhoto = async (field: string) => {
        const url = window.prompt(`Enter ${field} image URL:`);
        if (!url) return;
        setIsSaving(true);
        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: profile?.activeMembership?.partnerId,
                    type: "host",
                    action: "addPhoto",
                    data: { field, url },
                    user: { uid: profile?.uid }
                })
            });
            fetchProfileData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Public Presence...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4 uppercase">
                        Public Page
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3">Curate how your host profile appears to guests and potential partners.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => handleUpdateProfile({})}
                        disabled={isSaving}
                        className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Followers</p>
                    <p className="text-4xl font-black text-slate-900">{data?.stats?.followersCount || 0}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Posts</p>
                    <p className="text-4xl font-black text-slate-900">{data?.stats?.postsCount || 0}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Highs</p>
                    <p className="text-4xl font-black text-slate-900">{data?.stats?.totalLikes || 0}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Page Views</p>
                    <p className="text-4xl font-black text-slate-900">{data?.stats?.totalViews || 0}</p>
                </div>
            </div>

            {/* Main Editor */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                <div className="flex border-b border-slate-100 bg-slate-50/30">
                    <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")} icon={Layout} label="Core Details" />
                    <TabButton active={activeTab === "posts"} onClick={() => setActiveTab("posts")} icon={FileText} label="Posts & Updates" />
                    <TabButton active={activeTab === "highlights"} onClick={() => setActiveTab("highlights")} icon={Camera} label="Highlights" />
                </div>

                <div className="p-10">
                    {activeTab === "details" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Identity & Branding</label>
                                    <input
                                        type="text"
                                        defaultValue={data?.profile?.displayName}
                                        onBlur={(e) => handleUpdateProfile({ displayName: e.target.value })}
                                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                        placeholder="Stage Name / Organization"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">The Narrative (Bio)</label>
                                    <textarea
                                        defaultValue={data?.profile?.bio}
                                        onBlur={(e) => handleUpdateProfile({ bio: e.target.value })}
                                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all min-h-[200px]"
                                        placeholder="Tell your story..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Visual Assets</label>
                                <div className="grid grid-cols-2 gap-6">
                                    <div
                                        onClick={() => handleUpdatePhoto("photoURL")}
                                        className="aspect-square bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center group hover:border-indigo-400 transition-all cursor-pointer overflow-hidden relative"
                                    >
                                        {data?.profile?.photoURL ? (
                                            <img src={data.profile.photoURL} className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all" alt="" />
                                        ) : (
                                            <>
                                                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-slate-400 group-hover:text-indigo-600">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profile Image</p>
                                            </>
                                        )}
                                    </div>
                                    <div
                                        onClick={() => handleUpdatePhoto("coverURL")}
                                        className="aspect-square bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center group hover:border-emerald-400 transition-all cursor-pointer overflow-hidden relative"
                                    >
                                        {data?.profile?.coverURL ? (
                                            <img src={data.profile.coverURL} className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all" alt="" />
                                        ) : (
                                            <>
                                                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-slate-400 group-hover:text-emerald-600">
                                                    <ImageIcon className="h-6 w-6" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cover Card</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "posts" && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between bg-indigo-900 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Timeline Updates</h3>
                                    <p className="text-white/60 text-xs font-bold mt-1 uppercase tracking-widest">Share news, lineups, or limited drops.</p>
                                </div>
                                <button
                                    onClick={handleCreatePost}
                                    className="px-8 py-3 bg-white text-indigo-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-900/20"
                                >
                                    New Post
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {data?.posts?.map((post: any) => (
                                    <div key={post.id} className="p-8 bg-slate-50 rounded-3xl border border-slate-100 group relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {new Date(post.createdAt).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={() => handleDeletePost(post.id)}
                                                className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed mb-6">{post.content}</p>
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <ThumbsUp className="h-4 w-4" />
                                                <span className="text-[10px] font-bold">{post.likes || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Eye className="h-4 w-4" />
                                                <span className="text-[10px] font-bold">{post.views || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "highlights" && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Moment Vault</h3>
                                    <p className="text-white/60 text-xs font-bold mt-1 uppercase tracking-widest">Pin your best performance reels to the top.</p>
                                </div>
                                <button
                                    onClick={handleCreateHighlight}
                                    className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                                >
                                    New Highlight
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {data?.highlights?.map((h: any) => (
                                    <div key={h.id} className="group relative">
                                        <div
                                            className="aspect-square rounded-[2rem] border-2 border-slate-100 flex items-center justify-center transition-all group-hover:scale-110 shadow-sm overflow-hidden"
                                            style={{ backgroundColor: `${h.color}10` }}
                                        >
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                                                style={{ backgroundColor: h.color }}
                                            >
                                                <Camera className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <p className="text-center mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h.title}</p>
                                        <button
                                            onClick={() => handleDeleteHighlight(h.id)}
                                            className="absolute -top-2 -right-2 p-2 bg-white rounded-full shadow-lg border border-slate-100 text-rose-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {(!data?.highlights || data.highlights.length === 0) && (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                                    <p className="text-slate-400 text-sm font-medium">No highlights yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, icon: Icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-6 flex flex-col items-center gap-2 border-b-2 transition-all ${active
                ? "border-slate-900 bg-white"
                : "border-transparent text-slate-400 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
        >
            <Icon className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-300"}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}
