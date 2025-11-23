"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "./providers/AuthProvider";
import { getFirebaseDb, getFirebaseStorage } from "../lib/firebase/client";
import { doc, updateDoc, setDoc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function HostVerificationForm({ onClose }) {
    const { user, updateUserProfile } = useAuth();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        legalName: "",
        instagramHandle: "",
    });
    const [files, setFiles] = useState({
        idDocument: null,
        instaScreenshot: null,
    });
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        if (selectedFiles?.[0]) {
            setFiles({ ...files, [name]: selectedFiles[0] });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        setUploading(true);
        setError("");

        try {
            const storage = getFirebaseStorage();
            const db = getFirebaseDb();
            const timestamp = Date.now();

            // Upload ID
            let idUrl = "";
            if (files.idDocument) {
                const idRef = ref(storage, `hosts/${user.uid}/id_${timestamp}_${files.idDocument.name}`);
                await uploadBytes(idRef, files.idDocument);
                idUrl = await getDownloadURL(idRef);
            }

            // Upload Insta SS
            let instaUrl = "";
            if (files.instaScreenshot) {
                const instaRef = ref(storage, `hosts/${user.uid}/insta_${timestamp}_${files.instaScreenshot.name}`);
                await uploadBytes(instaRef, files.instaScreenshot);
                instaUrl = await getDownloadURL(instaRef);
            }

            // Save Application
            const applicationRef = doc(collection(db, "host_applications"));
            await setDoc(applicationRef, {
                uid: user.uid,
                email: user.email,
                ...formData,
                idUrl,
                instaUrl,
                status: "pending",
                createdAt: new Date().toISOString(),
            });

            // Update User Profile
            await updateUserProfile({
                hostStatus: "pending",
            });

            setStep("success");
        } catch (err) {
            console.error("Error submitting host application:", err);
            let msg = "Failed to submit application.";
            if (err.code === "storage/unauthorized" || err.code === "permission-denied") {
                msg = "Permission denied. Please check your Firebase Storage & Firestore rules.";
            } else if (err.message) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setUploading(false);
        }
    };

    if (step === "success") {
        return (
            <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                    ✓
                </div>
                <h3 className="text-2xl font-heading font-bold text-white">Application Received</h3>
                <p className="text-white/60">
                    We are reviewing your details. You will be notified once your host status is approved.
                </p>
                <button
                    onClick={onClose}
                    className="px-6 py-3 bg-white text-black rounded-full font-bold uppercase tracking-widest text-xs"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-md mx-auto">
            <div className="mb-8 text-center">
                <h3 className="text-2xl font-heading font-bold text-white mb-2">Host Verification</h3>
                <p className="text-white/60 text-sm">
                    Join The C1rcle as a host to create events and manage your community.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Legal Name</label>
                        <input
                            type="text"
                            name="legalName"
                            value={formData.legalName}
                            onChange={handleChange}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500/50 outline-none transition-colors"
                            placeholder="As on your ID"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Instagram Handle</label>
                        <input
                            type="text"
                            name="instagramHandle"
                            value={formData.instagramHandle}
                            onChange={handleChange}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500/50 outline-none transition-colors"
                            placeholder="@username"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Government ID</label>
                        <div className="relative">
                            <input
                                type="file"
                                name="idDocument"
                                onChange={handleFileChange}
                                required
                                accept="image/*,.pdf"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                            />
                        </div>
                        <p className="text-[10px] text-white/30 mt-1">Passport, Aadhar, or Driver's License</p>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Instagram Page Screenshot</label>
                        <div className="relative">
                            <input
                                type="file"
                                name="instaScreenshot"
                                onChange={handleFileChange}
                                required
                                accept="image/*"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                            />
                        </div>
                        <p className="text-[10px] text-white/30 mt-1">Screenshot of your profile showing follower count</p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-white text-black rounded-full py-4 font-bold uppercase tracking-widest text-xs hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading ? "Submitting..." : "Submit Application"}
                </button>
            </form>
        </div>
    );
}
