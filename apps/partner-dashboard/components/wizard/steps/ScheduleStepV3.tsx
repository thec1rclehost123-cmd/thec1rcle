"use client";

import { useState } from "react";
import { Calendar, Clock, Repeat, ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";

// ─── Field primitives ──────────────────────────────────────────────────────────

function ModuleCard({ icon: Icon, iconColor, accent, title, subtitle, children }: {
    icon: any; iconColor: string; accent: string; title: string; subtitle: string; children: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
                        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-white">{title}</h3>
                        <p className="text-[10px] text-white/35 mt-0.5">{subtitle}</p>
                    </div>
                </div>
            </div>
            <div className="px-6 py-5 space-y-5">
                {children}
            </div>
        </div>
    );
}

function Field({ label, hint, error, children }: {
    label?: string; hint?: string; error?: string; children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            {(label || hint) && (
                <div className="flex items-center justify-between px-0.5">
                    {label && <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">{label}</label>}
                    {hint && <span className="text-[10px] text-white/25 font-medium">{hint}</span>}
                </div>
            )}
            {children}
            {error && <p className="text-[11px] text-red-400 font-medium px-0.5">{error}</p>}
        </div>
    );
}

function TimeInput({ value, onChange, label, hint }: {
    value: string; onChange: (v: string) => void; label?: string; hint?: string
}) {
    return (
        <Field label={label} hint={hint}>
            <input
                type="time"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="
                    w-full px-4 h-12 rounded-xl text-[14px] font-bold text-white font-mono
                    bg-white/[0.05] border border-white/[0.08]
                    focus:outline-none focus:border-[#F44A22]/50 focus:bg-white/[0.07]
                    transition-all duration-150
                    [color-scheme:dark]
                "
            />
        </Field>
    );
}

function Toggle({ enabled, onChange, label, desc }: {
    enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!enabled)}
            className="w-full flex items-center justify-between gap-4 group"
        >
            <div className="text-left">
                <p className="text-[12px] font-semibold text-white/70 group-hover:text-white/90 transition-colors">{label}</p>
                {desc && <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{desc}</p>}
            </div>
            <div className={`
                w-10 h-6 rounded-full border transition-all duration-200 flex-shrink-0
                ${enabled ? 'bg-[#F44A22] border-[#F44A22]' : 'bg-white/[0.06] border-white/[0.12]'}
            `}>
                <div className={`
                    w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-all duration-200
                    ${enabled ? 'ml-5' : 'ml-0.5'}
                `} />
            </div>
        </button>
    );
}

// ─── Recurrence Builder ────────────────────────────────────────────────────────

const RECURRENCE_OPTIONS = [
    { value: 'none',     label: 'Does not repeat' },
    { value: 'weekly',   label: 'Every week' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly',  label: 'Every month' },
    { value: 'custom',   label: 'Custom' },
] as const;

function RecurrenceBuilder({ formData, updateFormData }: { formData: any; updateFormData: (u: any) => void }) {
    const current = formData.recurrence || 'none';
    const isRecurring = current !== 'none';

    return (
        <div className="space-y-4">
            {/* Pattern selector */}
            <div className="space-y-2">
                {RECURRENCE_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateFormData({ recurrence: opt.value })}
                        className={`
                            w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-150
                            ${current === opt.value
                                ? 'border-[#F44A22]/40 bg-[#F44A22]/[0.07]'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
                            }
                        `}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${current === opt.value ? 'bg-[#F44A22]' : 'bg-white/[0.15]'}`} />
                            <span className={`text-[12px] font-semibold ${current === opt.value ? 'text-white' : 'text-white/45'}`}>
                                {opt.label}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Recurrence end condition */}
            {isRecurring && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Series End</p>

                    <div className="space-y-2">
                        {[
                            { value: 'count',   label: 'After N occurrences' },
                            { value: 'date',    label: 'On a specific date' },
                            { value: 'never',   label: 'No end date' },
                        ].map(opt => {
                            const isActive = (formData.recurrenceEndType || 'count') === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => updateFormData({ recurrenceEndType: opt.value })}
                                    className={`
                                        w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all
                                        ${isActive
                                            ? 'border-white/[0.12] bg-white/[0.05]'
                                            : 'border-transparent hover:bg-white/[0.02]'
                                        }
                                    `}
                                >
                                    <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${isActive ? 'border-[#F44A22] bg-[#F44A22]' : 'border-white/25'}`} />
                                    <span className={`text-[11px] font-semibold ${isActive ? 'text-white/80' : 'text-white/35'}`}>{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {formData.recurrenceEndType === 'count' && (
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min={2}
                                max={52}
                                value={formData.recurrenceCount || 4}
                                onChange={e => updateFormData({ recurrenceCount: parseInt(e.target.value) || 4 })}
                                className="w-20 px-3 h-10 rounded-xl text-[14px] font-bold text-white text-center bg-white/[0.06] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                            />
                            <span className="text-[12px] text-white/40">occurrences</span>
                        </div>
                    )}

                    {formData.recurrenceEndType === 'date' && (
                        <input
                            type="date"
                            value={formData.recurrenceEndDate || ''}
                            onChange={e => updateFormData({ recurrenceEndDate: e.target.value })}
                            className="w-full px-4 h-11 rounded-xl text-[13px] font-medium text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [color-scheme:dark]"
                        />
                    )}

                    {formData.recurrenceEndType === 'never' && (
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-300/80 leading-relaxed">
                                Series without an end date will continue indefinitely. You can stop it later from event management.
                            </p>
                        </div>
                    )}

                    {/* Edit scope */}
                    <div className="pt-2 border-t border-white/[0.04]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2.5">Edit scope</p>
                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                            {[
                                { value: 'this',   label: 'This only' },
                                { value: 'future', label: 'This + future' },
                                { value: 'all',    label: 'Entire series' },
                            ].map(opt => {
                                const isActive = (formData.seriesEditScope || 'this') === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => updateFormData({ seriesEditScope: opt.value })}
                                        className={`
                                            py-2 px-1 rounded-lg text-[9px] font-bold transition-all duration-150 text-center
                                            ${isActive ? 'bg-white/[0.1] text-white' : 'text-white/30 hover:text-white/50'}
                                        `}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Step Component ──────────────────────────────────────────────────────

interface ScheduleStepV3Props {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

export function ScheduleStepV3({ formData, updateFormData, validationErrors }: ScheduleStepV3Props) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Detect overnight: end time < start time (e.g. starts 22:00, ends 02:30)
    const isOvernight = formData.startTime && formData.endTime && formData.endTime < formData.startTime;
    if (isOvernight && !formData.isOvernight) {
        updateFormData({ isOvernight: true });
    }

    const advancedTimings = [
        { key: 'doorsOpen',      label: 'Doors Open',         hint: 'When venue opens to guests' },
        { key: 'lastEntry',      label: 'Last Entry',         hint: 'Final time guests may enter' },
        { key: 'guestListClose', label: 'Guest List Closes',  hint: 'Stops accepting new GL entries' },
        { key: 'ticketSalesEnd', label: 'Ticket Sales End',   hint: 'Last time to purchase online' },
    ];

    const filledAdvanced = advancedTimings.filter(a => formData[a.key]);

    return (
        <div className="space-y-4">

            {/* 1. Date & Core Time */}
            <ModuleCard
                icon={Calendar}
                iconColor="text-blue-400"
                accent="bg-blue-500/10"
                title="Date & Time"
                subtitle="When the event takes place"
            >
                <Field label="Event Date" hint="Required" error={validationErrors.startDate}>
                    <input
                        type="date"
                        value={formData.startDate}
                        onChange={e => updateFormData({ startDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 h-12 rounded-xl text-[14px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [color-scheme:dark]"
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <TimeInput
                        label="Start Time"
                        hint="Required"
                        value={formData.startTime || '21:00'}
                        onChange={v => updateFormData({ startTime: v })}
                    />
                    <TimeInput
                        label="End Time"
                        hint={isOvernight ? 'Next day' : undefined}
                        value={formData.endTime || '03:00'}
                        onChange={v => updateFormData({ endTime: v })}
                    />
                </div>

                {/* Overnight notice */}
                {isOvernight && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <div>
                            <p className="text-[11px] font-semibold text-amber-300">Overnight event</p>
                            <p className="text-[9px] text-amber-300/60 mt-0.5">
                                End time is on the following day. Guests and scan staff will see this correctly.
                            </p>
                        </div>
                    </div>
                )}
            </ModuleCard>

            {/* 2. Advanced Timing (collapsed by default) */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowAdvanced(p => !p)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-[13px] font-bold text-white">Advanced Timing</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">
                                {filledAdvanced.length > 0
                                    ? `${filledAdvanced.length} milestone${filledAdvanced.length > 1 ? 's' : ''} set`
                                    : 'Doors, last entry, cutoff times'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {filledAdvanced.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-[9px] font-bold text-emerald-400">
                                {filledAdvanced.length}
                            </span>
                        )}
                        {showAdvanced ? (
                            <ChevronUp className="w-4 h-4 text-white/30" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-white/30" />
                        )}
                    </div>
                </button>

                {showAdvanced && (
                    <div className="px-6 pb-5 border-t border-white/[0.04] pt-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {advancedTimings.map(t => (
                                <TimeInput
                                    key={t.key}
                                    label={t.label}
                                    hint={t.hint}
                                    value={formData[t.key] || ''}
                                    onChange={v => updateFormData({ [t.key]: v })}
                                />
                            ))}
                        </div>

                        <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-white/25 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-white/30 leading-relaxed">
                                These times appear on the guest-facing event page and are used to control scan access logic on event night.
                            </p>
                        </div>

                        <div>
                            <Toggle
                                enabled={formData.reentryAllowed ?? true}
                                onChange={v => updateFormData({ reentryAllowed: v })}
                                label="Re-entry allowed"
                                desc="Guests may exit and return with the same ticket or wristband"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Recurrence */}
            <ModuleCard
                icon={Repeat}
                iconColor="text-[#F44A22]"
                accent="bg-[#F44A22]/10"
                title="Recurring Events"
                subtitle="Club nights, residencies, weekly series"
            >
                <RecurrenceBuilder formData={formData} updateFormData={updateFormData} />
            </ModuleCard>
        </div>
    );
}
