"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./providers/AuthProvider";
import { getFirebaseStorage } from "../lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Image from "next/image";
import Cropper from "react-easy-crop";

export default function EditProfileModal({ open, onClose }) {
    const { profile, updateUserProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [error, setError] = useState("");
    const [imagePreview, setImagePreview] = useState(profile?.photoURL || "");
    const [cropperOpen, setCropperOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({
        displayName: profile?.displayName || "",
        instagram: profile?.instagram || "",
        photoURL: profile?.photoURL || "",
        city: profile?.city || ""
    });

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url) =>
        new Promise((resolve, reject) => {
            const image = new window.Image();
            image.addEventListener("load", () => resolve(image));
            image.addEventListener("error", (error) => reject(error));
            image.setAttribute("crossOrigin", "anonymous");
            image.src = url;
        });

    const getCroppedImg = async (imageSrc, pixelCrop) => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, "image/jpeg", 0.95);
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file (JPG, PNG, GIF, etc.)");
            return;
        }

        // Validate file size (max 10MB before crop)
        if (file.size > 10 * 1024 * 1024) {
            setError("Image must be smaller than 10MB");
            return;
        }

        setError("");
        const reader = new FileReader();
        reader.onload = () => {
            setImageSrc(reader.result);
            setCropperOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropSave = async () => {
        if (!croppedAreaPixels || !imageSrc) return;

        setUploadingImage(true);
        setError("");
        setCropperOpen(false);

        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

            // Upload to Firebase Storage
            const storage = getFirebaseStorage();
            const fileName = `${profile?.uid || Date.now()}-${Date.now()}.jpg`;
            const storageRef = ref(storage, `profile-pictures/${fileName}`);

            await uploadBytes(storageRef, croppedBlob);
            const downloadURL = await getDownloadURL(storageRef);

            // Update form data and preview
            setFormData((prev) => ({ ...prev, photoURL: downloadURL }));
            setImagePreview(downloadURL);
            setImageSrc(null);
        } catch (err) {
            console.error("Upload error:", err);
            setError("Failed to upload image. Please try again.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleCropCancel = () => {
        setCropperOpen(false);
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await updateUserProfile(formData);
            onClose();
        } catch (err) {
            setError("Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={cropperOpen ? null : onClose}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Cropper Modal */}
                    {cropperOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                        >
                            <div className="relative w-full max-w-3xl bg-black rounded-3xl border border-white/20 overflow-hidden">
                                <div className="p-6 border-b border-white/10">
                                    <h3 className="text-xl font-bold text-white uppercase tracking-widest">Crop Profile Picture</h3>
                                </div>
                                <div className="relative h-[500px] bg-black">
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid={false}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={onCropComplete}
                                    />
                                </div>
                                <div className="p-6 space-y-4 bg-gradient-to-b from-black to-black/95">
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/60 uppercase tracking-widest">Zoom</label>
                                        <input
                                            type="range"
                                            min={1}
                                            max={3}
                                            step={0.1}
                                            value={zoom}
                                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-iris"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCropCancel}
                                            className="flex-1 rounded-full border border-white/20 px-6 py-3 text-sm uppercase tracking-widest text-white/80 hover:bg-white/10 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCropSave}
                                            disabled={uploadingImage}
                                            className="flex-1 rounded-full bg-gradient-to-r from-iris to-iris-glow px-6 py-3 text-sm uppercase tracking-widest text-white font-bold hover:shadow-lg transition-all disabled:opacity-50"
                                        >
                                            {uploadingImage ? "Uploading..." : "Save"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Edit Form Modal */}
                    {!cropperOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
                        >
                            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0A0A0A] to-black/95 p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
                                <div className="mb-6 flex items-center justify-between">
                                    <h2 className="text-xl font-heading font-bold uppercase tracking-widest text-white">
                                        Edit Profile
                                    </h2>
                                    <button
                                        onClick={onClose}
                                        className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-all"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Profile Picture Upload */}
                                    <div>
                                        <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-white/60">
                                            Profile Picture
                                        </label>
                                        <div className="flex items-center gap-4">
                                            {/* Preview */}
                                            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/5 flex-shrink-0 shadow-xl">
                                                {imagePreview || formData.photoURL ? (
                                                    <Image
                                                        src={imagePreview || formData.photoURL}
                                                        alt="Profile preview"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold uppercase text-white/40">
                                                        {formData.displayName?.charAt(0) || "?"}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Upload Button */}
                                            <div className="flex-1">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleFileClick}
                                                    disabled={uploadingImage}
                                                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
                                                >
                                                    {uploadingImage ? "Uploading..." : "Upload Image"}
                                                </button>
                                                <p className="mt-2 text-[10px] text-white/40">
                                                    JPG, PNG, or GIF. Max 10MB.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">
                                            Display Name
                                        </label>
                                        <input
                                            type="text"
                                            name="displayName"
                                            value={formData.displayName}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 focus:border-white/30 focus:outline-none focus:ring-0"
                                            placeholder="Your Name"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">
                                            Instagram Handle
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-3.5 text-white/40">@</span>
                                            <input
                                                type="text"
                                                name="instagram"
                                                value={formData.instagram}
                                                onChange={handleChange}
                                                className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-4 py-3 text-white placeholder-white/20 focus:border-white/30 focus:outline-none focus:ring-0"
                                                placeholder="username"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">
                                            City
                                        </label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 focus:border-white/30 focus:outline-none focus:ring-0"
                                            placeholder="Your City"
                                        />
                                    </div>

                                    {error && <p className="text-center text-sm text-red-400">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={loading || uploadingImage}
                                        className="w-full rounded-full bg-gradient-to-r from-iris to-iris-glow py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:shadow-lg hover:scale-105 disabled:opacity-50"
                                    >
                                        {loading ? "Saving..." : "Save Changes"}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
}
