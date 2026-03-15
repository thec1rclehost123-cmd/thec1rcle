"use client";

import { Users, Building2 } from "lucide-react";

interface IdentityStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
    role: 'venue' | 'host';
    partnerships: any[];
    profile: any;
}

export function IdentityStep({
    formData,
    updateFormData,
    validationErrors,
    role,
    partnerships,
    profile
}: IdentityStepProps) {
    return (
        <div className="grid grid-cols-[1fr_256px] gap-5">
            {/* ─── Left: Event Identity ─── */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Event Identity</span>
                </div>

                {/* Event Title — bare border-bottom input */}
                <div>
                    <input
                        type="text"
                        placeholder="Give your event a memorable name"
                        value={formData.title}
                        onChange={(e) => updateFormData({ title: e.target.value })}
                        className="w-full px-0 py-1.5 text-[22px] font-black bg-transparent border-b-2 border-border-default focus:outline-none focus:border-indigo-500 placeholder:text-text-tertiary/30 transition-colors leading-tight"
                        autoCapitalize="words"
                    />
                    {validationErrors.title && (
                        <p className="text-[11px] text-red-500 mt-1">{validationErrors.title}</p>
                    )}
                </div>

                {/* Subtitle */}
                <input
                    type="text"
                    placeholder="Subtitle / Tagline (optional)"
                    value={formData.subtitle || ""}
                    onChange={(e) => updateFormData({ subtitle: e.target.value })}
                    className="w-full px-0 py-1 text-[14px] text-text-secondary bg-transparent border-b border-border-subtle focus:outline-none focus:border-indigo-300 placeholder:text-text-tertiary/40 transition-colors"
                    autoCapitalize="words"
                />

                {/* Description */}
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1.5">
                        Description
                    </label>
                    <textarea
                        placeholder="Tell people what your event is about, who's performing, what to expect..."
                        value={formData.description}
                        onChange={(e) => updateFormData({ description: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] placeholder:text-text-tertiary/50 focus:outline-none focus:border-indigo-400 resize-none transition-all"
                        style={{ height: '120px' }}
                        autoCapitalize="sentences"
                    />
                </div>

                {/* Category + City row */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1.5">
                            Category
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => updateFormData({ category: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] text-text-primary focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer"
                        >
                            {['Music', 'Art', 'Fashion', 'Tech', 'Food & Drink', 'Nightlife', 'Festival', 'Private'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1.5">
                            City / Hub
                        </label>
                        <select
                            value={formData.city}
                            onChange={(e) => updateFormData({ city: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] text-text-primary focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer"
                        >
                            {['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi', 'Hyderabad', 'Chennai'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ─── Right: Capacity + Host + Venue ─── */}
            <div className="space-y-3">
                {/* Capacity */}
                <div className="p-3 rounded-xl bg-surface-secondary border border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Capacity</span>
                    </div>
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                        <input
                            type="number"
                            placeholder="500"
                            value={formData.capacity}
                            onChange={(e) => updateFormData({ capacity: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                            className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface-base border border-border-subtle text-[14px] font-bold text-text-primary focus:outline-none focus:border-orange-400 transition-all"
                        />
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-1.5">Max expected guests</p>
                </div>

                {/* Host Identity */}
                <div className="p-3 rounded-xl bg-surface-secondary border border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Host</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {(profile?.activeMembership?.partnerName || profile?.displayName || "H")[0]}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] font-bold text-text-primary leading-tight truncate">
                                {profile?.activeMembership?.partnerName || profile?.displayName || "Your Organization"}
                            </p>
                            <p className="text-[10px] text-text-tertiary">Event Host</p>
                        </div>
                    </div>
                </div>

                {/* Venue Identity / Selection */}
                {role === 'venue' ? (
                    <div className="p-3 rounded-xl bg-surface-secondary border border-border-subtle">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Venue</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-text-primary truncate">
                                    {profile?.activeMembership?.partnerName || "Your Venue"}
                                </p>
                                <p className="text-[10px] text-text-tertiary">
                                    {profile?.activeMembership?.city || formData.city || "Primary Facility"}
                                </p>
                            </div>
                            <div className="px-2 py-0.5 rounded-full bg-green-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-600 flex-shrink-0">
                                Auto
                            </div>
                        </div>
                        <p className="text-[10px] text-text-tertiary mt-2">Your facility is auto-linked.</p>
                    </div>
                ) : (
                    <div className="p-3 rounded-xl bg-surface-secondary border border-border-subtle">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Venue Partner</span>
                        </div>
                        {partnerships.length === 0 ? (
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
                                <p className="text-[11px] text-amber-800 font-medium">No venue partnerships yet.</p>
                                <p className="text-[10px] text-amber-700 mt-0.5">Contact venues to establish a partnership.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {partnerships.map((venue: any) => (
                                    <button
                                        key={venue.venueId}
                                        type="button"
                                        onClick={() => updateFormData({
                                            venueId: venue.venueId,
                                            venueName: venue.venueName,
                                            venue: venue.venueName
                                        })}
                                        className={`w-full p-2.5 rounded-lg border-2 text-left transition-all ${formData.venueId === venue.venueId
                                            ? 'border-indigo-500 bg-indigo-500/5'
                                            : 'border-border-subtle hover:border-indigo-500/30 hover:bg-surface-base'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-semibold text-text-primary truncate">{venue.venueName}</p>
                                                <p className="text-[10px] text-text-tertiary">{venue.city || 'TBD'}</p>
                                            </div>
                                            {formData.venueId === venue.venueId && (
                                                <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {validationErrors.venueId && (
                            <p className="text-[11px] text-red-500 mt-1.5">{validationErrors.venueId}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
