"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";

export default function AdminGuard({ children }) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [verifying, setVerifying] = useState(true);

    useEffect(() => {
        async function verifyAdmin() {
            if (loading) return;

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

            // 3. If everything fails and we are not loading, redirect to hide admin area
            if (!loading) {
                setVerifying(false);
                router.replace("/not-found");
            }
        }

        verifyAdmin();
    }, [user, profile, loading, router]);

    if (loading || verifying || !authorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                {/* Brand loader */}
                <div className="flex flex-col items-center gap-6">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-iris"></div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 animate-pulse">Establishing Secure Uplink</p>
                </div>
            </div>
        );
    }

    return children;
}
