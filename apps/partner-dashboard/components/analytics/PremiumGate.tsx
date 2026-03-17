"use client";

import React from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { Sparkles, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface PremiumGateProps {
    children: React.ReactNode;
    featureName: string;
    description?: string;
    minPlan?: "silver" | "gold" | "diamond";
}

const PLAN_HIERARCHY = {
    basic: 0,
    silver: 1,
    gold: 2,
    diamond: 3,
};

export function PremiumGate({ 
    children, 
    featureName, 
    description = "Unlock deeper insights with THE C1RCLE PRO.", 
    minPlan = "silver" 
}: PremiumGateProps) {
    const { subscriptionPlan } = useDashboardAuth();
    
    const userPlanLevel = PLAN_HIERARCHY[subscriptionPlan || "basic"] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[minPlan] ?? 1;
    
    const hasAccess = userPlanLevel >= requiredLevel;

    if (hasAccess) {
        return <>{children}</>;
    }

    return (
        <div className="relative group overflow-hidden rounded-[2rem] border border-white/[0.08] bg-surface-elevated/50 backdrop-blur-md p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-orange-500/10 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] -ml-32 -mb-32 group-hover:bg-indigo-500/10 transition-all duration-700" />

            {/* Blurred content preview (placeholder structure) */}
            <div className="absolute inset-x-8 inset-y-8 blur-xl opacity-20 pointer-events-none select-none">
                <div className="flex flex-col gap-6 h-full">
                    <div className="h-32 w-full bg-white/10 rounded-2xl" />
                    <div className="flex gap-6 flex-1">
                        <div className="bg-white/10 rounded-2xl flex-1" />
                        <div className="bg-white/10 rounded-2xl flex-1" />
                    </div>
                </div>
            </div>

            {/* Lock Overlay */}
            <div className="relative z-10 max-w-sm space-y-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-600/20 flex items-center justify-center shadow-xl border border-white/10">
                    <Lock className="w-8 h-8 text-orange-500" />
                </div>
                
                <div>
                    <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                        {featureName} is Premium
                    </h3>
                    <p className="text-text-muted mt-2 text-sm font-medium leading-relaxed">
                        {description}
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <button className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 text-white text-sm font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-orange-500/20 active:scale-95">
                        Upgrade to {minPlan.toUpperCase()}
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <button className="text-xs font-bold text-text-muted hover:text-white transition-colors py-2">
                        Compare all plans
                    </button>
                </div>
            </div>
        </div>
    );
}
