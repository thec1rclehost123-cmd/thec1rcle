"use client";

import { Sparkles, Users, Building2 } from "lucide-react";

interface IdentityStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
    role: 'venue' | 'host';
    partnerships: any[];
    profile: any;
}

// Design System Input Component
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
                    <label className="text-label ml-1">{label}</label>
                    {hint && <span className="text-[10px] text-[#86868b] font-medium">{hint}</span>}
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

function AppleTextArea({
    label,
    className = "",
    hint,
    ...props
}: {
    label?: string;
    className?: string;
    hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <div className="space-y-1.5">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-label ml-1">{label}</label>
                    {hint && <span className="text-[10px] text-[#86868b] font-medium">{hint}</span>}
                </div>
            )}
            <textarea
                className={`input min-h-[100px] resize-none ${className}`}
                {...props}
            />
        </div>
    );
}

function AppleSelect({
    label,
    options,
    value,
    onChange,
}: {
    label?: string;
    options: { label: string; value: string }[];
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-label ml-1">{label}</label>}
            <select
                value={value}
                onChange={onChange}
                className="input appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8a29e%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_16px_center]"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
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
        <div className="space-y-8">
            {/* Event Identity */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Event Identity</h3>
                        <p className="text-caption">The headline information guests see first</p>
                    </div>
                </div>

                <AppleInput
                    label="Event Title"
                    placeholder="Give your event a memorable name"
                    value={formData.title}
                    onChange={(e) => updateFormData({ title: e.target.value })}
                    error={validationErrors.title}
                    className="text-stat-sm h-14"
                    autoCapitalize="words"
                    hint="Required"
                />

                <AppleInput
                    label="Subtitle / Tagline"
                    placeholder="Optional tagline or edition name"
                    value={formData.subtitle || ""}
                    onChange={(e) => updateFormData({ subtitle: e.target.value })}
                    className="h-12"
                    autoCapitalize="words"
                    hint="Optional"
                />

                <AppleTextArea
                    label="Description"
                    placeholder="Tell people what your event is about, who's performing, what to expect..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => updateFormData({ description: e.target.value })}
                    className="text-body-sm min-h-[140px]"
                    autoCapitalize="sentences"
                    hint="Recommended: 100+ characters"
                />

                <div className="grid grid-cols-2 gap-6">
                    <AppleSelect
                        label="Category"
                        options={['Music', 'Art', 'Fashion', 'Tech', 'Food & Drink', 'Nightlife', 'Festival', 'Private'].map(c => ({ label: c, value: c }))}
                        value={formData.category}
                        onChange={(e) => updateFormData({ category: e.target.value })}
                    />
                    <AppleSelect
                        label="City / Hub"
                        options={['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi', 'Hyderabad', 'Chennai'].map(c => ({ label: c, value: c }))}
                        value={formData.city}
                        onChange={(e) => updateFormData({ city: e.target.value })}
                    />
                </div>
            </div>

            {/* Host Identity */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Host Identity</h3>
                        <p className="text-caption">Who is organizing this event</p>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {(profile?.activeMembership?.partnerName || profile?.displayName || "H")[0]}
                        </div>
                        <div>
                            <p className="text-body font-semibold text-[#1d1d1f]">
                                {profile?.activeMembership?.partnerName || profile?.displayName || "Your Organization"}
                            </p>
                            <p className="text-caption">Event Host</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Venue Selection (Host Role Only) */}
            {role === 'host' && (
                <div className="card-elevated p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h3 className="text-headline-sm">Venue Partner</h3>
                            <p className="text-caption">Select your partnered venue for this event</p>
                        </div>
                    </div>

                    {partnerships.length === 0 ? (
                        <div className="p-6 rounded-xl bg-amber-50 border border-amber-100 text-center">
                            <p className="text-body text-amber-800 font-medium">No Active Venue Partnerships</p>
                            <p className="text-caption text-amber-700 mt-1">
                                Contact venues to establish a partnership before creating events.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {partnerships.map((venue: any) => (
                                <button
                                    key={venue.venueId}
                                    type="button"
                                    onClick={() => updateFormData({
                                        venueId: venue.venueId,
                                        venueName: venue.venueName,
                                        venue: venue.venueName
                                    })}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${formData.venueId === venue.venueId
                                            ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                                            : 'border-[#e5e5e7] hover:border-indigo-200 hover:bg-[#fafafa]'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-stone-500" />
                                            </div>
                                            <div>
                                                <p className="text-body font-semibold text-[#1d1d1f]">{venue.venueName}</p>
                                                <p className="text-caption">{venue.city || 'Location TBD'}</p>
                                            </div>
                                        </div>
                                        {formData.venueId === venue.venueId && (
                                            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <p className="text-[12px] text-red-600 font-medium ml-1">{validationErrors.venueId}</p>
                    )}
                </div>
            )}

            {/* Capacity */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Capacity</h3>
                        <p className="text-caption">Maximum expected guest count</p>
                    </div>
                </div>

                <AppleInput
                    label="Total Capacity"
                    type="number"
                    icon={Users}
                    placeholder="500"
                    value={formData.capacity}
                    onChange={(e) => updateFormData({ capacity: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                    hint="Used for ticket allocation"
                />
            </div>
        </div>
    );
}
