"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, GripVertical, FileImage, Loader2, X, Eye } from "lucide-react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface MenuItem {
    id: string;
    imageUrl: string;
    title?: string;
    order: number;
}

interface MenuManagerProps {
    venueId: string;
    menuItems: MenuItem[];
    onRefresh: () => void;
}

export default function MenuManager({ venueId, menuItems, onRefresh }: MenuManagerProps) {
    const { user } = useDashboardAuth();
    const [uploading, setUploading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
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

    const handleUploadMenu = async (files: FileList) => {
        if (!user) return;
        setUploading(true);

        try {
            const storage = getFirebaseStorage();

            for (const file of Array.from(files)) {
                const storageRef = ref(storage, `venues/${venueId}/menu/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                await authedFetch("/api/venue/menu", {
                    method: "POST",
                    body: JSON.stringify({
                        venueId,
                        action: "add",
                        data: { imageUrl: downloadURL, title: file.name.split('.')[0] }
                    })
                });
            }
            onRefresh();
        } catch (err) {
            console.error("Upload menu error:", err);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveMenu = async (menuId: string) => {
        if (!window.confirm("Remove this menu page?")) return;

        try {
            await authedFetch("/api/venue/menu", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "remove",
                    data: { menuId }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Remove menu error:", err);
        }
    };

    const handleReorder = async (newOrder: MenuItem[]) => {
        try {
            await authedFetch("/api/venue/menu", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "reorder",
                    data: { orderedIds: newOrder.map(m => m.id) }
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
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Food & Drinks Menu</h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                        Upload menu images that guests can scroll through on your venue page
                    </p>
                </div>
                {menuItems.length > 0 && (
                    <button
                        onClick={() => {
                            setCurrentIndex(0);
                            setViewerOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-xl text-sm font-medium hover:bg-[var(--surface-elevated)] transition-all"
                    >
                        <Eye className="w-4 h-4" />
                        Preview Menu
                    </button>
                )}
            </div>

            {/* Upload Area */}
            <label className="block p-8 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all">
                <div className="flex flex-col items-center text-center">
                    {uploading ? (
                        <>
                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
                            <p className="text-sm text-[var(--text-secondary)]">Uploading menu pages...</p>
                        </>
                    ) : (
                        <>
                            <FileImage className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
                            <p className="text-sm font-medium text-[var(--text-primary)]">Drop menu images here or click to upload</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">You can upload multiple pages at once</p>
                        </>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) handleUploadMenu(e.target.files);
                    }}
                />
            </label>

            {/* Menu Pages List */}
            {menuItems.length > 0 && (
                <Reorder.Group
                    axis="y"
                    values={menuItems}
                    onReorder={handleReorder}
                    className="space-y-3"
                >
                    {menuItems.map((item, idx) => (
                        <Reorder.Item
                            key={item.id}
                            value={item}
                            className="flex items-center gap-4 p-3 bg-[var(--surface-secondary)] rounded-xl group cursor-grab active:cursor-grabbing"
                        >
                            <GripVertical className="w-5 h-5 text-[var(--text-tertiary)]" />

                            {/* Thumbnail */}
                            <div
                                className="w-20 h-28 rounded-lg overflow-hidden bg-[var(--surface-elevated)] shrink-0 cursor-pointer"
                                onClick={() => {
                                    setCurrentIndex(idx);
                                    setViewerOpen(true);
                                }}
                            >
                                <img
                                    src={item.imageUrl}
                                    className="w-full h-full object-cover"
                                    alt=""
                                />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                    Page {idx + 1}
                                </p>
                                <p className="text-xs text-[var(--text-tertiary)] truncate">
                                    {item.title || "Menu page"}
                                </p>
                            </div>

                            {/* Actions */}
                            <button
                                onClick={() => handleRemoveMenu(item.id)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )}

            {menuItems.length === 0 && (
                <div className="py-12 text-center bg-[var(--surface-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-subtle)]">
                    <FileImage className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                    <p className="text-[var(--text-tertiary)] font-medium">No menu uploaded yet</p>
                    <p className="text-[var(--text-tertiary)] text-sm mt-1">Upload your food & drinks menu above</p>
                </div>
            )}

            {/* Full Menu Viewer */}
            <AnimatePresence>
                {viewerOpen && menuItems.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 bg-black/50">
                            <p className="text-white font-medium">
                                Menu - Page {currentIndex + 1} of {menuItems.length}
                            </p>
                            <button
                                onClick={() => setViewerOpen(false)}
                                className="p-2 text-white/80 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Menu Image */}
                        <div className="flex-1 overflow-auto p-4">
                            <img
                                src={menuItems[currentIndex].imageUrl}
                                className="max-w-full h-auto mx-auto rounded-lg"
                                alt=""
                            />
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-center gap-4 p-4 bg-black/50">
                            <button
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                disabled={currentIndex === 0}
                                className="px-6 py-2 bg-white/10 text-white rounded-lg disabled:opacity-30"
                            >
                                Previous
                            </button>
                            <div className="flex gap-2">
                                {menuItems.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? "bg-white w-6" : "bg-white/40"
                                            }`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentIndex(Math.min(menuItems.length - 1, currentIndex + 1))}
                                disabled={currentIndex === menuItems.length - 1}
                                className="px-6 py-2 bg-white/10 text-white rounded-lg disabled:opacity-30"
                            >
                                Next
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
