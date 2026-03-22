"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const STATUS_META: Record<string, { label: string; sub: string; color: string }> = {
    not_started:         { label: "Complete your verification",          sub: "Identity & bank setup required to unlock all features.", color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
    in_progress:         { label: "Continue your verification",          sub: "You have steps in progress — pick up where you left off.",  color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
    partially_submitted: { label: "Verification submitted — keep going", sub: "Some steps are submitted. Complete the rest to speed up review.", color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
    fully_submitted:     { label: "Verification under review",           sub: "Our team is reviewing your documents. We'll notify you.",    color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" },
    partially_approved:  { label: "Almost there — a few steps to go",   sub: "Some steps are approved. Complete the rest to unlock full access.", color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" },
    action_required:     { label: "Action required",                     sub: "One or more documents need to be re-uploaded.",            color: "bg-red-500/10 border-red-500/30 text-red-400" },
};

export function KycBanner() {
    const { isApproved, kycStatus } = useDashboardAuth();

    // Only show for approved users who haven't completed KYC
    if (!isApproved || !kycStatus || kycStatus === "fully_verified") return null;

    const meta = STATUS_META[kycStatus] ?? STATUS_META["not_started"];

    return (
        <div className={`mx-4 sm:mx-6 lg:mx-8 xl:mx-10 mt-4 mb-0 rounded-2xl border px-5 py-3.5 flex items-center gap-4 ${meta.color}`}>
            <ShieldAlert className="h-5 w-5 flex-shrink-0 opacity-80" />
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold tracking-tight leading-snug">{meta.label}</p>
                <p className="text-[11px] opacity-70 leading-snug mt-0.5 hidden sm:block">{meta.sub}</p>
            </div>
            <Link
                href="/verify"
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest whitespace-nowrap hover:opacity-80 transition-opacity"
            >
                Go to Verification
                <ArrowRight className="h-3 w-3" />
            </Link>
        </div>
    );
}
