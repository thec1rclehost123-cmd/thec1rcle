"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, usePathname } from "next/navigation";

export default function AdminGuard({ children }) {
    const { user, profile, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [verifying, setVerifying] = useState(true);

    // Skip all auth gating on the login page — show it immediately
    const isLoginRoute = pathname?.startsWith("/login");

    useEffect(() => {
        setMounted(true);
    }, []);

    // Task 5: Idle Timeout Implementation
    useEffect(() => {
        if (!user || !authorized) return;

        let idleTimer;
        // 30 minute threshold (aligned with server-side 30m check in middleware)
        const TIMEOUT_MS = 30 * 60 * 1000;

        const handleTimeout = async () => {
            console.log("[SECURITY] Idle timeout reached. Terminating session.");

            // Create a visual interruption (simple alert for now as per requirement for "modal countdown" or "force logout")
            // Since "modal countdown" is UI heavy, and requirement says "force logout after 30", we prioritize the force.
            // We can use a query param to show the message on login page.

            if (logout) {
                await logout(); // Ensure firebase auth clears
                window.location.href = "/login?reason=session_expired";
            } else {
                window.location.href = "/login?reason=session_expired";
            }
        };

        const resetTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(handleTimeout, TIMEOUT_MS);
        };

        // Listeners for activity (throttled conceptually by the reset action)
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        events.forEach(name => document.addEventListener(name, resetTimer));

        // Initial set
        resetTimer();

        return () => {
            if (idleTimer) clearTimeout(idleTimer);
            events.forEach(name => document.removeEventListener(name, resetTimer));
        };
    }, [user, authorized, router, logout]);

    useEffect(() => {
        async function verifyAdmin() {
            if (loading) return;

            // 0. Dev-mode bypass: auto-authorize any logged-in user in development
            //    Mirrors the server-side verifyAuth() pattern in lib/server/auth.js
            if (process.env.NODE_ENV === "development" && user) {
                setAuthorized(true);
                setVerifying(false);
                return;
            }

            // 1. Check local profile first (fastest)
            if (profile?.role === "admin" || profile?.admin_role) {
                setAuthorized(true);
                setVerifying(false);
                return;
            }

            // 2. Check Cryptographic Custom Claims (Source of Truth)
            if (user) {
                try {
                    const idTokenResult = await user.getIdTokenResult();
                    if (idTokenResult.claims.admin || idTokenResult.claims.role === 'admin') {
                        setAuthorized(true);
                        setVerifying(false);
                        return;
                    }
                } catch (err) {
                    console.error("Token verification failed", err);
                }
            }

            // 3. If everything fails, redirect to login
            setVerifying(false);
            if (!user) {
                router.replace("/login");
            } else if (user && !authorized) {
                // Logged in but not an admin — redirect to login
                router.replace("/login");
            }
        }

        verifyAdmin();
    }, [user, profile, loading, router, authorized]);

    // Login page bypasses all auth gating — render immediately (no spinner, no redirect)
    if (isLoginRoute) {
        return <>{children}</>;
    }

    // During hydration, show spinner to avoid SSR mismatch
    if (!mounted) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-6">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">Initializing Secure Session</p>
                </div>
            </div>
        );
    }

    if (loading || verifying || !authorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-6">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 animate-pulse">Establishing Secure Uplink</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
