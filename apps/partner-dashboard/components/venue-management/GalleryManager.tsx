"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, GripVertical, Image as ImageIcon, Loader2, X } from "lucide-react";
import { motion, Reorder } from "framer-motion";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { ErrorBoundary } from "@c1rcle/ui";

interface GalleryPhoto {
    id: string;
    imageUrl: string;
    caption?: string;
    order: number;
}

interface GalleryManagerProps {
    venueId: string;
    photos: GalleryPhoto[];
    onRefresh: () => void;
}

export default function GalleryManager({ venueId, photos, onRefresh }: GalleryManagerProps) {
    const { user } = useDashboardAuth();
    const [uploading, setUploading] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
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

    const handleUploadPhoto = async (file: File) => {
        if (!user) return;
        setUploading(true);

        try {
            const storage = getFirebaseStorage();
            const storageRef = ref(storage, `venues/${venueId}/gallery/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await authedFetch("/api/partners/venues/gallery", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "add",
                    data: { imageUrl: downloadURL }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Upload photo error:", err);
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = async (photoId: string) => {
        if (!window.confirm("Remove this photo from the gallery?")) return;

        try {
            await authedFetch("/api/partners/venues/gallery", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "remove",
                    data: { photoId }
                })
            });
            onRefresh();
        } catch (err) {
            console.error("Remove photo error:", err);
        }
    };

    const handleReorder = async (newOrder: GalleryPhoto[]) => {
        try {
            await authedFetch("/api/partners/venues/gallery", {
                method: "POST",
                body: JSON.stringify({
                    venueId,
                    action: "reorder",
                    data: { orderedIds: newOrder.map(p => p.id) }
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
                    <h3 className="text-lg font-bold text-text-primary">Vibe Gallery</h3>
                    <p className="text-sm text-text-tertiary">
                        Showcase your venue's atmosphere with up to 9 photos in a 3×3 grid
                    </p>
                </div>
                <div className="text-sm text-text-tertiary">
                    {photos.length} / 9 photos
                </div>
            </div>

            {/* Gallery Grid */}
            <ErrorBoundary>
                <div className="grid grid-cols-3 gap-4">
                    <Reorder.Group
                        axis="x"
                        values={photos}
                        onReorder={handleReorder}
                        className="contents"
                    >
                        {photos.map((photo) => (
                            <Reorder.Item
                                key={photo.id}
                                value={photo}
                                className="relative aspect-square rounded-2xl overflow-hidden group cursor-grab active:cursor-grabbing bg-surface-secondary"
                            >
                                <img
                                    src={photo.imageUrl}
                                    className="w-full h-full object-cover"
                                    alt=""
                                    onClick={() => setLightboxImage(photo.imageUrl)}
                                />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemovePhoto(photo.id);
                                        }}
                                        className="p-3 bg-red-500 text-text-primary rounded-full hover:bg-red-600 transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Drag Handle */}
                                <div className="absolute top-2 left-2 p-1.5 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4 text-text-primary" />
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    {/* Add Photo Slot */}
                    {photos.length < 9 && (
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-border-subtle flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all">
                            {uploading ? (
                                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-8 h-8 text-text-tertiary" />
                                    <span className="text-sm text-text-tertiary mt-2">Add Photo</span>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadPhoto(file);
                                }}
                            />
                        </label>
                    )}

                    {/* Empty Placeholders */}
                    {Array.from({ length: Math.max(0, 9 - photos.length - 1) }).map((_, idx) => (
                        <div
                            key={`placeholder-${idx}`}
                            className="aspect-square rounded-2xl bg-surface-secondary/30 border border-dashed border-border-subtle"
                        />
                    ))}
                </div>
            </ErrorBoundary>

            {/* Tips */}
            <div className="bg-surface-secondary/50 rounded-xl p-4">
                <p className="text-xs text-text-tertiary">
                    💡 <strong>Pro tip:</strong> Use high-quality photos that show your venue's vibe, decor,
                    crowd energy, and unique features. Drag to reorder photos.
                </p>
            </div>

            {/* Lightbox */}
            {lightboxImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-6 right-6 p-2 text-text-primary/80 hover:text-text-primary"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={lightboxImage}
                        className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
                        alt=""
                    />
                </motion.div>
            )}
        </div>
    );
}
