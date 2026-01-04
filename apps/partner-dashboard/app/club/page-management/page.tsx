"use client";

import { useState } from "react";
import {
    Plus,
    Image as ImageIcon,
    Video,
    Heart,
    MessageCircle,
    Eye,
    MoreHorizontal,
    Upload,
    X,
    TrendingUp,
    Users,
    Calendar
} from "lucide-react";

interface Post {
    id: string;
    type: "photo" | "video" | "story";
    url: string;
    caption: string;
    likes: number;
    comments: number;
    views: number;
    createdAt: Date;
}

const MOCK_POSTS: Post[] = [
    { id: "1", type: "photo", url: "/api/placeholder/400/400", caption: "Vibes from last night 🔥", likes: 1240, comments: 45, views: 5600, createdAt: new Date(2026, 0, 1) },
    { id: "2", type: "video", url: "/api/placeholder/400/400", caption: "Weekend madness", likes: 2100, comments: 89, views: 12400, createdAt: new Date(2025, 11, 30) },
    { id: "3", type: "story", url: "/api/placeholder/400/400", caption: "", likes: 890, comments: 12, views: 3200, createdAt: new Date(2025, 11, 29) },
];

export default function ClubPageManagementPage() {
    const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Club Page Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Manage your public venue page - posts, highlights, and stories
                    </p>
                </div>
                <button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    Upload Content
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-pink-50 rounded-lg">
                        <Heart className="h-6 w-6 text-pink-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Total Likes
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                            {(totalLikes / 1000).toFixed(1)}K
                        </p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <Eye className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Total Views
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                            {(totalViews / 1000).toFixed(1)}K
                        </p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                        <MessageCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Comments
                        </p>
                        <p className="text-2xl font-bold text-slate-900">{totalComments}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-lg">
                        <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Followers
                        </p>
                        <p className="text-2xl font-bold text-slate-900">12.4K</p>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-900">All Content</h2>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-indigo-700">
                            All
                        </button>
                        <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold uppercase hover:bg-slate-100 border border-slate-200">
                            Photos
                        </button>
                        <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold uppercase hover:bg-slate-100 border border-slate-200">
                            Videos
                        </button>
                        <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold uppercase hover:bg-slate-100 border border-slate-200">
                            Stories
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {posts.map((post) => (
                        <div
                            key={post.id}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer"
                        >
                            {/* Preview Image */}
                            <img
                                src={post.url}
                                alt={post.caption}
                                className="w-full h-full object-cover"
                            />

                            {/* Type Badge */}
                            {post.type === "video" && (
                                <div className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full">
                                    <Video className="h-4 w-4 text-white" />
                                </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-4 text-white text-xs font-semibold">
                                        <div className="flex items-center gap-1">
                                            <Heart className="h-4 w-4" />
                                            {post.likes}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MessageCircle className="h-4 w-4" />
                                            {post.comments}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Eye className="h-4 w-4" />
                                            {(post.views / 1000).toFixed(1)}K
                                        </div>
                                    </div>

                                    {post.caption && (
                                        <p className="text-white text-xs line-clamp-2">{post.caption}</p>
                                    )}
                                </div>

                                <button className="absolute top-2 left-2 p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors">
                                    <MoreHorizontal className="h-4 w-4 text-white" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Upload Button */}
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600"
                    >
                        <Upload className="h-8 w-8" />
                        <span className="text-xs font-bold uppercase">Upload</span>
                    </button>
                </div>
            </div>

            {/* Upload Modal */}
            {isUploadOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsUploadOpen(false)} />

                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Upload New Content</h3>
                            <button onClick={() => setIsUploadOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer">
                                <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                                <p className="text-sm font-semibold text-slate-700 mb-1">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs text-slate-500">
                                    JPG, PNG, MP4 (max 50MB)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Type
                                </label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <option>Photo/Video Post</option>
                                    <option>Story (24h highlight)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Caption
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg resize-none"
                                    placeholder="Add a caption..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button className="flex-1 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                                Post Content
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
