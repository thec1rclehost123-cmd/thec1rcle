
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Check } from "lucide-react";
import { countries } from "../../lib/data/countries";
import clsx from "clsx";

export default function CountrySelect({ value, onChange, disabled }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef(null);

    const selectedCountry = countries.find(c => c.code === value) || countries.find(c => c.code === "IN"); // Default to India

    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search)
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Region of Origin</label>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold tracking-widest text-white transition-all hover:bg-white/[0.06] focus:outline-none focus:border-orange/50",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">{selectedCountry?.flag}</span>
                    <span className="truncate">{selectedCountry?.name} ({selectedCountry?.dialCode})</span>
                </div>
                <ChevronDown className={clsx("w-4 h-4 text-white/40 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-50 mt-2 w-full bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-3xl"
                    >
                        <div className="p-4 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="SEARCH JURISDICTION..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-white/5 rounded-xl pl-10 pr-4 py-3 text-xs font-bold tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-orange/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {filteredCountries.map((country) => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => {
                                        onChange(country.code);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors",
                                        country.code === value && "bg-white/[0.08]"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl">{country.flag}</span>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white tracking-widest">{country.name}</span>
                                            <span className="text-[10px] font-bold text-white/30 tracking-widest">{country.dialCode}</span>
                                        </div>
                                    </div>
                                    {country.code === value && <Check className="w-4 h-4 text-orange" />}
                                </button>
                            ))}
                            {filteredCountries.length === 0 && (
                                <div className="p-8 text-center">
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">No jurisdiction found</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
