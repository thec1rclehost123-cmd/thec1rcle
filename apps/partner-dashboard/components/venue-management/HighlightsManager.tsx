"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, GripVertical, Image as ImageIcon, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface Highlight {
    id: string;
    title: string;
    coverImage: string;
    images: string[];
    order: number;
    isActive: boolean;
}

interface HighlightsManagerProps {
    venueId: string;
    highlights: Highlight[];
    onRefresh: () => void;
}

export default function HighlightsManager({ venueId, highlights, onRefresh }: HighlightsManagerProps) {
    const { user } = useDashboardAuth();
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [previewHighlight, setPreviewHighlight] = useState<Highlight | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken();
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
    }, [user]);

    const handleCreateHighlight = async () => {
        if (!newTitle.trim() || !user) return;
        setIsCreating(true);

        try {
            await authedFetch("/api/venue/highlights", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "create",
                    data: { title: newTitle.trim(), images: [] }
                })
            });
            setNewTitle("");
            onRefresh();
        } catch (err) {
            console.error("Create highlight error:", err);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteHighlight = async (highlightId: string) => {
        if (!window.confirm("Delete this highlight? This cannot be undone.")) return;

        try {
            await authedFetch("/api/venue/highlights", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "delete",
                    data: { highlightId }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Delete highlight error:", err);
        }
    };

    const handleUpdateTitle = async (highlightId: string, title: string) => {
        try {
            await authedFetch("/api/venue/highlights", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "update",
                    data: { highlightId, updates: { title } }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Update title error:", err);
        }
    };

    const handleUploadImage = async (highlightId: string, file: File) => {
        if (!user) return;
        setUploading(highlightId);

        try {
            const storage = getFirebaseStorage();
            const storageRef = ref(storage, `venues/${venueId}/highlights/${highlightId}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await authedFetch("/api/venue/highlights", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "addImage",
                    data: { highlightId, imageUrl: downloadURL }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Upload image error:", err);
        } finally {
            setUploading(null);
        }
    };

    const handleRemoveImage = async (highlightId: string, imageUrl: string) => {
        try {
            await authedFetch("/api/venue/highlights", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "removeImage",
                    data: { highlightId, imageUrl }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Remove image error:", err);
        }
    };

    const handleReorderHighlights = async (newOrder: Highlight[]) => {
        try {
            await authedFetch("/api/venue/highlights", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "reorder",
                    data: { orderedIds: newOrder.map(h => h.id) }
                })
            });
        } catch (err) {
            console.error("Reorder error:", err);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Story Highlights</h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                        Create Instagram-style story highlights. Each highlight can have up to 9 images.
                    </p>
                </div>
            </div>

            {/* Create New Highlight */}
            <div className="flex gap-3">
                <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="New highlight title (e.g., Saturday Night, Rooftop Vibes)"
                    className="flex-1 px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateHighlight()}
                />
                <button
                    onClick={handleCreateHighlight}
                    disabled={!newTitle.trim() || isCreating}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                </button>
            </div>

            {/* Highlights List */}
            {highlights.length === 0 ? (
                <div className="py-16 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                    <ImageIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                    <p className="text-[var(--text-tertiary)] font-medium">No highlights yet</p>
                    <p className="text-[var(--text-tertiary)] text-sm mt-1">Create your first story highlight above</p>
                </div>
            ) : (
                <Reorder.Group
                    axis="y"
                    values={highlights}
                    onReorder={(newOrder) => {
                        handleReorderHighlights(newOrder);
                    }}
                    className="space-y-4"
                >
                    {highlights.map((highlight) => (
                        <Reorder.Item
                            key={highlight.id}
                            value={highlight}
                            className="bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden"
                        >
                            {/* Highlight Header */}
                            <div className="flex items-center gap-4 p-4">
                                <GripVertical className="w-5 h-5 text-[var(--text-tertiary)] cursor-grab" />

                                {/* Cover Image */}
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-0.5 shrink-0">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-[var(--surface-primary)]">
                                        {highlight.coverImage ? (
                                            <img
                                                src={highlight.coverImage}
                                                className="w-full h-full object-cover cursor-pointer"
                                                alt=""
                                                onClick={() => {
                                                    if (highlight.images.length > 0) {
                                                        setPreviewHighlight(highlight);
                                                        setPreviewIndex(0);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-6 h-6 text-[var(--text-tertiary)]" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="flex-1 min-w-0">
                                    <input
                                        defaultValue={highlight.title}
                                        onBlur={(e) => {
                                            if (e.target.value !== highlight.title) {
                                                handleUpdateTitle(highlight.id, e.target.value);
                                            }
                                        }}
                                        className="text-base font-bold text-[var(--text-primary)] bg-transparent border-none outline-none w-full"
                                    />
                                    <p className="text-xs text-[var(--text-tertiary)]">
                                        {highlight.images.length} / 9 images
                                    </p>
                                </div>

                                {/* Actions */}
                                <button
                                    onClick={() => setExpandedId(expandedId === highlight.id ? null : highlight.id)}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    {expandedId === highlight.id ? "Collapse" : "Manage Images"}
                                </button>
                                <button
                                    onClick={() => handleDeleteHighlight(highlight.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Expanded Image Manager */}
                            <AnimatePresence>
                                {expandedId === highlight.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-[var(--border-subtle)]"
                                    >
                                        <div className="p-4 space-y-4">
                                            {/* Image Grid */}
                                            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                                                {highlight.images.map((imageUrl, idx) => (
                                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                                                        <img
                                                            src={imageUrl}
                                                            className="w-full h-full object-cover"
                                                            alt=""
                                                        />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button
                                                                onClick={() => handleRemoveImage(highlight.id, imageUrl)}
                                                                className="p-2 bg-red-500 text-white rounded-full"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        <div className="absolute top-2 left-2 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                                                            {idx + 1}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Add Image Button */}
                                                {highlight.images.length < 9 && (
                                                    <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all">
                                                        {uploading === highlight.id ? (
                                                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Plus className="w-6 h-6 text-[var(--text-tertiary)]" />
                                                                <span className="text-[10px] text-[var(--text-tertiary)] mt-1">Add</span>
                                                            </>
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleUploadImage(highlight.id, file);
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            <p className="text-xs text-[var(--text-tertiary)]">
                                                💡 Tip: Images will auto-advance like Instagram stories when users tap the highlight
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )}

            {/* Story Preview Modal */}
            <AnimatePresence>
                {previewHighlight && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
                        onClick={() => setPreviewHighlight(null)}
                    >
                        <button
                            onClick={() => setPreviewHighlight(null)}
                            className="absolute top-6 right-6 p-2 text-white/80 hover:text-white z-10"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        {/* Progress Bar */}
                        <div className="absolute top-4 left-4 right-4 flex gap-1">
                            {previewHighlight.images.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`flex-1 h-1 rounded-full ${idx === previewIndex ? "bg-white" : "bg-white/30"}`}
                                />
                            ))}
                        </div>

                        {/* Image */}
                        <img
                            src={previewHighlight.images[previewIndex]}
                            className="max-h-[80vh] max-w-[90vw] object-contain"
                            alt=""
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Navigation */}
                        {previewIndex > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewIndex(previewIndex - 1);
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20"
                            >
                                <ChevronLeft className="w-6 h-6 text-white" />
                            </button>
                        )}
                        {previewIndex < previewHighlight.images.length - 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewIndex(previewIndex + 1);
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20"
                            >
                                <ChevronRight className="w-6 h-6 text-white" />
                            </button>
                        )}

                        {/* Title */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
                            <p className="text-white font-bold text-lg">{previewHighlight.title}</p>
                            <p className="text-white/60 text-sm">{previewIndex + 1} / {previewHighlight.images.length}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
