"use client";

import { useState } from "react";
import {
    Sparkles, Building2, Users, Lock, Globe, Link2,
    Music, Briefcase, Star, UserCheck, Tag, ChevronDown, ChevronUp
} from "lucide-react";

// ─── Field primitives ──────────────────────────────────────────────────────────

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

function TextInput({ value, onChange, placeholder, className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { value: string }) {
    return (
        <input
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`
                w-full px-4 h-12 rounded-xl text-[13px] font-medium text-white
                bg-white/[0.05] border border-white/[0.08]
                placeholder:text-white/20
                focus:outline-none focus:border-[#F44A22]/50 focus:bg-white/[0.07]
                transition-all duration-150
                ${className}
            `}
            {...rest}
        />
    );
}

function TextArea({ value, onChange, placeholder, rows = 4 }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
    return (
        <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            className="
                w-full px-4 py-3 rounded-xl text-[13px] font-medium text-white
                bg-white/[0.05] border border-white/[0.08]
                placeholder:text-white/20
                focus:outline-none focus:border-[#F44A22]/50 focus:bg-white/[0.07]
                transition-all duration-150 resize-none leading-relaxed
            "
        />
    );
}

// ─── Module Card ──────────────────────────────────────────────────────────────

function ModuleCard({ icon: Icon, iconColor, title, subtitle, children, accent }: {
    icon: any; iconColor: string; title: string; subtitle: string; children: React.ReactNode; accent?: string
}) {
    return (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent || 'bg-white/[0.06]'}`}>
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

// ─── Event Type Selection ─────────────────────────────────────────────────────

const EVENT_TYPES = [
    { id: 'club_night',     label: 'Club Night',      note: 'GL + cover friendly',    icon: '🎧' },
    { id: 'concert',        label: 'Concert',         note: 'Ticket-first + lineup',   icon: '🎤' },
    { id: 'festival',       label: 'Festival',        note: 'Multi-stage / day pass',  icon: '🎪' },
    { id: 'private',        label: 'Private Event',   note: 'Invite-only, closed',     icon: '🔒' },
    { id: 'ticketed_party', label: 'Ticketed Party',  note: 'Ticket-first model',      icon: '🎟️' },
    { id: 'guest_list',     label: 'Guest List Night','note': 'List-first, cover-only', icon: '📋' },
    { id: 'vip_table',      label: 'VIP Tables',      note: 'Table-heavy premium',     icon: '🍾' },
    { id: 'hybrid',         label: 'Hybrid',          note: 'Tickets + GL + tables',   icon: '⚡' },
] as const;

function EventTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map(et => (
                <button
                    key={et.id}
                    type="button"
                    onClick={() => onChange(et.id)}
                    className={`
                        relative text-left p-3.5 rounded-xl border transition-all duration-150
                        ${value === et.id
                            ? 'border-[#F44A22]/50 bg-[#F44A22]/[0.08]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                        }
                    `}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-[11px] font-bold text-white leading-tight">{et.label}</div>
                            <div className="text-[9px] text-white/35 mt-0.5 leading-tight">{et.note}</div>
                        </div>
                        <span className="text-[16px] leading-none flex-shrink-0">{et.icon}</span>
                    </div>
                    {value === et.id && (
                        <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#F44A22]" />
                    )}
                </button>
            ))}
        </div>
    );
}

// ─── Segmented Selector ────────────────────────────────────────────────────────

function SegmentedSelector<T extends string>({ options, value, onChange }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`
                        flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all duration-150
                        ${value === opt.value
                            ? 'bg-white/[0.1] text-white'
                            : 'text-white/35 hover:text-white/55'
                        }
                    `}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Tag Chips ────────────────────────────────────────────────────────────────

const GENRE_TAGS = [
    'Techno', 'House', 'Afro House', 'Bollywood', 'Commercial',
    'Hip Hop', 'R&B', 'EDM', 'Live Band', 'DJ Set',
    'Ambient', 'Drum & Bass', 'Reggaeton', 'Jazz', 'Pop',
];

const VIBE_TAGS = [
    'Ladies Night', 'Student Night', 'Luxury', 'Afterparty',
    'Invite Only', 'Date Night', 'VIP Access', 'Rooftop',
    'Outdoor', 'Indoor', 'Intimate', 'Large Scale',
];

function TagChips({ selected, onToggle, tags, maxVisible = 12 }: {
    selected: string[]; onToggle: (t: string) => void; tags: string[]; maxVisible?: number
}) {
    const [showAll, setShowAll] = useState(false);
    const visible = showAll ? tags : tags.slice(0, maxVisible);
    return (
        <div>
            <div className="flex flex-wrap gap-1.5">
                {visible.map(tag => {
                    const isSelected = selected.includes(tag);
                    return (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => onToggle(tag)}
                            className={`
                                px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-150
                                ${isSelected
                                    ? 'bg-[#F44A22]/20 border border-[#F44A22]/40 text-[#F44A22]'
                                    : 'bg-white/[0.04] border border-white/[0.07] text-white/40 hover:text-white/65 hover:border-white/[0.12]'
                                }
                            `}
                        >
                            {tag}
                        </button>
                    );
                })}
            </div>
            {tags.length > maxVisible && (
                <button
                    type="button"
                    onClick={() => setShowAll(p => !p)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                >
                    {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showAll ? 'Show less' : `+${tags.length - maxVisible} more`}
                </button>
            )}
        </div>
    );
}

// ─── Privacy Mode ──────────────────────────────────────────────────────────────

const PRIVACY_OPTIONS = [
    { value: 'public',      icon: Globe,     label: 'Public',       desc: 'Visible to all guests in the app' },
    { value: 'unlisted',    icon: Link2,     label: 'Unlisted',     desc: 'Only accessible via direct link' },
    { value: 'invite_only', icon: Lock,      label: 'Invite Only',  desc: 'Requires approved guest list entry' },
] as const;

function PrivacySelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-2">
            {PRIVACY_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isActive = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`
                            w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150
                            ${isActive
                                ? 'border-white/[0.15] bg-white/[0.06]'
                                : 'border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.09]'
                            }
                        `}
                    >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/[0.1]' : 'bg-white/[0.04]'}`}>
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white/80' : 'text-white/35'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-white/45'}`}>{opt.label}</div>
                            <div className="text-[9px] text-white/25 mt-0.5 leading-tight">{opt.desc}</div>
                        </div>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Main Step Component ──────────────────────────────────────────────────────

interface FoundationStepV3Props {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
    role: 'venue' | 'host';
    partnerships: any[];
    profile: any;
}

const DRESS_CODES = [
    { value: 'none',         label: 'None' },
    { value: 'casual',       label: 'Casual' },
    { value: 'smart_casual', label: 'Smart Casual' },
    { value: 'formal',       label: 'Formal' },
    { value: 'themed',       label: 'Themed' },
] as const;

const AGE_RESTRICTIONS = [
    { value: '21+',         label: '21+' },
    { value: '18+',         label: '18+' },
    { value: 'all_ages',    label: 'All Ages' },
    { value: 'invite_only', label: 'Invite Only' },
] as const;

export function FoundationStepV3({
    formData,
    updateFormData,
    validationErrors,
    role,
    partnerships,
    profile,
}: FoundationStepV3Props) {
    const toggleTag = (group: 'genres' | 'vibes', tag: string) => {
        const current: string[] = formData[group] || [];
        updateFormData({
            [group]: current.includes(tag)
                ? current.filter(t => t !== tag)
                : [...current, tag],
        });
    };

    return (
        <div className="space-y-4">

            {/* 1. Event Type */}
            <ModuleCard
                icon={Sparkles}
                iconColor="text-[#F44A22]"
                accent="bg-[#F44A22]/10"
                title="Event Type"
                subtitle="Sets smart defaults across all steps"
            >
                <EventTypeSelector
                    value={formData.eventType || ''}
                    onChange={v => {
                        const defaults: Record<string, Partial<any>> = {
                            club_night:     { guestListEnabled: true, tablesEnabled: false, promotersEnabled: true },
                            concert:        { guestListEnabled: false, tablesEnabled: false, promotersEnabled: false },
                            festival:       { guestListEnabled: false, tablesEnabled: false, promotersEnabled: false },
                            private:        { guestListEnabled: true, tablesEnabled: false, promotersEnabled: false, privacyMode: 'invite_only' },
                            ticketed_party: { guestListEnabled: false, tablesEnabled: false, promotersEnabled: true },
                            guest_list:     { guestListEnabled: true, tablesEnabled: false, promotersEnabled: true },
                            vip_table:      { guestListEnabled: false, tablesEnabled: true, promotersEnabled: false },
                            hybrid:         { guestListEnabled: true, tablesEnabled: true, promotersEnabled: true },
                        };
                        updateFormData({ eventType: v, ...(defaults[v] || {}) });
                    }}
                />
                {formData.eventType && (
                    <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] flex flex-wrap gap-2 text-[9px] text-white/35 font-medium">
                        {formData.guestListEnabled && <span className="text-emerald-400/70">✓ Guest list on</span>}
                        {formData.tablesEnabled && <span className="text-purple-400/70">✓ Tables on</span>}
                        {formData.promotersEnabled && <span className="text-amber-400/70">✓ Promoter sales on</span>}
                        {formData.privacyMode === 'invite_only' && <span className="text-white/40">✓ Invite-only</span>}
                    </div>
                )}
            </ModuleCard>

            {/* 2. Identity */}
            <ModuleCard
                icon={Sparkles}
                iconColor="text-indigo-400"
                accent="bg-indigo-500/10"
                title="Identity"
                subtitle="What guests see first"
            >
                <Field label="Event Name" hint="Required" error={validationErrors.title}>
                    <TextInput
                        value={formData.title}
                        onChange={e => updateFormData({ title: e.target.value })}
                        placeholder="Give your event a memorable name"
                        className="text-[15px] font-bold h-14"
                        autoCapitalize="words"
                    />
                </Field>

                <Field label="Subtitle / Edition" hint="Optional">
                    <TextInput
                        value={formData.subtitle || ''}
                        onChange={e => updateFormData({ subtitle: e.target.value })}
                        placeholder="Edition name, tagline, or season"
                        autoCapitalize="words"
                    />
                </Field>

                <Field label="Description" hint="Recommended: 100+ chars">
                    <TextArea
                        value={formData.description || ''}
                        onChange={e => updateFormData({ description: e.target.value })}
                        placeholder="What's happening, who's performing, what to expect, why this night is unmissable..."
                        rows={4}
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Category">
                        <select
                            value={formData.category}
                            onChange={e => updateFormData({ category: e.target.value })}
                            className="w-full px-4 h-12 rounded-xl text-[13px] font-medium text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all appearance-none"
                        >
                            {['Music', 'Art', 'Fashion', 'Nightlife', 'Festival', 'Food & Drink', 'Tech', 'Private'].map(c =>
                                <option key={c} value={c} className="bg-zinc-900">{c}</option>
                            )}
                        </select>
                    </Field>
                    <Field label="City">
                        <select
                            value={formData.city}
                            onChange={e => updateFormData({ city: e.target.value })}
                            className="w-full px-4 h-12 rounded-xl text-[13px] font-medium text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all appearance-none"
                        >
                            {['Pune', 'Mumbai', 'Bengaluru', 'Goa', 'Delhi', 'Hyderabad', 'Chennai'].map(c =>
                                <option key={c} value={c} className="bg-zinc-900">{c}</option>
                            )}
                        </select>
                    </Field>
                </div>
            </ModuleCard>

            {/* 3. Venue / Host */}
            <ModuleCard
                icon={Building2}
                iconColor="text-blue-400"
                accent="bg-blue-500/10"
                title={role === 'host' ? 'Venue Partner' : 'Venue'}
                subtitle={role === 'host' ? 'Select your partnered venue' : 'Your facility is pre-linked'}
            >
                {role === 'venue' ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-white truncate">
                                {profile?.activeMembership?.partnerName || 'Your Venue'}
                            </p>
                            <p className="text-[10px] text-white/35 mt-0.5">
                                {profile?.activeMembership?.city || formData.city || 'Primary Facility'}
                            </p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex-shrink-0">
                            Pre-selected
                        </span>
                    </div>
                ) : partnerships.length === 0 ? (
                    <div className="p-5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-center">
                        <p className="text-[12px] font-semibold text-amber-300">No Active Venue Partnerships</p>
                        <p className="text-[10px] text-amber-300/60 mt-1.5 leading-relaxed">
                            Contact a venue to establish a partnership before creating an event.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {partnerships.map((p: any) => (
                            <button
                                key={p.venueId}
                                type="button"
                                onClick={() => updateFormData({ venueId: p.venueId, venueName: p.venueName, venue: p.venueName })}
                                className={`
                                    w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-150
                                    ${formData.venueId === p.venueId
                                        ? 'border-[#F44A22]/40 bg-[#F44A22]/[0.06]'
                                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                                    }
                                `}
                            >
                                <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-4 h-4 text-white/30" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-white truncate">{p.venueName}</p>
                                    <p className="text-[10px] text-white/35">{p.city || 'Location TBD'}</p>
                                </div>
                                {formData.venueId === p.venueId && (
                                    <div className="w-5 h-5 rounded-full bg-[#F44A22] flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        ))}
                        {validationErrors.venueId && (
                            <p className="text-[11px] text-red-400 font-medium">{validationErrors.venueId}</p>
                        )}
                    </div>
                )}
            </ModuleCard>

            {/* 4. Tags */}
            <ModuleCard
                icon={Tag}
                iconColor="text-violet-400"
                accent="bg-violet-500/10"
                title="Genre & Vibe Tags"
                subtitle="Shown to guests in search and discovery"
            >
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2.5">Genre</p>
                        <TagChips
                            selected={formData.genres || []}
                            onToggle={t => toggleTag('genres', t)}
                            tags={GENRE_TAGS}
                        />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2.5">Vibe</p>
                        <TagChips
                            selected={formData.vibes || []}
                            onToggle={t => toggleTag('vibes', t)}
                            tags={VIBE_TAGS}
                        />
                    </div>
                </div>
            </ModuleCard>

            {/* 5. Rules */}
            <ModuleCard
                icon={UserCheck}
                iconColor="text-amber-400"
                accent="bg-amber-500/10"
                title="Access Rules"
                subtitle="Dress code, age policy, and visibility"
            >
                <Field label="Dress Code">
                    <SegmentedSelector
                        options={DRESS_CODES}
                        value={formData.dressCode || 'smart_casual'}
                        onChange={v => updateFormData({ dressCode: v })}
                    />
                </Field>

                <Field label="Age Policy">
                    <SegmentedSelector
                        options={AGE_RESTRICTIONS}
                        value={formData.ageRestriction || '21+'}
                        onChange={v => updateFormData({ ageRestriction: v })}
                    />
                </Field>

                <Field label="Visibility">
                    <PrivacySelector
                        value={formData.privacyMode || 'public'}
                        onChange={v => updateFormData({ privacyMode: v })}
                    />
                </Field>
            </ModuleCard>

            {/* 6. Capacity (set here, allocated in Step 3) */}
            <ModuleCard
                icon={Users}
                iconColor="text-emerald-400"
                accent="bg-emerald-500/10"
                title="Total Capacity"
                subtitle="Allocated across channels in Step 3"
            >
                <Field label="Maximum Guests" hint="Used for allocation planning">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => updateFormData({ capacity: Math.max(0, (formData.capacity || 0) - 50) })}
                            className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white text-lg font-light flex-shrink-0 flex items-center justify-center transition-all"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            value={formData.capacity || ''}
                            onChange={e => updateFormData({ capacity: parseInt(e.target.value) || 0 })}
                            placeholder="500"
                            className="flex-1 px-4 h-12 rounded-xl text-[15px] font-bold text-white text-center bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            type="button"
                            onClick={() => updateFormData({ capacity: (formData.capacity || 0) + 50 })}
                            className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white text-lg font-light flex-shrink-0 flex items-center justify-center transition-all"
                        >
                            +
                        </button>
                    </div>
                </Field>
            </ModuleCard>
        </div>
    );
}
