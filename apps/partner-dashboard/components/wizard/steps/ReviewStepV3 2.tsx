"use client";

import { CheckCircle2, AlertTriangle, AlertCircle, ExternalLink, Edit2 } from "lucide-react";

const formatINR = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// ─── Warning categories ────────────────────────────────────────────────────────

function getWarnings(formData: any, revenue: any, capacity: any) {
    const blocking: string[] = [];
    const recommended: string[] = [];
    const polish: string[] = [];

    // Blocking
    if (!formData.title) blocking.push('Event name is required');
    if (!formData.startDate) blocking.push('Event date is required');
    if (!formData.eventType) blocking.push('Event type must be selected');
    if (!formData.venueName && !formData.venueId) blocking.push('Venue is required');

    const hasEntry = formData.tickets?.length > 0 || formData.guestListEnabled || formData.walkInEnabled || formData.tablesEnabled;
    if (!hasEntry) blocking.push('At least one public entry path is required — add tickets, guest list, cover, or tables');

    const total = capacity.total;
    const allocated = capacity.ticketAlloc + capacity.guestListAlloc + capacity.walkInAlloc + capacity.tableAlloc + capacity.staffHold;
    if (total > 0 && allocated > total) {
        blocking.push(`Allocation exceeds capacity by ${allocated - total} — reduce a channel or increase total capacity`);
    }

    // Recommended
    if (!formData.poster && !formData.images?.length) recommended.push('Upload an event poster — events with visuals get 3× more clicks');
    if (!formData.description || formData.description.length < 50) recommended.push('Add a description of at least 50 characters');
    if (formData.promotersEnabled && !formData.commission) recommended.push('Set a default promoter commission rate');
    if (formData.guestListEnabled && !formData.guestListCapPerPromoter) recommended.push('Set a cap per promoter for guest list');
    if (formData.startTime && !formData.doorsOpen) recommended.push('Add a "Doors open" time so guests know when to arrive');
    if (formData.tablesEnabled && formData.tables?.length === 0) recommended.push('Tables are enabled but no packages are configured');

    // Polish
    if (!formData.artists?.length) polish.push('Add lineup to show artists and DJs on the listing');
    if (!formData.highlights?.filter(Boolean).length) polish.push('Add event highlights to entice guests');
    if (!formData.lastEntry) polish.push('Add a last entry time for operations clarity');
    if (!formData.genres?.length) polish.push('Add genre tags to help guests discover this event');

    return { blocking, recommended, polish };
}

// ─── Section Summary Card ──────────────────────────────────────────────────────

