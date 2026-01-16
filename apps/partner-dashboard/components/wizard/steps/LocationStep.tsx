"use client";

import { MapPin, Building2, ArrowRight } from "lucide-react";

interface LocationStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
    role: 'venue' | 'host';
}

function AppleInput({
    label,
    error,
    className = "",
    icon: Icon,
    hint,
    suffix,
    ...props
}: {
    label?: string;
    error?: string;
    className?: string;
    icon?: any;
    hint?: string;
    suffix?: React.ReactNode;
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
                    className={`input ${error ? 'input-error' : ''} ${Icon ? 'pl-11' : 'pl-4'} ${suffix ? 'pr-12' : 'pr-4'} ${className}`}
                    {...props}
                />
                {suffix && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {suffix}
                    </div>
                )}
            </div>
            {error && (
                <p className="text-[12px] text-red-600 font-medium ml-1 animate-slide-up">{error}</p>
            )}
        </div>
    );
}

function AppleSelect({
    label,
    options,
    value,
    onChange,
    hint
}: {
    label?: string;
    options: { label: string; value: string }[];
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    hint?: string;
}) {
    return (
        <div className="space-y-1.5">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-label ml-1">{label}</label>
                    {hint && <span className="text-[10px] text-[#86868b] font-medium">{hint}</span>}
                </div>
            )}
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

export function LocationStep({
    formData,
    updateFormData,
    validationErrors,
    role
}: LocationStepProps) {
    return (
        <div className="space-y-8">
            {/* Display Venue Name */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Venue Display Name</h3>
                        <p className="text-caption">How the venue appears to guests</p>
                    </div>
                </div>

                <AppleInput
                    label="Display Name"
                    icon={Building2}
                    placeholder="e.g., The Grand Ballroom, Rooftop Terrace"
                    value={formData.venueName}
                    onChange={(e) => updateFormData({ venueName: e.target.value })}
                    disabled={role === 'host' && formData.venueId}
                    autoCapitalize="words"
                    hint={role === 'host' ? "From partnership" : "Required"}
                />

                {role === 'host' && formData.venueId && (
                    <p className="text-caption text-[#86868b]">
                        Venue name is set by your partnership agreement. Contact the venue to request changes.
                    </p>
                )}
            </div>

            {/* Physical Location */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Location Details</h3>
                        <p className="text-caption">Address and navigation information</p>
                    </div>
                </div>

                <AppleInput
                    label="Full Address"
                    icon={MapPin}
                    placeholder="Street address, building name, floor/unit"
                    value={formData.address}
                    onChange={(e) => updateFormData({ address: e.target.value })}
                    autoCapitalize="words"
                    hint="For guest navigation"
                />

                <div className="grid grid-cols-2 gap-6">
                    <AppleSelect
                        label="City"
                        options={['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur', 'Ahmedabad'].map(c => ({ label: c, value: c }))}
                        value={formData.city}
                        onChange={(e) => updateFormData({ city: e.target.value })}
                    />
                    <AppleInput
                        label="Pincode"
                        placeholder="411001"
                        value={formData.pincode}
                        onChange={(e) => updateFormData({ pincode: e.target.value })}
                    />
                </div>

                <AppleInput
                    label="Google Maps Link"
                    placeholder="https://maps.google.com/..."
                    value={formData.mapsLink}
                    onChange={(e) => updateFormData({ mapsLink: e.target.value })}
                    hint="Helps guests navigate"
                    suffix={
                        formData.mapsLink && (
                            <button
                                type="button"
                                className="btn btn-icon-sm btn-ghost"
                                onClick={() => window.open(formData.mapsLink, '_blank')}
                                title="Test Link"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )
                    }
                />

                {/* Location Preview */}
                {formData.address && formData.city && (
                    <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7]">
                        <p className="text-label mb-2">Location Preview</p>
                        <p className="text-body font-medium text-[#1d1d1f]">{formData.venueName || 'Venue'}</p>
                        <p className="text-body-sm text-[#86868b]">{formData.address}</p>
                        <p className="text-body-sm text-[#86868b]">{formData.city}{formData.pincode ? ` - ${formData.pincode}` : ''}</p>
                    </div>
                )}
            </div>

            {/* Additional Venue Instructions */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Arrival Instructions</h3>
                        <p className="text-caption">Optional guidance for guests on arrival</p>
                    </div>
                </div>

                <textarea
                    placeholder="e.g., Enter through the main lobby, take elevator to 5th floor. Parking available in basement level B2."
                    value={formData.arrivalInstructions || ""}
                    onChange={(e) => updateFormData({ arrivalInstructions: e.target.value })}
                    className="input min-h-[100px] resize-none"
                />
            </div>
        </div>
    );
}
