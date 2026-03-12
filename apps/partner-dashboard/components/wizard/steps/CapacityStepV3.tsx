"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Ticket, Wine, DoorOpen, UserCheck, ChevronDown, ChevronUp, AlertTriangle, SlidersHorizontal } from "lucide-react";

// ─── Primitives ────────────────────────────────────────────────────────────────

function ModuleCard({ icon: Icon, iconColor, accent, title, subtitle, children, trailing }: {
    icon: any; iconColor: string; accent: string; title: string; subtitle: string; children: React.ReactNode; trailing?: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
                        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-white">{title}</h3>
                        <p className="text-[10px] text-white/35 mt-0.5">{subtitle}</p>
                    </div>
                </div>
                {trailing}
            </div>
            <div className="px-6 py-5 space-y-5">
                {children}
            </div>
        </div>
    );
}

function Toggle({ enabled, onChange, label, desc }: {
    enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string
}) {
    return (
        <button type="button" onClick={() => onChange(!enabled)} className="w-full flex items-center justify-between gap-4 group">
            <div className="text-left">
                <p className="text-[12px] font-semibold text-white/70 group-hover:text-white/90 transition-colors">{label}</p>
                {desc && <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{desc}</p>}
            </div>
            <div className={`w-10 h-6 rounded-full border transition-all duration-200 flex-shrink-0 ${enabled ? 'bg-[#F44A22] border-[#F44A22]' : 'bg-white/[0.06] border-white/[0.12]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-all duration-200 ${enabled ? 'ml-5' : 'ml-0.5'}`} />
            </div>
        </button>
    );
}

function NumberInput({ value, onChange, min = 0, max, step = 1, placeholder }: {
    value: number | ''; onChange: (v: number) => void; min?: number; max?: number; step?: number; placeholder?: string
}) {
    return (
        <input
            type="number"
            value={value}
            onChange={e => onChange(parseInt(e.target.value) || 0)}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            className="w-full px-4 h-11 rounded-xl text-[13px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
    );
}

// ─── Allocation Bar ────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
    tickets:   '#F44A22',
    guestList: '#10B981',
    walkIn:    '#3B82F6',
    tables:    '#A855F7',
    staff:     '#6B7280',
};

function AllocationBar({ segments, total }: {
    segments: { key: string; label: string; value: number; enabled: boolean }[];
    total: number;
}) {
    const active = segments.filter(s => s.enabled && s.value > 0);
    const allocated = active.reduce((sum, s) => sum + s.value, 0);
    const unallocated = Math.max(0, total - allocated);
    const isOver = allocated > total && total > 0;

    return (
        <div className="space-y-4">
            {/* Bar */}
            <div className="relative">
                <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden flex">
                    {active.map((seg, i) => (
                        <motion.div
                            key={seg.key}
                            className="h-full"
                            style={{ backgroundColor: CHANNEL_COLORS[seg.key] || '#888' }}
                            animate={{ width: total > 0 ? `${Math.min((seg.value / total) * 100, 100)}%` : '0%' }}
                            transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.05 }}
                        />
                    ))}
                    {unallocated > 0 && !isOver && (
                        <div className="h-full flex-1 bg-white/[0.04] rounded-r-full" />
                    )}
                </div>
                {isOver && (
                    <div className="absolute inset-0 rounded-full border-2 border-red-500/60 pointer-events-none" />
                )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {active.map(seg => (
                    <div key={seg.key} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[seg.key] || '#888' }} />
                        <span className="text-white/40 text-[10px] flex-1 truncate">{seg.label}</span>
                        <span className="text-white/60 text-[10px] font-semibold tabular-nums">{seg.value}</span>
                        {total > 0 && <span className="text-white/20 text-[9px] w-6 text-right tabular-nums">{Math.round((seg.value / total) * 100)}%</span>}
                    </div>
                ))}
                {unallocated > 0 && !isOver && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/[0.1] flex-shrink-0" />
                        <span className="text-white/20 text-[10px] flex-1 italic">Unallocated</span>
                        <span className="text-white/25 text-[10px] tabular-nums">{unallocated}</span>
                    </div>
                )}
            </div>

            {/* Over-allocation warning */}
            {isOver && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/[0.08] border border-red-500/25">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-300 leading-relaxed font-medium">
                        Allocation exceeds capacity by {allocated - total}. Reduce a channel or increase total capacity.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Channel Allocation Card ───────────────────────────────────────────────────

function AllocationChannel({ colorKey, icon: Icon, label, value, onChange, max, enabled, children }: {
    colorKey: string; icon: any; label: string; value: number | ''; onChange: (v: number) => void; max?: number; enabled: boolean; children?: React.ReactNode
}) {
    if (!enabled) return null;
    const color = CHANNEL_COLORS[colorKey] || '#888';

    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                        <Icon className="w-2.5 h-2.5" style={{ color }} />
                    </div>
                    <span className="text-[12px] font-bold text-white/70">{label}</span>
                </div>
                <NumberInput value={value} onChange={onChange} min={0} max={max} placeholder="0" />
            </div>
            {children}
        </div>
    );
}