function SummarySection({ title, items, onEdit }: {
    title: string; items: { label: string; value: React.ReactNode }[]; onEdit?: () => void
}) {
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{title}</span>
                {onEdit && (
                    <button type="button" onClick={onEdit} className="flex items-center gap-1 text-[9px] font-bold text-white/25 hover:text-white/55 transition-colors uppercase tracking-wider">
                        <Edit2 className="w-2.5 h-2.5" />
                        Edit
                    </button>
                )}
            </div>
            <div className="px-4 py-3 space-y-2">
                {items.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-4">
                        <span className="text-[10px] text-white/35 flex-shrink-0">{item.label}</span>
                        <span className="text-[11px] font-semibold text-white/70 text-right">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Warning List ──────────────────────────────────────────────────────────────

function WarningGroup({ label, items, variant }: {
    label: string; items: string[]; variant: 'blocking' | 'recommended' | 'polish'
}) {
    if (items.length === 0) return null;
    const styles = {
        blocking:    { bg: 'bg-red-500/[0.07]',    border: 'border-red-500/25',    icon: AlertCircle,   color: 'text-red-400',    textColor: 'text-red-300/80' },
        recommended: { bg: 'bg-amber-500/[0.07]',  border: 'border-amber-500/25',  icon: AlertTriangle, color: 'text-amber-400',  textColor: 'text-amber-300/80' },
        polish:      { bg: 'bg-white/[0.03]',       border: 'border-white/[0.07]',  icon: CheckCircle2,  color: 'text-white/35',   textColor: 'text-white/40' },
    }[variant];
    const Icon = styles.icon;

    return (
        <div className={`rounded-xl ${styles.bg} border ${styles.border} p-4 space-y-2`}>
            <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${styles.color}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.color}`}>{label}</span>
                <span className={`ml-auto text-[9px] font-bold ${styles.color} opacity-60`}>{items.length}</span>
            </div>
            <ul className="space-y-1.5">
                {items.map((w, i) => (
                    <li key={i} className={`text-[10px] ${styles.textColor} leading-relaxed pl-5 relative`}>
                        <span className="absolute left-1 top-1.5 w-1 h-1 rounded-full bg-current opacity-60" />
                        {w}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Revenue Summary ───────────────────────────────────────────────────────────

function RevenueSummary({ revenue }: { revenue: any }) {
    if (revenue.gross === 0) return null;
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Revenue Projection</span>
            </div>
            <div className="px-4 py-3 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/35">Gross revenue</span>
                    <span className="text-[12px] font-bold text-white tabular-nums">{formatINR(revenue.gross)}</span>
                </div>
                {revenue.promoterPool > 0 && (
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/35">Promoter payouts</span>
                        <span className="text-[11px] font-semibold text-amber-400/80 tabular-nums">−{formatINR(revenue.promoterPool)}</span>
                    </div>
                )}
                {revenue.discounts > 0 && (
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/35">Buyer discounts</span>
                        <span className="text-[11px] font-semibold text-emerald-400/70 tabular-nums">−{formatINR(revenue.discounts)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-white/[0.05]">
                    <span className="text-[11px] font-bold text-white/60">Venue net (est.)</span>
                    <span className="text-[14px] font-bold text-white tabular-nums">{formatINR(revenue.net)}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Publish Controls ──────────────────────────────────────────────────────────

function PublishControls({ formData, onAction, isSubmitting, canPublish }: {
    formData: any; onAction: (action: 'draft' | 'publish' | 'schedule') => void; isSubmitting: boolean; canPublish: boolean
}) {
    const PUBLISH_MODES = [
        { id: 'publish',  label: 'Publish Now',     desc: 'Goes live immediately',                 primary: true },
        { id: 'schedule', label: 'Schedule',         desc: 'Choose a future publish date & time',   primary: false },
        { id: 'draft',    label: 'Save as Draft',    desc: 'Continue editing later',                primary: false },
    ] as const;

    return (
        <div className="space-y-3">
            {PUBLISH_MODES.map(mode => (
                <button
                    key={mode.id}
                    type="button"
                    disabled={isSubmitting || (mode.id === 'publish' && !canPublish)}
                    onClick={() => onAction(mode.id)}
                    className={`
                        w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200
                        ${mode.primary && canPublish
                            ? 'bg-[#F44A22] border-[#F44A22] hover:bg-[#e0421e] text-white'
                            : mode.primary && !canPublish
                                ? 'bg-white/[0.04] border-white/[0.07] cursor-not-allowed opacity-50'
                                : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.12]'
                        }
                    `}
                >
                    <div className="text-left">
                        <p className={`text-[13px] font-bold ${mode.primary && canPublish ? 'text-white' : 'text-white/65'}`}>
                            {mode.label}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${mode.primary && canPublish ? 'text-white/70' : 'text-white/30'}`}>
                            {mode.desc}
                        </p>
                    </div>
                    {isSubmitting && mode.primary && (
                        <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    )}
                </button>
            ))}
        </div>
    );
}

// ─── Main Step Component ──────────────────────────────────────────────────────

interface ReviewStepV3Props {
    formData: any;
    revenue: any;
    capacity: any;
    onStepJump: (step: any) => void;
    onPublish: (action: 'draft' | 'publish' | 'schedule') => void;
    isSubmitting: boolean;
}

