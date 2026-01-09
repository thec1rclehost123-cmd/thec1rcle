"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./providers/AuthProvider";
import { getFirebaseStorage } from "../lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Image from "next/image";
import Cropper from "react-easy-crop";
import GenderSelector from "./GenderSelector";

export default function EditProfileModal({ open, onClose }) {
    const { user, profile, updateUserProfile, changePassword } = useAuth();
    const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
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
        phoneNumber: profile?.phoneNumber || "",
        photoURL: profile?.photoURL || "",
        city: profile?.city || "",
        gender: profile?.gender || ""
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePasswordChange = (e) => {
        setPasswordData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
        setSuccess("");
        try {
            // Update profile
            await updateUserProfile(formData);

            // Update password if requested
            if (passwordData.newPassword) {
                if (passwordData.newPassword !== passwordData.confirmPassword) {
                    throw new Error("New passwords do not match");
                }
                if (!passwordData.currentPassword) {
                    throw new Error("Current password is required to change password");
                }
                await changePassword(passwordData.currentPassword, passwordData.newPassword);
            }

            setSuccess("Profile updated successfully!");
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError(err.message || "Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    // Use React Portal to render outside of the parent container (which has transforms)
    // This ensures fixed positioning works relative to the viewport
    const { createPortal } = require("react-dom");

    return createPortal(
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
                        <div className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden">
                            <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-[32px] border border-white/20 bg-[#0A0A0A] p-6 sm:p-7 shadow-[0_0_120px_rgba(244,74,34,0.2)] backdrop-blur-3xl"
                                >
                                    {/* Glow Layer */}
                                    <div className="absolute -top-[20%] -right-[20%] h-[50%] w-[50%] rounded-full bg-orange/5 blur-[100px] pointer-events-none" />

                                    <div className="mb-6 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                                                Edit Profile
                                            </h2>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                                                Identity Management
                                            </p>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="group flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-inner"
                                        >
                                            <svg className="h-4 w-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
                                        {/* Scrollable Content Area */}
                                        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6 scrollbar-hide py-1">
                                            {/* Profile Picture Upload - Premium Card */}
                                            <div className="group rounded-[24px] border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.04]">
                                                <label className="mb-4 block text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                                    Avatar Configuration
                                                </label>
                                                <div className="flex flex-col sm:flex-row items-center gap-8">
                                                    {/* Preview */}
                                                    <div className="relative h-28 w-28 shrink-0">
                                                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange/20 to-iris/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                        <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white/10 bg-black/40 shadow-2xl">
                                                            {imagePreview || formData.photoURL ? (
                                                                <Image
                                                                    src={imagePreview || formData.photoURL}
                                                                    alt="Profile preview"
                                                                    fill
                                                                    className="object-cover transition-transform duration-500 hover:scale-110"
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/10">
                                                                    {formData.displayName?.charAt(0) || "?"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Upload Button */}
                                                    <div className="flex-1 w-full space-y-4 text-center sm:text-left">
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
                                                            className="w-full sm:w-auto rounded-full bg-white text-black px-8 py-4 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-orange hover:text-white hover:scale-105 active:scale-95 disabled:opacity-50 shadow-glow"
                                                        >
                                                            {uploadingImage ? "Processing..." : "Change Image"}
                                                        </button>
                                                        <div className="flex items-center justify-center sm:justify-start gap-4">
                                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest whitespace-nowrap">High Res Preferred</span>
                                                            <div className="h-px w-full bg-white/5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details Section */}
                                            <div className="space-y-5">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                    <div className="space-y-1.5">
                                                        <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                                            Full Name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            name="displayName"
                                                            value={formData.displayName}
                                                            onChange={handleChange}
                                                            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-bold tracking-wide text-white transition-all focus:border-orange/30 focus:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-orange/5"
                                                            placeholder="Your Identity"
                                                            autoCapitalize="words"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                                            Location
                                                        </label>
                                                        <input
                                                            type="text"
                                                            name="city"
                                                            value={formData.city}
                                                            onChange={handleChange}
                                                            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-bold tracking-wide text-white transition-all focus:border-orange/30 focus:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-orange/5"
                                                            placeholder="Base City"
                                                            autoCapitalize="words"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                    <div className="space-y-1.5">
                                                        <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                                            Instagram
                                                        </label>
                                                        <div className="relative group/input">
                                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 font-bold group-focus-within/input:text-orange transition-colors">@</span>
                                                            <input
                                                                type="text"
                                                                name="instagram"
                                                                value={formData.instagram}
                                                                onChange={handleChange}
                                                                className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-12 pr-6 text-sm font-bold tracking-wide text-white transition-all focus:border-orange/30 focus:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-orange/5"
                                                                placeholder="username"
                                                                autoCapitalize="none"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                                            Phone Number
                                                        </label>
                                                        <input
                                                            type="tel"
                                                            name="phoneNumber"
                                                            value={formData.phoneNumber}
                                                            onChange={handleChange}
                                                            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-bold tracking-wide text-white transition-all focus:border-orange/30 focus:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-orange/5"
                                                            placeholder="+91 ••••• •••••"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Security Strategy Layer */}
                                            {!isGoogleUser ? (
                                                <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-6 space-y-6">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-7 w-7 rounded-lg bg-orange/10 flex items-center justify-center">
                                                            <svg className="w-3.5 h-3.5 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange">Security Strategy</h3>
                                                    </div>

                                                    <div className="space-y-6">
                                                        <div className="space-y-2">
                                                            <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                                                                Current Key
                                                            </label>
                                                            <input
                                                                type="password"
                                                                name="currentPassword"
                                                                value={passwordData.currentPassword}
                                                                onChange={handlePasswordChange}
                                                                className="h-12 w-full rounded-xl border border-white/5 bg-black/40 px-5 text-sm font-bold tracking-[0.3em] text-white transition-all focus:border-white/20 focus:outline-none"
                                                                placeholder="••••••••"
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                                                                    New Secret
                                                                </label>
                                                                <input
                                                                    type="password"
                                                                    name="newPassword"
                                                                    value={passwordData.newPassword}
                                                                    onChange={handlePasswordChange}
                                                                    className="h-12 w-full rounded-xl border border-white/5 bg-black/40 px-5 text-sm font-bold tracking-[0.3em] text-white transition-all focus:border-white/20 focus:outline-none"
                                                                    placeholder="••••••••"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="ml-1 block text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                                                                    Verify
                                                                </label>
                                                                <input
                                                                    type="password"
                                                                    name="confirmPassword"
                                                                    value={passwordData.confirmPassword}
                                                                    onChange={handlePasswordChange}
                                                                    className="h-12 w-full rounded-xl border border-white/5 bg-black/40 px-5 text-sm font-bold tracking-[0.3em] text-white transition-all focus:border-white/20 focus:outline-none"
                                                                    placeholder="••••••••"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/70">Account Security</p>
                                                            <p className="text-[8px] font-medium text-white/30 uppercase tracking-widest">Authorized via Google</p>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 transition-all hover:bg-emerald-500/10 group">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Active</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Identity Selection */}
                                            <div className="pt-3">
                                                <div className="mb-3 flex items-center justify-between px-1">
                                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                                        Primary Identity
                                                    </label>
                                                    {profile?.gender && (
                                                        <div className="flex items-center gap-1.5 grayscale opacity-50">
                                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                            </svg>
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Hardlocked</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <GenderSelector
                                                    value={formData.gender}
                                                    onChange={(val) => setFormData(prev => ({ ...prev, gender: val }))}
                                                    disabled={loading || !!profile?.gender}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-white/5 bg-[#0A0A0A] mt-auto">
                                            <AnimatePresence>
                                                {error && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-[10px] font-bold uppercase tracking-widest text-red-400"
                                                    >
                                                        {error}
                                                    </motion.div>
                                                )}
                                                {success && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-[10px] font-bold uppercase tracking-widest text-emerald-400"
                                                    >
                                                        {success}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <button
                                                type="submit"
                                                disabled={loading || uploadingImage}
                                                className="relative w-full overflow-hidden rounded-full bg-[#FF4D22] py-5 text-[11px] font-black uppercase tracking-[0.5em] text-white transition-all hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(255,77,34,0.3)] active:scale-95 disabled:opacity-50 group"
                                            >
                                                <span className="relative z-10">
                                                    {loading ? "Committing..." : "Synchronize Profile"}
                                                </span>
                                                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transition-all group-hover:h-full group-hover:opacity-10" />
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
