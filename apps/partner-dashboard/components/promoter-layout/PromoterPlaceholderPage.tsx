"use client";

import { Construction } from "lucide-react";

export default function PromoterPlaceholderPage({ title, description }: { title: string, description: string }) {
    return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/5">
                <Construction className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
            <p className="text-zinc-500 max-w-xs mx-auto text-sm">{description}</p>
        </div>
    );
}
