"use client";

import { useState } from "react";
import { Music, Tag, Shirt, Users, Plus, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExperienceStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

const GENRE_OPTIONS = [
    "House", "Techno", "EDM", "Hip-Hop", "R&B", "Bollywood",
    "Commercial", "Afrobeats", "Reggaeton", "Drum & Bass",
    "Trance", "Psytrance", "Deep House", "Tech House", "Indie", "Rock", "Pop"
];

const DRESS_CODE_OPTIONS = [
    { id: "smart_casual", label: "Smart Casual", desc: "Well-dressed, no sportswear" },
    { id: "formal", label: "Formal", desc: "Suits, dresses, elegant attire" },
    { id: "casual", label: "Casual", desc: "Anything goes, be comfortable" },
    { id: "themed", label: "Themed", desc: "Specific theme or costume" },
    { id: "none", label: "No Dress Code", desc: "No restrictions" }
];

const AGE_OPTIONS = [
    { value: "18+", label: "18+ Only" },
    { value: "21+", label: "21+ Only" },
    { value: "25+", label: "25+ Only" },
    { value: "all", label: "All Ages" }
];

function AppleInput({
    label,
    error,
    className = "",
    icon: Icon,
    hint,
    ...props
}: {
    label?: string;
    error?: string;
    className?: string;
    icon?: any;
    hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-1.5">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-label ml-1 text-[var(--text-secondary)]">{label}</label>
                    {hint && <span className="text-[10px] text-[var(--text-tertiary)] font-medium uppercase tracking-widest">{hint}</span>}
                </div>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-[#4f46e5]">
                        <Icon className="w-4 h-4" />
                    </div>
                )}
                <input
                    className={`input ${error ? 'input-error' : ''} ${Icon ? 'pl-11' : 'pl-4'} pr-4 ${className}`}
                    {...props}
                />
            </div>
            {error && (
                <p className="text-[12px] text-red-600 font-medium ml-1 animate-slide-up">{error}</p>
            )}
        </div>
    );
}

export function ExperienceStep({
    formData,
    updateFormData,
    validationErrors
}: ExperienceStepProps) {
    const [artistInput, setArtistInput] = useState("");

    const artists = formData.artists || [];
    const genres = formData.genres || [];

    const addArtist = () => {
        if (artistInput.trim() && !artists.includes(artistInput.trim())) {
            updateFormData({ artists: [...artists, artistInput.trim()] });
            setArtistInput("");
        }
    };

    const removeArtist = (artist: string) => {
        updateFormData({ artists: artists.filter((a: string) => a !== artist) });
    };

    const toggleGenre = (genre: string) => {
        if (genres.includes(genre)) {
            updateFormData({ genres: genres.filter((g: string) => g !== genre) });
        } else {
            updateFormData({ genres: [...genres, genre] });
        }
    };

    return (
        <div className="space-y-8">
            {/* Lineup / Artists */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Music className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Lineup & Performers</h3>
                        <p className="text-caption">Artists, DJs, or performers at this event</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <AppleInput
                            placeholder="Add artist or performer name"
                            value={artistInput}
                            onChange={(e) => setArtistInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addArtist())}
                            icon={Music}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={addArtist}
                        className="btn btn-secondary px-4"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>

                {artists.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {artists.map((artist: string, i: number) => (
                            <motion.div
                                key={artist}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20"
                            >
                                <span className="text-body-sm font-medium text-purple-500">{artist}</span>
                                <button
                                    type="button"
                                    onClick={() => removeArtist(artist)}
                                    className="w-4 h-4 rounded-full bg-purple-500/20 hover:bg-purple-500/30 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-2.5 h-2.5 text-purple-500" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Genre Tags */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Music & Experience Tags</h3>
                        <p className="text-caption">Help guests find this event by genre</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {GENRE_OPTIONS.map((genre) => (
                        <button
                            key={genre}
                            type="button"
                            onClick={() => toggleGenre(genre)}
                            className={`px-3 py-1.5 rounded-full text-body-sm font-medium border transition-all ${genres.includes(genre)
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                                : 'bg-[var(--surface-secondary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-indigo-500/30 hover:bg-[var(--surface-base)]'
                                }`}
                        >
                            {genre}
                        </button>
                    ))}
                </div>

                {genres.length > 0 && (
                    <p className="text-caption text-emerald-600">
                        {genres.length} genre{genres.length > 1 ? 's' : ''} selected
                    </p>
                )}
            </div>

            {/* Dress Code */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Shirt className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Dress Code</h3>
                        <p className="text-caption">Set attire expectations for guests</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {DRESS_CODE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => updateFormData({ dressCode: option.id })}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.dressCode === option.id
                                ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                                : 'border-[var(--border-subtle)] hover:border-amber-500/30 hover:bg-[var(--surface-secondary)]'
                                }`}
                        >
                            <p className="text-body font-semibold text-[var(--text-primary)]">{option.label}</p>
                            <p className="text-caption text-[var(--text-tertiary)] mt-0.5">{option.desc}</p>
                        </button>
                    ))}
                </div>

                {formData.dressCode === 'themed' && (
                    <AppleInput
                        label="Theme Description"
                        placeholder="e.g., White Party, Neon Night, 80s Retro"
                        value={formData.themeDescription || ""}
                        onChange={(e) => updateFormData({ themeDescription: e.target.value })}
                    />
                )}
            </div>

            {/* Age & Entry Restrictions */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Entry Restrictions</h3>
                        <p className="text-caption">Age and entry requirements</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-label mb-3 block">Age Requirement</label>
                        <div className="flex flex-wrap gap-3">
                            {AGE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updateFormData({ ageRestriction: option.value })}
                                    className={`px-4 py-2 rounded-lg border-2 text-body-sm font-medium transition-all ${formData.ageRestriction === option.value
                                        ? 'border-red-500 bg-red-500/10 text-red-500'
                                        : 'border-[var(--border-subtle)] hover:border-red-500/30 hover:bg-[var(--surface-secondary)]'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ID Requirements Notice */}
                    <AnimatePresence>
                        {formData.ageRestriction && formData.ageRestriction !== 'all' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-4 rounded-xl bg-[var(--state-warning-bg)] border border-[var(--state-warning)]/20 flex items-start gap-3"
                            >
                                <AlertCircle className="w-5 h-5 text-[var(--state-warning)] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-body font-medium text-[var(--state-warning)]">ID Verification Required</p>
                                    <p className="text-caption text-[var(--state-warning)] opacity-80 mt-1">
                                        Guests will be required to show valid government ID at entry.
                                        This will be displayed prominently on the event page.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
