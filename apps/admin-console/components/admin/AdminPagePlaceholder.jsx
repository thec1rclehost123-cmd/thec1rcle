"use client";

import { usePathname } from "next/navigation";
import { Hammer, Sparkles } from "lucide-react";

export default function AdminPagePlaceholder() {
    const pathname = usePathname();
    const pageName = pathname.split('/').pop();

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-12 text-center pb-20">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full"></div>
                <div className="relative h-32 w-32 rounded-[3.5rem] bg-white border border-slate-200 shadow-2xl flex items-center justify-center group overflow-hidden">
                    <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Hammer className="h-12 w-12 text-slate-900 relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12" />
                    <div className="absolute top-8 right-8">
                        <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 max-w-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="h-px w-8 bg-slate-200" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">System Calibration</span>
                    <span className="h-px w-8 bg-slate-200" />
                </div>
                <h2 className="text-5xl font-black tracking-tighter text-slate-900 capitalize">{pageName} Console</h2>
                <p className="text-base text-slate-500 font-medium leading-relaxed">
                    The governance specialized interface for <span className="text-slate-900 font-black">{pageName}</span> is currently in the late-stage synthesis phase. Access will propagate once parameters are verified.
                </p>
            </div>

            <div className="flex flex-col items-center gap-6">
                <div className="px-8 py-3 rounded-full bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-200">
                    Registry Entry: SYS_{pageName?.toUpperCase()}_01
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-300 font-black uppercase tracking-widest">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-200 animate-ping" />
                    Awaiting Signal
                </div>
            </div>
        </div>
    );
}

