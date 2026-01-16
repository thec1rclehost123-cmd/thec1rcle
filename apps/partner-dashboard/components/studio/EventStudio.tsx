"use client";

import React, { useMemo } from 'react';
import {
    Zap,
    ShieldAlert,
    TrendingUp,
    Users,
    ArrowUpRight,
    Clock,
    Info
} from 'lucide-react';
import { StudioCard } from './StudioComponents';

/**
 * YouTube Studio-style Event Timeline
 * Visualizes the heartbeat of the night.
 */
export function EventTimeline({ data = [], events = [] }) {
    // Normalized series for SVG (0-100)
    const maxVal = useMemo(() => {
        if (!data || data.length === 0) return 10;
        return Math.max(...data.map(d => Math.max(d.demand, d.reality, d.conversions || 0))) || 10;
    }, [data]);

    const points = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            return {
                x,
                demand: 100 - (d.demand / maxVal) * 100,
                reality: 100 - (d.reality / maxVal) * 100,
                conversions: 100 - (d.conversions / maxVal) * 100
            };
        });
    }, [data, maxVal]);

    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                <Clock className="h-8 w-8 text-slate-300 mb-3" />
                <p className="text-slate-400 font-bold text-sm">No timeline data available for this window.</p>
            </div>
        );
    }

    const demandPath = `M ${points.map(p => `${p.x},${p.demand}`).join(' L ')}`;
    const realityPath = `M ${points.map(p => `${p.x},${p.reality}`).join(' L ')}`;

    return (
        <StudioCard title="How the night went" className="overflow-hidden">

            <div className="h-[300px] w-full relative mb-6">
                {/* SVG Chart Layer */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    {/* Grid Lines */}
                    {[0, 25, 50, 75, 100].map(v => (
                        <line key={v} x1="0" y1={v} x2="100" y2={v} stroke="#f1f5f9" strokeWidth="0.5" />
                    ))}

                    {/* Demand Series (Dashed) */}
                    <path
                        d={demandPath}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeDasharray="2"
                        className="opacity-40"
                    />

                    {/* Reality/Entry Series (Bold) */}
                    <path
                        d={realityPath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        className="drop-shadow-[0_4px_8px_rgba(16,185,129,0.2)]"
                    />

                    {/* Peak Highlights */}
                    {points.map((p, i) => (
                        (p.reality === Math.min(...points.map(pr => pr.reality))) && (
                            <circle key={i} cx={p.x} cy={p.reality} r="1.5" fill="#10b981" />
                        )
                    ))}
                </svg>

                {/* Overlays / Markers */}
                {events.map((evt, i) => (
                    <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-rose-200 border-l border-rose-400/20 flex flex-col items-center group"
                        style={{ left: `${evt.percent}%` }}
                    >
                        <div className="absolute -top-2 bg-rose-500 text-white p-1 rounded-full group-hover:scale-125 transition-transform z-10">
                            {evt.type === 'incident' ? <ShieldAlert className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-slate-900 text-white text-[10px] font-black px-3 py-2 rounded-xl whitespace-nowrap pointer-events-none transition-all z-20 shadow-2xl">
                            {evt.label} @ {evt.time}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-8">
                <div className="flex items-center gap-2">
                    <div className="h-1 w-4 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">People At Venue</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1 w-4 bg-slate-300 rounded-full border-dashed" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Peak Demand Pressure</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Busy Times</span>
                </div>

            </div>

        </StudioCard>
    );
}

/**
 * Diagnostic Insights Panel
 */
export function InsightsPanel({ insights = [] }) {
    if (!insights || insights.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-1 w-8 bg-slate-900 rounded-full" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">What happened</h3>

            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.map((insight) => (
                    <div
                        key={insight.insightId}
                        className={`p-8 rounded-[2.5rem] border transition-all hover:scale-[1.01] ${insight.severity === 'critical'
                            ? 'bg-rose-50 border-rose-100 text-rose-900'
                            : 'bg-white border-slate-100 shadow-sm'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${insight.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'
                                }`}>
                                {insight.severity === 'critical' ? <ShieldAlert className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${insight.severity === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {insight.severity}
                            </span>
                        </div>

                        <h4 className="text-xl font-black uppercase tracking-tight mb-3">{insight.title}</h4>
                        <p className="text-sm font-medium opacity-70 leading-relaxed mb-8">{insight.explanation}</p>

                        <div className="pt-6 border-t border-slate-900/10 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <button className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 group text-slate-400 hover:text-slate-900 transition-colors">
                                    View Data Point <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            </div>

                            {insight.suggestedAction && (
                                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                    <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                                        <span className="text-slate-900 uppercase tracking-wider text-[9px] mr-2">Suggested:</span>
                                        {insight.suggestedAction.text}
                                    </p>
                                </div>
                            )}
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