export function ReviewStepV3({ formData, revenue, capacity, onStepJump, onPublish, isSubmitting }: ReviewStepV3Props) {
    const { blocking, recommended, polish } = getWarnings(formData, revenue, capacity);
    const canPublish = blocking.length === 0;
    const allGood = canPublish && recommended.length === 0;

    const recurrenceLabel: Record<string, string> = {
        none: 'No', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month', custom: 'Custom',
    };

    return (
        <div className="space-y-5">

            {/* Readiness header */}
            <div className={`rounded-2xl border p-5 ${allGood ? 'bg-emerald-500/[0.08] border-emerald-500/25' : blocking.length > 0 ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-amber-500/[0.06] border-amber-500/20'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${allGood ? 'bg-emerald-500/15' : blocking.length > 0 ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                        {allGood ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : blocking.length > 0 ? (
                            <AlertCircle className="w-5 h-5 text-red-400" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                        )}
                    </div>
                    <div>
                        <p className={`text-[14px] font-bold ${allGood ? 'text-emerald-300' : blocking.length > 0 ? 'text-red-300' : 'text-amber-300'}`}>
                            {allGood ? 'Ready to publish' : blocking.length > 0 ? `${blocking.length} blocking issue${blocking.length > 1 ? 's' : ''}` : 'Looking good — a few recommendations'}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${allGood ? 'text-emerald-400/60' : blocking.length > 0 ? 'text-red-400/60' : 'text-amber-400/60'}`}>
                            {allGood ? 'All required fields are complete.' : blocking.length > 0 ? 'Fix these before publishing.' : 'Optional improvements to maximize reach.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Warnings */}
            {blocking.length > 0 && <WarningGroup label="Must fix" items={blocking} variant="blocking" />}
            {recommended.length > 0 && <WarningGroup label="Recommended" items={recommended} variant="recommended" />}
            {polish.length > 0 && <WarningGroup label="Optional polish" items={polish} variant="polish" />}

            {/* Summary sections */}
            <div className="space-y-3">
                <SummarySection
                    title="Foundation"
                    onEdit={() => onStepJump('foundation')}
                    items={[
                        { label: 'Event', value: formData.title || <span className="text-red-400/70 italic">Not set</span> },
                        { label: 'Type', value: formData.eventType?.replace('_', ' ') || '—' },
                        { label: 'Venue', value: formData.venueName || <span className="text-red-400/70 italic">Not set</span> },
                        { label: 'Capacity', value: formData.capacity ? `${formData.capacity.toLocaleString('en-IN')} guests` : <span className="text-amber-400/70 italic">Not set</span> },
                        { label: 'Visibility', value: formData.privacyMode?.replace('_', ' ') || 'Public' },
                        { label: 'Age policy', value: formData.ageRestriction || '21+' },
                    ]}
                />

                <SummarySection
                    title="Schedule"
                    onEdit={() => onStepJump('schedule')}
                    items={[
                        { label: 'Date', value: formData.startDate ? new Date(formData.startDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : <span className="text-red-400/70 italic">Not set</span> },
                        { label: 'Time', value: formData.startTime && formData.endTime ? `${formData.startTime} → ${formData.endTime}${formData.isOvernight ? ' (next day)' : ''}` : '—' },
                        { label: 'Recurrence', value: recurrenceLabel[formData.recurrence] || 'No' },
                        ...(formData.doorsOpen ? [{ label: 'Doors', value: formData.doorsOpen }] : []),
                        ...(formData.lastEntry ? [{ label: 'Last entry', value: formData.lastEntry }] : []),
                    ]}
                />

                <SummarySection
                    title="Capacity & Entry"
                    onEdit={() => onStepJump('capacity')}
                    items={[
                        { label: 'Total capacity', value: formData.capacity ? formData.capacity.toLocaleString('en-IN') : '—' },
                        { label: 'Tickets', value: formData.ticketAllocation ? formData.ticketAllocation.toLocaleString('en-IN') : (formData.tickets?.length > 0 ? 'Unallocated' : '—') },
                        { label: 'Guest list', value: formData.guestListEnabled ? (formData.guestListAllocation || 'Enabled, no cap') : 'Off' },
                        { label: 'Walk-in', value: formData.walkInEnabled ? (formData.walkInCoverPrice ? `₹${formData.walkInCoverPrice} cover` : 'Enabled') : 'Off' },
                        { label: 'Tables', value: formData.tablesEnabled ? (formData.tables?.length > 0 ? `${formData.tables.length} package${formData.tables.length > 1 ? 's' : ''}` : 'Enabled, no packages') : 'Off' },
                        { label: 'Scan mode', value: (formData.scanMode || 'both').replace('_', ' + ') },
                    ]}
                />

                <SummarySection
                    title="Revenue"
                    onEdit={() => onStepJump('revenue')}
                    items={[
                        { label: 'Ticket tiers', value: formData.tickets?.length > 0 ? `${formData.tickets.length} tier${formData.tickets.length > 1 ? 's' : ''}, from ₹${Math.min(...(formData.tickets.map((t: any) => t.price || 0)))}` : 'None' },
                        { label: 'Table packages', value: formData.tablesEnabled && formData.tables?.length > 0 ? `${formData.tables.length} package${formData.tables.length > 1 ? 's' : ''}` : 'Off' },
                        { label: 'Promoter sales', value: formData.promotersEnabled ? `On · ${formData.commission || 15}${formData.commissionType === 'percent' ? '% commission' : '₹ flat'}` : 'Off' },
                        ...(revenue.gross > 0 ? [{ label: 'Est. gross', value: <span className="text-emerald-400">{formatINR(revenue.gross)}</span> }] : []),
                        ...(revenue.net > 0 ? [{ label: 'Est. net', value: <span className="text-emerald-400 font-bold">{formatINR(revenue.net)}</span> }] : []),
                    ]}
                />

                <SummarySection
                    title="Media"
                    onEdit={() => onStepJump('media')}
                    items={[
                        { label: 'Poster', value: formData.poster ? <span className="text-emerald-400">Uploaded</span> : <span className="text-amber-400/70 italic">Not uploaded</span> },
                        { label: 'Lineup', value: formData.artists?.length > 0 ? `${formData.artists.length} artist${formData.artists.length > 1 ? 's' : ''}` : <span className="text-white/30 italic">None</span> },
                        { label: 'Highlights', value: formData.highlights?.filter(Boolean).length > 0 ? `${formData.highlights.filter(Boolean).length} highlights` : <span className="text-white/30 italic">None</span> },
                        { label: 'Genre tags', value: formData.genres?.length > 0 ? formData.genres.slice(0, 2).join(', ') + (formData.genres.length > 2 ? ` +${formData.genres.length - 2}` : '') : <span className="text-white/30 italic">None</span> },
                    ]}
                />
            </div>

            {/* Revenue breakdown */}
            <RevenueSummary revenue={revenue} />

            {/* Divider */}
            <div className="h-px bg-white/[0.06]" />

            {/* Publish controls */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Publish</p>
                <PublishControls
                    formData={formData}
                    onAction={onPublish}
                    isSubmitting={isSubmitting}
                    canPublish={canPublish}
                />
            </div>
        </div>
    );
}
