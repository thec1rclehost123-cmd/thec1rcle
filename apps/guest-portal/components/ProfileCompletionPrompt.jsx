"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./providers/AuthProvider";
import GenderSelector from "./GenderSelector";
import { Sparkles, X } from "lucide-react";

export default function ProfileCompletionPrompt() {
    const { user, profile, updateUserProfile, loading } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedGender, setSelectedGender] = useState("");

    useEffect(() => {
        // Check if user is logged in, profile is loaded, and gender is missing
        if (!loading && user && profile && !profile.gender) {
            // Check session storage to only show once per session
            const hasSeenPrompt = sessionStorage.getItem("hasSeenGenderPrompt");
            if (!hasSeenPrompt) {
                setIsVisible(true);
            }
        } else {
            setIsVisible(false);
        }
    }, [user, profile, loading]);

    const handleSave = async () => {
        if (!selectedGender) return;
        setIsUpdating(true);
        try {
            await updateUserProfile({ gender: selectedGender });
            setIsVisible(false);
            sessionStorage.setItem("hasSeenGenderPrompt", "true");
        } catch (error) {
            console.error("Failed to update gender", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSkip = () => {
        setIsVisible(false);
        sessionStorage.setItem("hasSeenGenderPrompt", "true");
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                        onClick={handleSkip}
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        className="relative w-full max-w-lg bg-zinc-950/90 border border-white/10 rounded-[40px] shadow-2xl p-8 sm:p-10 pointer-events-auto overflow-hidden"
                    >
                        {/* Background Accents */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange/10 blur-[60px] rounded-full" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange/5 blur-[40px] rounded-full" />

                        <div className="relative space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-orange">
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Complete Profile</span>
                                    </div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none">
                                        Personalize your <span className="text-orange">Access.</span>
                                    </h2>
                                    <p className="text-sm text-white/40 font-medium">
                                        Help us tailor your C1rcle experience by sharing your identity.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSkip}
                                    className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/20 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="py-4">
                                <GenderSelector
                                    value={selectedGender}
                                    onChange={setSelectedGender}
                                    disabled={isUpdating}
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={handleSave}
                                    disabled={!selectedGender || isUpdating}
                                    className="flex-1 h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.4em] text-xs hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-xl shadow-orange/10"
                                >
                                    {isUpdating ? "Securing..." : "Confirm Identity"}
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="h-14 px-8 rounded-full border border-white/10 text-white/40 font-black uppercase tracking-[0.4em] text-[10px] hover:bg-white/5 transition-all"
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
