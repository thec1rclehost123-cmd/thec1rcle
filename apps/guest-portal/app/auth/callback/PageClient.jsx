"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../../components/providers/AuthProvider";
import { buildLoginUrl, getReturnUrl, resolveReturnUrl, shouldRouteCallbackToOnboarding } from "../../../lib/auth/guestRouteAccess";

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <AuthCallbackContent />
        </Suspense>
    );
}

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, profile, bootstrap, loading: authLoading, syncStatus } = useAuth();
    const [status, setStatus] = useState("processing"); // processing, success, error
    const [errorMessage, setErrorMessage] = useState("");

    function resolveErrorMessage(raw) {
        if (raw === "account_exists_with_different_credential") {
            return "An account with this email already exists. Please log in with your email and password, then link Google from your profile settings.";
        }
        return raw || "Authentication failed.";
    }

    const returnUrl = getReturnUrl(searchParams, "/profile");
    const onboardingRedirect = useMemo(
        () => buildLoginUrl(returnUrl, { onboarding: true }),
        [returnUrl]
    );
    const loginRedirect = useMemo(
        () => buildLoginUrl(returnUrl),
        [returnUrl]
    );

    useEffect(() => {
        if (authLoading || syncStatus === "loading" || syncStatus === "transient_error") {
            setStatus("processing");
            return;
        }

        if (user) {
            if (shouldRouteCallbackToOnboarding({ bootstrap, profile })) {
                router.replace(onboardingRedirect);
                return;
            }
            setStatus("success");
            const finalUrl = resolveReturnUrl(returnUrl, bootstrap);
            const timer = setTimeout(() => {
                router.replace(finalUrl);
            }, 1500);
            return () => clearTimeout(timer);
        }

        const error = searchParams.get("error");
        if (error) {
            setStatus("error");
            setErrorMessage(resolveErrorMessage(error));
            return;
        }

        if (syncStatus === "signed_out") {
            setStatus("error");
            setErrorMessage("Your authentication session expired before access could be restored. Please sign in again.");
        }
    }, [user, profile, bootstrap, authLoading, syncStatus, router, returnUrl, searchParams, onboardingRedirect]);

    return (
        <div className="relative h-[100dvh] bg-black flex items-center justify-center overflow-hidden">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-orange/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-sm"
            >
                <AnimatePresence mode="wait">
                    {status === "processing" && (
                        <motion.div
                            key="processing"
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center space-y-8"
                        >
                            <div className="relative mx-auto h-24 w-24">
                                <motion.div
                                    className="absolute inset-0 rounded-full border border-white/5"
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <motion.div
                                    className="absolute inset-0 rounded-full border-t-2 border-orange"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                                <div className="absolute inset-2 overflow-hidden rounded-full border border-white/10">
                                    <img src="/logo-circle.jpg" alt="Logo" className="h-full w-full object-cover opacity-50" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h1 className="text-2xl font-black uppercase tracking-tight text-white">Entering <span className="text-orange">THE C1RCLE.</span></h1>
                                <p className="text-xs font-medium text-white/40 uppercase tracking-[0.3em]">
                                    {syncStatus === "transient_error" ? "Retrying your secure session..." : "Verifying your access..."}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {status === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-8"
                        >
                            <div className="mx-auto h-24 w-24 rounded-full bg-orange/10 border border-orange/20 flex items-center justify-center shadow-glow">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                >
                                    <ArrowRight className="h-10 w-10 text-orange" />
                                </motion.div>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-2xl font-black uppercase tracking-tight text-white">Welcome <span className="text-orange">Back.</span></h1>
                                <p className="text-xs font-medium text-white/40 uppercase tracking-[0.3em]">Redirecting to your destination...</p>
                            </div>
                        </motion.div>
                    )}

                    {status === "error" && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel p-8 rounded-[40px] border border-red-500/20 bg-red-500/5 text-center space-y-8"
                        >
                            <div className="mx-auto h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center">
                                <AlertCircle className="h-10 w-10 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-xl font-black uppercase tracking-tight text-white">Access <span className="text-red-500">Denied.</span></h1>
                                <p className="text-xs font-medium text-white/60 tracking-wide">{errorMessage || "Authentication failed."}</p>
                            </div>
                            <Link
                                href={loginRedirect}
                                className="block w-full h-14 rounded-full bg-white text-black font-black uppercase tracking-widest flex items-center justify-center transition-transform hover:scale-[1.02]"
                            >
                                Back to Login
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Subtle UI Accents */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
                <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/10">The.C1rcle.OS v1.0</p>
            </div>
        </div>
    );
}
