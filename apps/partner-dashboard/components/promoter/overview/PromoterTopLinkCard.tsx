"use client";

import { Link as LinkIcon } from "lucide-react";

export function PromoterTopLinkCard({ topLink }: { topLink?: any }) {
    return (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col h-[280px]">
            <h3 className="font-semibold text-[var(--text-primary)] text-sm tracking-wide mb-4 uppercase">Top Link This Week</h3>
            <div className="flex-1 flex flex-col justify-center">
                {topLink ? (
                    <div className="space-y-4">
                        <p className="font-bold truncate text-lg text-emerald-400">
                            {topLink.event?.name}
                        </p>
                        <div className="bg-[var(--bg-secondary)] px-3 py-2 rounded-lg font-mono text-sm break-all text-[var(--text-secondary)]">
                            c1rcle.com/e/{topLink.linkCode}
                        </div>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            Driven <span className="font-bold text-[var(--text-primary)] tabular-nums">{topLink.attributedRevenue}</span> in sales
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-12 w-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-3 text-[var(--text-tertiary)]">
                            <LinkIcon className="h-5 w-5" />
                        </div>
                        <p className="text-sm text-[var(--text-tertiary)]">No link data available yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
