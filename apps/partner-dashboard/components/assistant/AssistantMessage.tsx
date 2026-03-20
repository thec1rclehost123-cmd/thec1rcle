"use client";

/**
 * AssistantMessage — Renders a single assistant answer.
 *
 * Handles all answer types: direct, breakdown, ranked_list, comparison,
 * definition, trend, diagnostic, error, scoped_refusal.
 *
 * Design principles:
 *   - Lead with the text answer
 *   - Show metrics as compact pills
 *   - Show breakdowns as rows, not charts
 *   - Show deep links as quiet underlined text
 *   - Show grounding as a small footer label
 *   - Never render decorative chrome
 */

import { ExternalLink, AlertCircle, Info } from "lucide-react";
import type { AssistantAnswer, MetricRow, DeepLink, GroundingSource, RankedRow } from "@/lib/assistant/types";
import Link from "next/link";

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricPill({ metric }: { metric: MetricRow }) {
    const changeColor = metric.changeDirection === 'up'
        ? 'text-emerald-400'
        : metric.changeDirection === 'down'
            ? 'text-rose-400'
            : 'text-[var(--text-tertiary)]';

    return (
        <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
            <div>
                <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">{metric.label}</span>
                {metric.subtext && (
                    <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)]">{metric.subtext}</span>
                )}
            </div>
            <div className="text-right">
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">{metric.value}</span>
                {metric.change && (
                    <span className={`ml-1.5 text-[11px] font-medium ${changeColor}`}>{metric.change}</span>
                )}
            </div>
        </div>
    );
}

function RankedItem({ row }: { row: RankedRow }) {
    return (
        <div className={`flex items-center gap-3 py-1.5 ${row.highlight ? 'opacity-100' : 'opacity-85'}`}>
            <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums w-4 text-right">{row.rank}</span>
            <div className="flex-1 min-w-0">
                <span className="text-[13px] text-[var(--text-primary)] truncate block">{row.label}</span>
                {row.subtext && <span className="text-[11px] text-[var(--text-tertiary)]">{row.subtext}</span>}
            </div>
            <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums shrink-0">{row.value}</span>
        </div>
    );
}

function DeepLinkRow({ links }: { links: DeepLink[] }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {links.map((link, i) => (
                <Link
                    key={i}
                    href={link.href}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors underline underline-offset-2"
                >
                    {link.label}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </Link>
            ))}
        </div>
    );
}

function GroundingFooter({ sources }: { sources: GroundingSource[] }) {
    const labels = sources.map(s => s.scope ? `${s.label} (${s.scope})` : s.label).join(' · ');
    return (
        <p className="text-[10px] text-[var(--text-tertiary)] mt-2.5 leading-relaxed">
            Based on: {labels}
        </p>
    );
}

function FreshnessTag({ freshness }: { freshness?: string }) {
    if (!freshness || freshness === 'settled') return null;
    const config: Record<string, { label: string; color: string }> = {
        live:        { label: 'Live',         color: 'text-emerald-400' },
        estimated:   { label: 'Est.',         color: 'text-amber-400' },
        pending:     { label: 'Pending',      color: 'text-indigo-400' },
        partial:     { label: 'Partial data', color: 'text-orange-400' },
        unavailable: { label: 'Unavailable',  color: 'text-rose-400' },
    };
    const cfg = config[freshness];
    if (!cfg) return null;
    return (
        <span className={`text-[10px] font-medium ${cfg.color} ml-2`}>{cfg.label}</span>
    );
}

// ── Main Message Component ────────────────────────────────────────────────────

interface AssistantMessageProps {
    answer: AssistantAnswer;
    isLoading?: boolean;
}

export function AssistantMessage({ answer, isLoading }: AssistantMessageProps) {
    if (isLoading) {
        return (
            <div className="py-3 space-y-2 animate-pulse">
                <div className="h-3 bg-border-subtle rounded w-3/4" />
                <div className="h-3 bg-border-subtle rounded w-1/2" />
                <div className="h-3 bg-border-subtle rounded w-2/3" />
            </div>
        );
    }

    const isError = answer.type === 'error' || answer.type === 'scoped_refusal';

    return (
        <div className="py-0.5 space-y-3">
            {/* Error / refusal indicator */}
            {isError && (
                <div className="flex items-start gap-2">
                    {answer.type === 'scoped_refusal'
                        ? <Info className="w-3.5 h-3.5 text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    }
                    <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{answer.text}</span>
                </div>
            )}

            {/* Main text (non-error) */}
            {!isError && (
                <div className="space-y-1">
                    {answer.scopeNote && (
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-1">{answer.scopeNote}</p>
                    )}
                    <p className="text-[13px] text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                        {answer.text}
                        <FreshnessTag freshness={answer.dataFreshness} />
                    </p>
                </div>
            )}

            {/* Key metrics row */}
            {answer.metrics && answer.metrics.length > 0 && (
                <div className="bg-[var(--bg-fill)]/50 rounded-lg px-3 py-1 mt-2">
                    {answer.metrics.map((m, i) => (
                        <MetricPill key={i} metric={m} />
                    ))}
                </div>
            )}

            {/* Breakdown rows */}
            {answer.breakdown && answer.breakdown.length > 0 && (
                <div className="bg-[var(--bg-fill)]/50 rounded-lg px-3 py-1 mt-2">
                    {answer.breakdown.map((m, i) => (
                        <MetricPill key={i} metric={m} />
                    ))}
                </div>
            )}

            {/* Ranked list */}
            {answer.ranked && answer.ranked.length > 0 && (
                <div className="bg-[var(--bg-fill)]/50 rounded-lg px-3 py-1.5 mt-2 space-y-0.5">
                    {answer.ranked.map((row, i) => (
                        <RankedItem key={i} row={row} />
                    ))}
                </div>
            )}

            {/* Comparison table */}
            {answer.comparison && answer.comparison.length > 0 && (
                <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${answer.comparison.length}, 1fr)` }}>
                    {answer.comparison.map((col, ci) => (
                        <div key={ci} className="bg-[var(--bg-fill)]/50 rounded-lg px-3 py-2 space-y-1">
                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{col.label}</p>
                            {col.metrics.map((m, mi) => (
                                <div key={mi} className="flex justify-between">
                                    <span className="text-[11px] text-[var(--text-tertiary)]">{m.label}</span>
                                    <span className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{m.value}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            {answer.table && answer.table.rows.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr>
                                {answer.table.headers.map((h, i) => (
                                    <th key={i} className="text-left text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider pb-1.5 font-normal">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {answer.table.rows.map((row, ri) => (
                                <tr key={ri} className="border-t border-[var(--border-subtle)]">
                                    {row.cells.map((cell, ci) => (
                                        <td key={ci} className="py-1.5 text-[var(--text-secondary)] pr-3">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Deep links */}
            {answer.links && answer.links.length > 0 && (
                <DeepLinkRow links={answer.links} />
            )}

            {/* Grounding footer */}
            {answer.grounding && answer.grounding.length > 0 && (
                <GroundingFooter sources={answer.grounding} />
            )}
        </div>
    );
}
