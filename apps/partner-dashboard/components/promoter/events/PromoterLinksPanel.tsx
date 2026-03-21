"use client";

import { Link as LinkIcon, Copy, Plus, MoreVertical, TrendingUp, Activity } from "lucide-react";

function formatCurrencyInline(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(amount);
}

export function PromoterLinksPanel({ links }: { links: any[] }) {
    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-text-primary">Tracking Links</h2>
                    <p className="text-sm text-text-secondary">Manage and create unique referral URIs for your marketing channels.</p>
                </div>
                <button className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors text-sm shadow-sm">
                    <Plus className="h-4 w-4" />
                    New Link
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {links.map((link) => (
                    <div key={link.id} className="bg-surface-elevated border border-border-subtle rounded-2xl p-5 hover:border-border-active transition-colors group flex flex-col items-start h-full">
                        <div className="w-full flex justify-between items-start mb-4">
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-text-primary tracking-tight leading-tight mb-1">{link.name}</span>
                                <span className="inline-flex items-center bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider self-start border border-emerald-500/20">
                                    {link.status}
                                </span>
                            </div>
                            <button className="text-text-muted hover:text-text-primary transition-colors p-1">
                                <MoreVertical className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="bg-surface-base border border-border-subtle rounded-xl px-3 py-2.5 flex items-center justify-between w-full text-sm font-mono text-text-secondary group-hover:border-border-hover transition-colors mb-5">
                            <div className="flex items-center overflow-hidden flex-1">
                                <LinkIcon className="h-4 w-4 mr-2 text-emerald-500 shrink-0" />
                                <span className="truncate">c1rcle.com/e/{link.code}</span>
                            </div>
                            <button className="text-text-muted hover:text-white ml-3 shrink-0 bg-surface-tertiary hover:bg-surface-hover p-1.5 rounded-md transition-colors">
                                <Copy className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="w-full grid grid-cols-3 gap-2 mt-auto border-t border-border-subtle pt-4">
                            <div className="flex flex-col">
                                <span className="text-xs text-text-tertiary font-medium mb-1">CLICKS</span>
                                <span className="text-base font-bold text-text-primary tabular-nums tracking-tight flex items-center gap-1.5">
                                    <Activity className="h-3.5 w-3.5 text-text-muted" />
                                    {link.clicks}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-text-tertiary font-medium mb-1">SALES</span>
                                <span className="text-base font-bold text-text-primary tabular-nums tracking-tight">
                                    {link.purchases}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-text-tertiary font-medium mb-1">REVENUE</span>
                                <span className="text-base font-bold text-emerald-500 tabular-nums tracking-tight">
                                    {formatCurrencyInline(link.revenue)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
