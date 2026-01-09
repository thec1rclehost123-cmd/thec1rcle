
"use client";

import { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { countries } from "../../lib/data/countries";
import clsx from "clsx";

export default function PhoneInput({ value, onChange, countryCode, onCountryChange, disabled, errorText }) {
    const [detecting, setDetecting] = useState(false);
    const selectedCountry = countries.find(c => c.code === countryCode) || countries.find(c => c.code === "IN");

    const handleLocation = async () => {
        setDetecting(true);
        try {
            const res = await fetch("https://ipapi.co/json/");
            const data = await res.json();
            if (data.country_code) {
                onCountryChange(data.country_code);
            }
        } catch (err) {
            console.error("Failed to detect location", err);
        } finally {
            setDetecting(false);
        }
    };

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, "");
        // Basic length limitation based on common rules (can be refined)
        if (val.length <= 15) {
            onChange(val);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">Mobile Access Code</label>
                <button
                    type="button"
                    onClick={handleLocation}
                    disabled={disabled || detecting}
                    className="text-[9px] font-black uppercase tracking-widest text-orange flex items-center gap-1.5 hover:opacity-80 transition-opacity disabled:opacity-50 mb-1"
                >
                    {detecting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <MapPin className="w-3 h-3" />
                    )}
                    Use my Location
                </button>
            </div>

            <div className="group relative">
                <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-orange/50">
                    <span className="text-sm font-bold tracking-widest text-white/40 shrink-0">
                        {selectedCountry?.dialCode}
                    </span>
                    <input
                        type="tel"
                        required
                        disabled={disabled}
                        value={value}
                        onChange={handlePhoneChange}
                        placeholder="ENTER DIGITS..."
                        className="w-full bg-transparent text-sm font-bold tracking-[0.2em] text-white placeholder:text-white/40 focus:outline-none"
                    />
                </div>
            </div>
            {errorText && (
                <p className="text-[10px] font-bold text-orange uppercase tracking-widest mt-2">{errorText}</p>
            )}
        </div>
    );
}
