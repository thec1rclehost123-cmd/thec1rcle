"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { PartnerType } from "@/lib/rbac/types";

interface RoleGuardProps {
    children: ReactNode;
    allowedType: PartnerType;
}

export function RoleGuard({ children, allowedType }: RoleGuardProps) {
    const { user, profile, loading } = useDashboardAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
                return;
            }

            if (!profile?.activeMembership) {
                // Logged in but no active partnership — send to onboard so they can apply
                router.replace("/onboard");
                return;
            }

            if (profile.activeMembership.partnerType !== allowedType) {
                // Hard isolation: Redirect to their correct dashboard or error
                const correctPath = `/${profile.activeMembership.partnerType}`;
                router.replace(correctPath);
            }
        }
    }, [user, profile, loading, allowedType, router, pathname]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-white rounded-full animate-spin mb-4" />
                <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">Authorizing Access</p>
            </div>
        );
    }

    if (!user || profile?.activeMembership?.partnerType !== allowedType) {
        return null;
    }

    return <>{children}</>;
}
