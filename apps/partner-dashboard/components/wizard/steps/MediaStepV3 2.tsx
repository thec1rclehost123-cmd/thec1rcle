"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload, Image as ImageIcon, Music2, Plus, Trash2, X,
    GripVertical, ChevronDown, ChevronUp, Sparkles, Clock
} from "lucide-react";

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

// ─── Image Dropzone ────────────────────────────────────────────────────────────

function ImageDropzone({ value, onChange, label, aspect, hint }: {
    value: string; onChange: (url: string) => void; label: string; aspect: string; hint?: string
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => onChange(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-2">
            {label && <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</label>}
            <div
                className={`
                    relative rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden cursor-pointer
                    ${isDragging ? 'border-[#F44A22]/60 bg-[#F44A22]/[0.05]' : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.03]'}
                    ${aspect}
                `}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                }}
            >
                {value ? (
                    <>
                        <img src={value} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                                    className="px-3 py-1.5 rounded-lg bg-white/90 text-[10px] font-bold text-black"
                                >
                                    Replace
                                </button>
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onChange(''); }}
                                    className="w-7 h-7 rounded-lg bg-red-500/90 flex items-center justify-center"
                                >
                                    <Trash2 className="w-3 h-3 text-white" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                            <Upload className="w-4 h-4 text-white/30" />
                        </div>
                        <p className="text-[11px] text-white/30 font-medium text-center">
                            Drop image here or click to upload
                        </p>
                        {hint && <p className="text-[9px] text-white/20 text-center">{hint}</p>}
                    </div>
                )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
    );
}

// ─── Lineup Builder ────────────────────────────────────────────────────────────

function newArtist() {
    return { id: `artist_${Date.now()}`, name: '', role: '', performanceTime: '' };
}

const ARTIST_ROLES = ['Headliner', 'DJ', 'Live Act', 'Support', 'MC', 'Opening Act', 'Special Guest', 'Resident DJ'];

