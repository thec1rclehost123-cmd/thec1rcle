"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Search, Filter, ShieldAlert, MessageSquare, Image as ImageIcon, Trash2, CheckCircle, ShieldCheck, ChevronRight } from "lucide-react";

export default function AdminContent() {
    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Safety & Compliance</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Content Moderation</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Review flagged media, comments, and community reports. <span className="text-slate-900">Audit automated filters, resolve escalations, and maintain platform integrity.</span>
                    </p>
                </div>
            </div>

            <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                <div className="relative flex-1 group">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by keyword, identity or report hash..."
                        className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                    />
                </div>
            </div>

            {/* Empty State / Clean Slate */}
            <div className="flex flex-col items-center justify-center p-32 rounded-[4rem] border-2 border-slate-200 border-dashed bg-slate-50/50 text-center">
                <div className="h-20 w-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-8 shadow-sm">
                    <ShieldCheck className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-black tracking-tighter text-slate-900">Universal Calm</h3>
                <p className="text-base text-slate-500 mt-3 font-medium max-w-sm leading-relaxed">
                    All media and community interactions are currently within safety parameters. No active reports require attention.
                </p>
            </div>

            {/* Sub-Systems */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-10 rounded-[3.5rem] bg-white border border-slate-200 hover:border-indigo-600 transition-all relative overflow-hidden group shadow-sm hover:shadow-xl hover:shadow-indigo-50/50">
                    <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MessageSquare className="h-24 w-24 text-slate-900 -rotate-12" />
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
                            <MessageSquare className="h-6 w-6 text-indigo-600" />
                        </div>
                        <span className="font-black uppercase tracking-[0.2em] text-[11px] text-slate-900">Active Chat Monitoring</span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
                        The real-time NLP scanner is monitoring platform-wide event exchanges. <span className="text-slate-900">No linguistic anomalies detected.</span>
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status: Operational</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                </div>

                <div className="p-10 rounded-[3.5rem] bg-white border border-slate-200 hover:border-indigo-600 transition-all relative overflow-hidden group shadow-sm hover:shadow-xl hover:shadow-indigo-50/50">
                    <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ImageIcon className="h-24 w-24 text-slate-900 rotate-12" />
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
                            <ImageIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                        <span className="font-black uppercase tracking-[0.2em] text-[11px] text-slate-900">Visual Safety Shield</span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
                        Async visual safety checks via Google Vision AI are processing inbound assets. <span className="text-slate-900">0 reports in queue.</span>
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status: Operational</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                </div>
            </div>
        </div>
    );
}

