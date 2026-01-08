"use client";

import { Construction } from "lucide-react";

export default function VenuePlaceholderPage({ title, description }: { title: string, description: string }) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                <Construction className="w-8 h-8 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
            <p className="text-slate-500 max-w-md mx-auto">{description}</p>
        </div>
    );
}