function ArtistCard({ artist, onUpdate, onRemove }: {
    artist: any; onUpdate: (u: any) => void; onRemove: () => void
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <GripVertical className="w-3 h-3 text-white/15 cursor-grab flex-shrink-0" />
                <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {artist.avatar ? (
                        <img src={artist.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <Music2 className="w-3 h-3 text-white/25" />
                    )}
                </div>
                <input
                    value={artist.name}
                    onChange={e => onUpdate({ name: e.target.value })}
                    placeholder="Artist or DJ name"
                    className="flex-1 min-w-0 bg-transparent text-[12px] font-bold text-white placeholder:text-white/20 focus:outline-none"
                />
                {artist.performanceTime && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5 text-white/25" />
                        <span className="text-[10px] text-white/35 font-mono">{artist.performanceTime}</span>
                    </div>
                )}
                <button type="button" onClick={() => setExpanded(p => !p)} className="w-6 h-6 flex items-center justify-center">
                    {expanded ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                </button>
                <button type="button" onClick={onRemove} className="w-6 h-6 flex items-center justify-center hover:text-red-400 transition-colors">
                    <X className="w-3 h-3 text-white/25" />
                </button>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 border-t border-white/[0.05] pt-3 grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-semibold text-white/30 uppercase tracking-wider">Role</label>
                                <select
                                    value={artist.role}
                                    onChange={e => onUpdate({ role: e.target.value })}
                                    className="w-full px-2 h-9 rounded-lg text-[11px] font-semibold text-white bg-white/[0.05] border border-white/[0.07] focus:outline-none appearance-none"
                                >
                                    <option value="" className="bg-zinc-900">— select —</option>
                                    {ARTIST_ROLES.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-semibold text-white/30 uppercase tracking-wider">Set time</label>
                                <input
                                    type="time"
                                    value={artist.performanceTime}
                                    onChange={e => onUpdate({ performanceTime: e.target.value })}
                                    className="w-full px-2 h-9 rounded-lg text-[11px] font-mono font-semibold text-white bg-white/[0.05] border border-white/[0.07] focus:outline-none [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Highlight Chips ────────────────────────────────────────────────────────────

const HIGHLIGHT_SUGGESTIONS = [
    'International DJ', 'VIP bottle service', 'Sunset rooftop', 'Bollywood headliner',
    'Ladies guest list', 'Luxury tables', 'Afterparty until 3 AM', 'Live performance',
    'Open air venue', 'Intimate capacity', 'Complimentary welcome drink', 'Photo booth',
    'LED dancefloor', 'Outdoor terrace', 'Immersive sound system', 'Guest list only entry',
];

// ─── Main Step ─────────────────────────────────────────────────────────────────

interface MediaStepV3Props {
    formData: any;
    updateFormData: (updates: any) => void;
}

export function MediaStepV3({ formData, updateFormData }: MediaStepV3Props) {
    const artists: any[] = formData.artists || [];
    const highlights: string[] = formData.highlights || [];

    const updateArtist = (id: string, updates: any) =>
        updateFormData({ artists: artists.map(a => a.id === id ? { ...a, ...updates } : a) });

    const removeArtist = (id: string) =>
        updateFormData({ artists: artists.filter(a => a.id !== id) });

    const toggleHighlight = (h: string) => {
        updateFormData({ highlights: highlights.includes(h) ? highlights.filter(x => x !== h) : [...highlights, h] });
    };

    const [customHighlight, setCustomHighlight] = useState('');

    return (
        <div className="space-y-4">

            {/* 1. Hero Media */}
            <ModuleCard
                icon={ImageIcon}
                iconColor="text-blue-400"
                accent="bg-blue-500/10"
                title="Hero Media"
                subtitle="Primary visual used in the app listing and guest-facing preview"
            >
                <ImageDropzone
                    label="Event Poster / Cover"
                    value={formData.poster || ''}
                    onChange={v => updateFormData({ poster: v })}
                    aspect="aspect-[16/9]"
                    hint="JPG, PNG, WebP · Recommended: 1920×1080 or 1080×1080"
                />

                <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-start gap-2">
                    <Sparkles className="w-3 h-3 text-white/25 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-white/30 leading-relaxed">
                        High-quality visuals increase event click-through by up to 3×. Use a bold, legible design with your event name visible even at small sizes.
                    </p>
                </div>
            </ModuleCard>

            {/* 2. Lineup */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F44A22]/10 flex items-center justify-center">
                            <Music2 className="w-3.5 h-3.5 text-[#F44A22]" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-white">Lineup</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">Artists, DJs, performers</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => updateFormData({ artists: [...artists, newArtist()] })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F44A22]/30 bg-[#F44A22]/10 text-[10px] font-bold text-[#F44A22] hover:bg-[#F44A22]/15 transition-all"
                    >
                        <Plus className="w-3 h-3" />
                        Add artist
                    </button>
                </div>
                <div className="px-6 py-5 space-y-2">
                    {artists.length === 0 ? (
                        <div className="py-8 text-center">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
                                <Music2 className="w-4 h-4 text-white/20" />
                            </div>
                            <p className="text-[12px] text-white/30 font-medium">No lineup added yet</p>
                            <p className="text-[10px] text-white/20 mt-1">Optional — add artists to show on the event listing</p>
                        </div>
                    ) : (
                        artists.map(a => (
                            <ArtistCard
                                key={a.id}
                                artist={a}
                                onUpdate={u => updateArtist(a.id, u)}
                                onRemove={() => removeArtist(a.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* 3. Highlights */}
            <ModuleCard
                icon={Sparkles}
                iconColor="text-amber-400"
                accent="bg-amber-500/10"
                title="Event Highlights"
                subtitle="Short bullets shown on the guest-facing event listing"
            >
                <div className="flex flex-wrap gap-1.5">
                    {HIGHLIGHT_SUGGESTIONS.map(h => {
                        const selected = highlights.includes(h);
                        return (
                            <button
                                key={h}
                                type="button"
                                onClick={() => toggleHighlight(h)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${selected ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' : 'bg-white/[0.04] border border-white/[0.07] text-white/35 hover:text-white/60 hover:border-white/[0.12]'}`}
                            >
                                {h}
                            </button>
                        );
                    })}
                </div>

                {/* Custom highlight input */}
                <div className="flex items-center gap-2">
                    <input
                        value={customHighlight}
                        onChange={e => setCustomHighlight(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && customHighlight.trim()) {
                                updateFormData({ highlights: [...highlights, customHighlight.trim()] });
                                setCustomHighlight('');
                            }
                        }}
                        placeholder="Custom highlight — press Enter to add"
                        className="flex-1 px-3 h-9 rounded-lg text-[11px] text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 placeholder:text-white/20 transition-all"
                    />
                    {customHighlight && (
                        <button
                            type="button"
                            onClick={() => {
                                updateFormData({ highlights: [...highlights, customHighlight.trim()] });
                                setCustomHighlight('');
                            }}
                            className="px-3 h-9 rounded-lg bg-white/[0.08] text-[10px] font-bold text-white/60 hover:text-white transition-colors"
                        >
                            Add
                        </button>
                    )}
                </div>

                {/* Selected highlights */}
                {highlights.filter(h => !HIGHLIGHT_SUGGESTIONS.includes(h)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {highlights.filter(h => !HIGHLIGHT_SUGGESTIONS.includes(h)).map((h, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <span className="text-[10px] font-semibold text-amber-300">{h}</span>
                                <button type="button" onClick={() => toggleHighlight(h)}>
                                    <X className="w-2.5 h-2.5 text-amber-300/60 hover:text-amber-300" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </ModuleCard>

            {/* 4. Genre tags (carried from Foundation for media context) */}
            <ModuleCard
                icon={Music2}
                iconColor="text-violet-400"
                accent="bg-violet-500/10"
                title="Music & Atmosphere"
                subtitle="Genre and vibe tags surfaced in search"
            >
                <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Active tags</label>
                    <div className="flex flex-wrap gap-1.5">
                        {[...(formData.genres || []), ...(formData.vibes || [])].length > 0 ? (
                            [...(formData.genres || []), ...(formData.vibes || [])].map((t: string, i: number) => (
                                <span key={i} className="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold text-violet-300">
                                    {t}
                                </span>
                            ))
                        ) : (
                            <p className="text-[11px] text-white/25 italic">No tags set — go to Foundation to add genre and vibe tags</p>
                        )}
                    </div>
                </div>
            </ModuleCard>
        </div>
    );
}
