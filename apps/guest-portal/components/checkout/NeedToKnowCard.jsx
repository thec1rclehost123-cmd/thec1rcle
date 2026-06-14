"use client";

import { AlertCircle } from "lucide-react";

export default function NeedToKnowCard({ items, className = "" }) {
    if (!items?.length) return null;

    return (
        <div className={`rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl ${className}`}>
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange/12 bg-orange/10">
                    <AlertCircle className="h-4 w-4 text-orange" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange">Need to know</p>
                    <p className="mt-1 text-[11px] text-white/38">Entry details for tonight&apos;s booking.</p>
                </div>
            </div>
            <div className="mt-5 space-y-0">
                {items.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="grid grid-cols-[minmax(0,110px)_1fr] items-start gap-4 border-b border-white/6 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
                        <p className="pt-0.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/36">{item.label}</p>
                        <p className="text-right text-[15px] font-semibold leading-6 text-white/78">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