// ─── Main Step Component ──────────────────────────────────────────────────────

interface CapacityStepV3Props {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

export function CapacityStepV3({ formData, updateFormData, validationErrors }: CapacityStepV3Props) {
    const [showGuestListRules, setShowGuestListRules] = useState(false);
    const [showEntryRules, setShowEntryRules] = useState(false);

    const totalCap = Number(formData.capacity) || 0;
    const ticketAlloc = Number(formData.ticketAllocation) || 0;
    const glAlloc = Number(formData.guestListAllocation) || 0;
    const walkInAlloc = Number(formData.walkInAllocation) || 0;
    const tableAlloc = Number(formData.tableAllocation) || 0;
    const staffHold = Number(formData.staffHold) || 0;

    const segments = [
        { key: 'tickets',   label: 'Tickets',    value: ticketAlloc,  enabled: (formData.tickets?.length > 0 || ticketAlloc > 0) },
        { key: 'guestList', label: 'Guest List', value: glAlloc,      enabled: formData.guestListEnabled || glAlloc > 0 },
        { key: 'walkIn',    label: 'Walk-in',    value: walkInAlloc,  enabled: formData.walkInEnabled || walkInAlloc > 0 },
        { key: 'tables',    label: 'Tables',     value: tableAlloc,   enabled: formData.tablesEnabled || tableAlloc > 0 },
        { key: 'staff',     label: 'Staff hold', value: staffHold,    enabled: staffHold > 0 },
    ];

    return (
        <div className="space-y-4">

            {/* 0. Channel Settings */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-white/60" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-white">Entry Channels</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">Which paths guests can use to attend</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-5 space-y-5">
                    <Toggle
                        enabled={formData.guestListEnabled ?? false}
                        onChange={v => updateFormData({ guestListEnabled: v })}
                        label="Guest List"
                        desc="Promoters add guests; they check in by name at the door"
                    />
                    <div className="h-px bg-white/[0.04]" />
                    <Toggle
                        enabled={formData.walkInEnabled ?? false}
                        onChange={v => updateFormData({ walkInEnabled: v })}
                        label="Walk-in / Cover"
                        desc="Guests pay cover at the door — no advance purchase needed"
                    />
                    <div className="h-px bg-white/[0.04]" />
                    <Toggle
                        enabled={formData.tablesEnabled ?? false}
                        onChange={v => updateFormData({ tablesEnabled: v })}
                        label="Tables"
                        desc="Reserved seating with minimum spends — configure packages in Revenue step"
                    />
                </div>
            </div>

            {/* 1. Total Capacity + Allocation Bar */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-white/60" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-white">Capacity Allocation</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">How {totalCap > 0 ? totalCap.toLocaleString('en-IN') : '—'} guests split across channels</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-5 space-y-5">
                    {totalCap > 0 ? (
                        <AllocationBar segments={segments} total={totalCap} />
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-[11px] text-white/25">Set total capacity in Foundation to see allocation</p>
                        </div>
                    )}

                    {/* Channel allocations */}
                    {totalCap > 0 && (
                        <div className="space-y-3">
                            <AllocationChannel
                                colorKey="tickets"
                                icon={Ticket}
                                label="Ticket Allocation"
                                value={formData.ticketAllocation ?? ''}
                                onChange={v => updateFormData({ ticketAllocation: v })}
                                max={totalCap}
                                enabled={(formData.tickets?.length > 0) || totalCap > 0}
                            />
                            <AllocationChannel
                                colorKey="guestList"
                                icon={UserCheck}
                                label="Guest List"
                                value={formData.guestListAllocation ?? ''}
                                onChange={v => updateFormData({ guestListAllocation: v })}
                                max={totalCap}
                                enabled={formData.guestListEnabled}
                            />
                            <AllocationChannel
                                colorKey="walkIn"
                                icon={DoorOpen}
                                label="Walk-in / Cover"
                                value={formData.walkInAllocation ?? ''}
                                onChange={v => updateFormData({ walkInAllocation: v })}
                                max={totalCap}
                                enabled={formData.walkInEnabled}
                            />
                            <AllocationChannel
                                colorKey="tables"
                                icon={Wine}
                                label="Tables"
                                value={formData.tableAllocation ?? ''}
                                onChange={v => updateFormData({ tableAllocation: v })}
                                max={totalCap}
                                enabled={formData.tablesEnabled}
                            >
                                {formData.tablesEnabled && (
                                    <p className="text-[9px] text-white/25 ml-0.5">
                                        Table guest capacity. Each table package defines seated capacity.
                                    </p>
                                )}
                            </AllocationChannel>

                            {/* Staff hold — always available */}
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center">
                                            <Users className="w-2.5 h-2.5 text-white/30" />
                                        </div>
                                        <div>
                                            <span className="text-[12px] font-bold text-white/50">Staff Hold</span>
                                            <p className="text-[9px] text-white/25 mt-0.5">Reserved for crew, security, and ops</p>
                                        </div>
                                    </div>
                                    <NumberInput
                                        value={formData.staffHold ?? ''}
                                        onChange={v => updateFormData({ staffHold: v })}
                                        min={0}
                                        max={totalCap}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Guest List Controls */}
            {formData.guestListEnabled && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowGuestListRules(p => !p)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-[13px] font-bold text-white">Guest List Rules</h3>
                                <p className="text-[10px] text-white/35 mt-0.5">Caps, approval, and cutoff times</p>
                            </div>
                        </div>
                        {showGuestListRules ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                    </button>

                    {showGuestListRules && (
                        <div className="px-6 pb-5 border-t border-white/[0.04] pt-5 space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Total GL Cap</label>
                                    <NumberInput
                                        value={formData.guestListCap ?? ''}
                                        onChange={v => updateFormData({ guestListCap: v })}
                                        min={0}
                                        placeholder="No cap"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Cap per Promoter</label>
                                    <NumberInput
                                        value={formData.guestListCapPerPromoter ?? ''}
                                        onChange={v => updateFormData({ guestListCapPerPromoter: v })}
                                        min={0}
                                        placeholder="No cap"
                                    />
                                    <p className="text-[9px] text-white/25">Used to calculate promoter earnings</p>
                                </div>
                            </div>

                            <Toggle
                                enabled={formData.guestListAutoApprove ?? true}
                                onChange={v => updateFormData({ guestListAutoApprove: v })}
                                label="Auto-approve guest list entries"
                                desc="If off, you must manually approve each entry before the event"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 3. Walk-in Cover Controls */}
            {formData.walkInEnabled && (
                <ModuleCard
                    icon={DoorOpen}
                    iconColor="text-blue-400"
                    accent="bg-blue-500/10"
                    title="Walk-in Cover"
                    subtitle="Cover charge collected at the door"
                >
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Cover Price (₹)</label>
                        <input
                            type="number"
                            value={formData.walkInCoverPrice ?? ''}
                            onChange={e => updateFormData({ walkInCoverPrice: parseInt(e.target.value) || 0, coverPrice: parseInt(e.target.value) || 0 })}
                            placeholder="e.g. 500"
                            min={0}
                            className="w-full px-4 h-11 rounded-xl text-[14px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                        />
                        <p className="text-[9px] text-white/25 px-0.5">Shown as walk-in cover — not tracked through ticketing inventory</p>
                    </div>
                </ModuleCard>
            )}

            {/* 4. Entry Rules */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowEntryRules(p => !p)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-[13px] font-bold text-white">Entry Rules</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">ID, verification, re-entry, scan mode</p>
                        </div>
                    </div>
                    {showEntryRules ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </button>

                {showEntryRules && (
                    <div className="px-6 pb-5 border-t border-white/[0.04] pt-5 space-y-4">
                        <Toggle
                            enabled={formData.ageVerificationRequired ?? false}
                            onChange={v => updateFormData({ ageVerificationRequired: v })}
                            label="ID verification required at door"
                            desc="Security staff must verify age before entry"
                        />
                        <Toggle
                            enabled={formData.reentryAllowed ?? true}
                            onChange={v => updateFormData({ reentryAllowed: v })}
                            label="Re-entry allowed"
                            desc="Guests may exit and return with the same scan token"
                        />

                        {/* Scan mode */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Scan mode</p>
                            <div className="grid grid-cols-1 gap-1.5">
                                {[
                                    { value: 'tickets_only', label: 'Ticket scan only', desc: 'Only valid ticket QR codes accepted' },
                                    { value: 'guestlist_only', label: 'Guest list only', desc: 'Manual check-in from list only' },
                                    { value: 'both', label: 'Tickets + guest list', desc: 'Both methods accepted' },
                                    { value: 'manual', label: 'Manual check-in', desc: 'No QR scanning — paper or name-based' },
                                ].map(opt => {
                                    const isActive = (formData.scanMode || 'both') === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateFormData({ scanMode: opt.value })}
                                            className={`
                                                flex items-start gap-3 p-3 rounded-xl border text-left transition-all
                                                ${isActive ? 'border-white/[0.15] bg-white/[0.05]' : 'border-white/[0.05] hover:bg-white/[0.02]'}
                                            `}
                                        >
                                            <div className={`w-3 h-3 rounded-full border mt-0.5 flex-shrink-0 ${isActive ? 'border-[#F44A22] bg-[#F44A22]' : 'border-white/25'}`} />
                                            <div>
                                                <p className={`text-[11px] font-semibold ${isActive ? 'text-white/80' : 'text-white/40'}`}>{opt.label}</p>
                                                <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{opt.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
