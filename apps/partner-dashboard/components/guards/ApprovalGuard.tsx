"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { Clock, ShieldCheck, AlertCircle, RefreshCcw, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ApprovalGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, isApproved, onboardingStatus, signOut } = useDashboardAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && !isApproved && !onboardingStatus) {
            const pathname = window.location.pathname;
            let type = "";
            if (pathname.includes('/host')) type = "host";
            else if (pathname.includes('/venue')) type = "venue";
            else if (pathname.includes('/promoter')) type = "promoter";

            const params = new URLSearchParams();
            if (type) params.set("type", type);
            if (user.email) params.set("email", user.email);

            router.push(`/onboard?${params.toString()}`);
        }
    }, [loading, user, isApproved, onboardingStatus, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900" />
            </div>
        );
    }

    if (!user) {
        return <>{children}</>;
    }

    if (!isApproved) {
        // If we are redirecting, show a blank or loading state to prevent flicker
        if (!onboardingStatus) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-white">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900" />
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
                <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 text-center">
                    {onboardingStatus === 'changes_requested' ? (
                        <>
                            <div className="h-20 w-20 rounded-[2rem] bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-8">
                                <RefreshCcw className="h-10 w-10" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Modifications Required</h2>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8">
                                The administration has requested some updates to your onboarding profile. Please check your email for specific instructions.
                            </p>
                        </>
                    ) : onboardingStatus === 'rejected' ? (
                        <>
                            <div className="h-20 w-20 rounded-[2rem] bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-8">
                                <AlertCircle className="h-10 w-10" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Registry Rejected</h2>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8">
                                Unfortunately, your application for dashboard access has been rejected. Contact support for more information.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="h-20 w-20 rounded-[2rem] bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-8">
                                <Clock className="h-10 w-10 animate-pulse" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Under Review</h2>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8">
                                Your onboarding request is currently being processed by our compliance team. You will receive an automated alert once access is provisioned.
                            </p>
                        </>
                    )}

                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4 text-left mb-10">
                        <ShieldCheck className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status: <span className="text-slate-900">{onboardingStatus?.replace('_', ' ') || 'Queued'}</span></p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-slate-900 text-white h-14 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg"
                        >
                            Refresh Pipeline Status
                        </button>
                        <button
                            onClick={() => signOut()}
                            className="flex items-center justify-center gap-2 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] hover:text-red-500 transition-colors"
                        >
                            <LogOut className="h-3 w-3" />
                            System Exit
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
