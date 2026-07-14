'use client';

import {
  Users,
  Building2,
  CalendarCheck,
  Lock,
  Sparkles,
  AlertCircle,
  Tag,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface IdentityStepProps {
  formData: any;
  updateFormData: (updates: any) => void;
  validationErrors: Record<string, string>;
  role: 'venue' | 'host';
  partnerships: any[];
  profile: any;
  prefilledSlot?: {
    venueId: string;
    venueName: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null;
  stepValidation?: any;
}

export function IdentityStep({
  formData,
  updateFormData,
  validationErrors,
  role,
  partnerships,
  profile,
  prefilledSlot,
  stepValidation,
}: IdentityStepProps) {
  // Extract validation errors for this step
  const identityIssues = stepValidation?.identity?.issues || [];
  const hasIssues = identityIssues.length > 0;

  return (
    <div className="space-y-6">
      {/* ─── Validation Required Banner ─── */}
      <AnimatePresence>
        {hasIssues && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-[#2a1a08] border border-amber-600/30 text-amber-500 flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider">
                VALIDATION REQUIRED:
              </span>
              <div className="text-[11px] font-bold text-amber-400">
                {identityIssues.map((issue: string, idx: number) => (
                  <span key={idx}>• {issue} </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Grid Form Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left Column: Form Inputs */}
        <div className="space-y-4">
          {/* • EVENT IDENTITY Bullet Header */}
          <div className="flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
              EVENT IDENTITY
            </span>
          </div>

          {/* Event Title */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-primary mb-1.5">
              EVENT TITLE *
            </label>
            <div
              className={`flex items-center gap-3 rounded-xl border bg-[#0e0e10]/80 p-3 transition-all ${validationErrors.title ? 'border-red-500/50 focus-within:ring-red-500' : 'border-orange/30 focus-within:border-orange/50'}`}
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                <CalendarCheck className="w-4.5 h-4.5" />
              </div>
              <input
                type="text"
                placeholder="Enter a memorable title for your event"
                maxLength={100}
                value={formData.title || ''}
                onChange={(e) => updateFormData({ title: e.target.value })}
                className="flex-1 bg-transparent text-[14px] font-bold text-text-primary focus:outline-none placeholder:text-text-tertiary/30 pr-2"
                autoCapitalize="words"
              />
              <span className="text-[10px] font-bold text-text-tertiary/50 shrink-0 pr-1">
                {(formData.title || '').length} / 100
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary/60 mt-1.5 px-1">
              Choose a short, catchy title that grabs attention
            </p>
          </div>

          {/* Subtitle / Tagline */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-primary mb-1.5">
              Subtitle / Tagline (optional)
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-orange/30 bg-[#0e0e10]/40 p-3 focus-within:border-orange/50 focus-within:bg-[#0e0e10]/80 transition-all">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Tag className="w-4.5 h-4.5" />
              </div>
              <input
                type="text"
                placeholder="Add a short tagline or subtitle"
                maxLength={120}
                value={formData.subtitle || ''}
                onChange={(e) => updateFormData({ subtitle: e.target.value })}
                className="flex-1 bg-transparent text-[13px] text-text-primary focus:outline-none placeholder:text-text-tertiary/30 pr-2"
                autoCapitalize="words"
              />
              <span className="text-[10px] font-bold text-text-tertiary/50 shrink-0 pr-1">
                {(formData.subtitle || '').length} / 120
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary/60 mt-1.5 px-1">
              A brief tagline adds more context to your event
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-primary mb-1.5">
              DESCRIPTION (OPTIONAL)
            </label>
            <div className="flex items-start gap-3 rounded-xl border border-orange/30 bg-[#0e0e10]/40 p-3 focus-within:border-orange/50 focus-within:bg-[#0e0e10]/80 transition-all relative">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <textarea
                placeholder="Tell people what your event is about, who's performing, what to expect..."
                maxLength={1000}
                value={formData.description || ''}
                onChange={(e) => updateFormData({ description: e.target.value })}
                className="flex-1 bg-transparent text-[13px] text-text-primary focus:outline-none placeholder:text-text-tertiary/30 resize-none h-24 pr-16"
                autoCapitalize="sentences"
              />
              <span className="absolute bottom-3.5 right-3.5 text-[10px] font-bold text-text-tertiary/50">
                {(formData.description || '').length} / 1000
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary/60 mt-1.5 px-1">
              Add more details to help people understand your event better
            </p>
          </div>

          {/* Category & City Dropdown row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1.5">
                CATEGORY (OPTIONAL)
              </label>
              <div className="relative rounded-xl border border-orange/30 bg-[#0e0e10]/40 focus-within:border-orange/50 focus-within:bg-[#0e0e10]/80 transition-all flex items-center px-3.5">
                <select
                  value={formData.category}
                  onChange={(e) => updateFormData({ category: e.target.value })}
                  className="w-full bg-transparent py-3.5 text-[13px] text-text-primary focus:outline-none appearance-none cursor-pointer pr-8 font-semibold bg-none"
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: 'none',
                  }}
                >
                  {[
                    'Music',
                    'Art',
                    'Fashion',
                    'Tech',
                    'Food & Drink',
                    'Nightlife',
                    'Festival',
                    'Private',
                  ].map((c) => (
                    <option key={c} value={c} className="bg-[#18181b] text-text-primary">
                      {c}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 pointer-events-none text-text-tertiary">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* City / Hub */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1.5">
                CITY / HUB (OPTIONAL)
              </label>
              <div className="relative rounded-xl border border-orange/30 bg-[#0e0e10]/40 focus-within:border-orange/50 focus-within:bg-[#0e0e10]/80 transition-all flex items-center px-3.5">
                <select
                  value={formData.city}
                  onChange={(e) => updateFormData({ city: e.target.value })}
                  className="w-full bg-transparent py-3.5 text-[13px] text-text-primary focus:outline-none appearance-none cursor-pointer pr-8 font-semibold bg-none"
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: 'none',
                  }}
                >
                  {['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi', 'Hyderabad', 'Chennai'].map(
                    (c) => (
                      <option key={c} value={c} className="bg-[#18181b] text-text-primary">
                        {c}
                      </option>
                    ),
                  )}
                </select>
                <div className="absolute right-3.5 pointer-events-none text-text-tertiary">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Capacity, Host, Venue Cards */}
        <div className="space-y-4">
          {/* Capacity */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-primary">
                CAPACITY (OPTIONAL)
              </label>
            </div>
            <div className="bg-[#0e0e10]/40 border border-orange/30 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 w-full">
                <div className="w-9 h-9 rounded-lg bg-surface-tertiary flex items-center justify-center text-text-tertiary shrink-0">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <input
                  type="number"
                  placeholder="500"
                  value={formData.capacity || ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                    updateFormData({ capacity: val });
                  }}
                  className="w-full bg-transparent text-[14px] font-bold text-text-primary focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-text-tertiary/70 mt-1.5 px-1">Max expected guests</p>
          </div>

          {/* Host */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                HOST
              </label>
            </div>
            <div className="bg-[#0e0e10]/40 border border-orange/30 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[14px]">
                {(profile?.activeMembership?.partnerName || profile?.displayName || 'P')[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-text-primary leading-tight truncate">
                  {profile?.activeMembership?.partnerName ||
                    profile?.displayName ||
                    'Prime Society'}
                </p>
                <p className="text-[10px] text-text-tertiary/70 mt-0.5">Event Host</p>
              </div>
            </div>
          </div>

          {/* Venue Selection */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                VENUE
              </label>
            </div>
            {role === 'venue' ? (
              <div className="bg-[#0e0e10]/40 border border-orange/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Building2 className="w-4.5 h-4.5 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-text-primary truncate">
                        {profile?.activeMembership?.partnerName || 'Your Venue'}
                      </p>
                      <p className="text-[10px] text-text-tertiary/70 mt-0.5">
                        {profile?.activeMembership?.city || formData.city || 'Primary Facility'}
                      </p>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                    AUTO
                  </div>
                </div>
                <p className="text-[10px] text-text-tertiary/70 mt-2 px-1">
                  Your facility is auto-linked.
                </p>
              </div>
            ) : prefilledSlot ? (
              <div className="bg-[#0e0e10]/40 border border-orange/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <CalendarCheck className="w-4.5 h-4.5 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-text-primary truncate">
                        {prefilledSlot.venueName}
                      </p>
                      <p className="text-[10px] text-text-tertiary/70 mt-0.5">
                        {prefilledSlot.date} · {prefilledSlot.startTime}–{prefilledSlot.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                    <Lock className="w-2.5 h-2.5" />
                    LOCKED
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`bg-[#0e0e10]/40 border rounded-xl p-3 space-y-2 ${validationErrors.venueId ? 'border-red-500' : 'border-orange/30'}`}
              >
                {partnerships.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-center">
                    <p className="text-[11px] text-amber-500 font-bold uppercase">
                      No venue partnerships yet.
                    </p>
                    <p className="text-[10px] text-text-tertiary/70 mt-0.5">
                      Contact venues to establish a partnership.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {partnerships.map((venue: any) => (
                      <button
                        key={venue.venueId}
                        type="button"
                        onClick={() =>
                          updateFormData({
                            venueId: venue.venueId,
                            venueName: venue.venueName,
                            venue: venue.venueName,
                          })
                        }
                        className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                          formData.venueId === venue.venueId
                            ? 'border-indigo-500 bg-indigo-500/5'
                            : 'border-border-subtle hover:border-indigo-500/30 bg-[#0e0e10]/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2
                            className={`w-3.5 h-3.5 flex-shrink-0 ${formData.venueId === venue.venueId ? 'text-indigo-500' : 'text-text-tertiary'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-black text-text-primary truncate">
                              {venue.venueName}
                            </p>
                            <p className="text-[10px] text-text-tertiary/70">
                              {venue.city || 'TBD'}
                            </p>
                          </div>
                        </div>
                        {formData.venueId === venue.venueId && (
                          <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-2.5 h-2.5 text-white"
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
                )}
                {validationErrors.venueId && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mt-1">
                    Selection Required
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
