'use client';

import { useState } from 'react';
import { Music, Plus, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExperienceStepProps {
  formData: any;
  updateFormData: (updates: any) => void;
  validationErrors: Record<string, string>;
}

const GENRE_OPTIONS = [
  'House',
  'Techno',
  'EDM',
  'Hip-Hop',
  'R&B',
  'Bollywood',
  'Commercial',
  'Afrobeats',
  'Reggaeton',
  'Drum & Bass',
  'Trance',
  'Psytrance',
  'Deep House',
  'Tech House',
  'Indie',
  'Rock',
  'Pop',
];

const DRESS_CODE_OPTIONS = [
  { id: 'smart_casual', label: 'Smart Casual', desc: 'Well-dressed, no sportswear' },
  { id: 'formal', label: 'Formal', desc: 'Suits, dresses, elegant attire' },
  { id: 'casual', label: 'Casual', desc: 'Anything goes, be comfortable' },
  { id: 'themed', label: 'Themed', desc: 'Specific theme or costume' },
  { id: 'none', label: 'No Dress Code', desc: 'No restrictions' },
];

const AGE_OPTIONS = [
  { value: '18+', label: '18+' },
  { value: '21+', label: '21+' },
  { value: '25+', label: '25+' },
  { value: 'all', label: 'All Ages' },
];

export function ExperienceStep({
  formData,
  updateFormData,
  validationErrors,
}: ExperienceStepProps) {
  const [artistInput, setArtistInput] = useState('');
  const artists = formData.artists || [];
  const genres = formData.genres || [];

  const addArtist = () => {
    if (artistInput.trim() && !artists.includes(artistInput.trim())) {
      updateFormData({ artists: [...artists, artistInput.trim()] });
      setArtistInput('');
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
    <div className="grid grid-cols-2 gap-5">
      {/* ─── Left: Lineup + Genres ─── */}
      <div className="space-y-5">
        {/* Artists / Lineup */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">
              Lineup & Performers
            </span>
            <span className="ml-auto text-[9px] text-text-tertiary/60 font-bold uppercase tracking-widest">
              Optional
            </span>
          </div>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              <input
                placeholder="Add artist or performer"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addArtist())}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] focus:outline-none focus:border-purple-400 transition-all placeholder:text-text-tertiary/50"
              />
            </div>
            <button
              type="button"
              onClick={addArtist}
              className="px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[12px] font-bold hover:bg-purple-500/20 transition-all flex items-center gap-1 flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {artists.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {artists.map((artist: string) => (
                <motion.div
                  key={artist}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20"
                >
                  <span className="text-[12px] font-medium text-purple-600">{artist}</span>
                  <button
                    type="button"
                    onClick={() => removeArtist(artist)}
                    className="w-3.5 h-3.5 rounded-full bg-purple-500/20 hover:bg-purple-500/40 flex items-center justify-center transition-colors"
                  >
                    <X className="w-2 h-2 text-purple-600" />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-tertiary">
              No performers added yet. Press Enter or click Add.
            </p>
          )}
        </div>

        {/* Genres */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                Music & Genre Tags
              </span>
            </div>
            {genres.length > 0 && (
              <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
                {genres.length} selected
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GENRE_OPTIONS.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  genres.includes(genre)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-surface-secondary text-text-secondary border-border-subtle hover:border-indigo-400 hover:bg-surface-base'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right: Dress Code + Age ─── */}
      <div className="space-y-5">
        {/* Dress Code */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
              Dress Code
            </span>
          </div>
          <div className="space-y-1.5">
            {DRESS_CODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => updateFormData({ dressCode: option.id })}
                className={`w-full px-3 py-2.5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                  formData.dressCode === option.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-border-subtle hover:border-amber-400/40 hover:bg-surface-secondary'
                }`}
              >
                <div>
                  <p className="text-[13px] font-semibold text-text-primary">{option.label}</p>
                  <p className="text-[10px] text-text-tertiary">{option.desc}</p>
                </div>
                {formData.dressCode === option.id && (
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {formData.dressCode === 'themed' && (
            <input
              placeholder="e.g. White Party, Neon Night, 80s Retro"
              value={formData.themeDescription || ''}
              onChange={(e) => updateFormData({ themeDescription: e.target.value })}
              className="w-full mt-2 px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] focus:outline-none focus:border-amber-400 transition-all placeholder:text-text-tertiary/50"
            />
          )}
        </div>

        {/* Age Restriction */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
              Age Restriction
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {AGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateFormData({ ageRestriction: option.value })}
                className={`py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all text-center ${
                  formData.ageRestriction === option.value
                    ? 'border-red-500 bg-red-500/10 text-red-600'
                    : 'border-border-subtle hover:border-red-400/40 text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {formData.ageRestriction && formData.ageRestriction !== 'all' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-600 font-medium">
                  Valid government ID required at entry. Displayed prominently on the event page.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
