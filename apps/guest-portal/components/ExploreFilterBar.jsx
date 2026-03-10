"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

// ── Recent-search helpers ───────────────────────────────────────────────────
const RECENT_KEY = "c1rcle:recent-searches";
const MAX_RECENT = 5;

function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveRecentSearch(term) {
    if (!term.trim()) return;
    try {
        const stored = getRecentSearches();
        const updated = [term.trim(), ...stored.filter((s) => s !== term.trim())].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch { /* storage unavailable */ }
}

// ── SearchInput ─────────────────────────────────────────────────────────────
const pillVariants = {
    hidden: { opacity: 0, y: -6, scale: 0.9 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { delay: i * 0.055, duration: 0.2, ease: "easeOut" },
    }),
    exit: { opacity: 0, y: -4, scale: 0.9, transition: { duration: 0.12 } },
};

function SearchInput({ value, onChange }) {
    const [focused, setFocused] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);
    const containerRef = useRef(null);

    // Load from localStorage after mount (SSR-safe)
    useEffect(() => {
        setRecentSearches(getRecentSearches());
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setFocused(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const handleFocus = () => {
        setRecentSearches(getRecentSearches()); // refresh on every open
        setFocused(true);
    };

    const handleSelect = (term) => {
        onChange(term);
        saveRecentSearch(term);
        setRecentSearches(getRecentSearches());
        setFocused(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && value.trim()) {
            saveRecentSearch(value.trim());
            setRecentSearches(getRecentSearches());
            setFocused(false);
        }
        if (e.key === "Escape") setFocused(false);
    };

    const showRecents = focused && recentSearches.length > 0 && !value.trim();

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2 px-4 py-2.5">
                {/* Search icon */}
                <svg
                    className="w-3.5 h-3.5 text-black/40 dark:text-white/40 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder="Search"
                    className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 outline-none w-20 md:w-28"
                />
            </div>

            {/* Recent searches dropdown */}
            <AnimatePresence>
                {showRecents && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 top-full mt-3 min-w-[220px] overflow-hidden rounded-2xl border border-black/10 dark:border-white/20 bg-white/95 dark:bg-[#0A0A0A]/90 backdrop-blur-3xl shadow-xl z-50 p-3"
                    >
                        <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-2 px-1">
                            Recent
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {recentSearches.map((term, i) => (
                                <motion.button
                                    key={term}
                                    custom={i}
                                    variants={pillVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    onClick={() => handleSelect(term)}
                                    className="px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-black/70 dark:text-white/70 hover:bg-[#F44A22] hover:text-white hover:border-[#F44A22] transition-colors duration-200"
                                >
                                    {term}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── FilterPill ───────────────────────────────────────────────────────────────
function FilterPill({ label, value, options, onChange, icon: Icon }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isActive = value !== label;

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "group flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-full transition-all duration-300",
                    isActive
                        ? "text-white bg-[#F44A22] shadow-[0_0_20px_rgba(244,74,34,0.3)]"
                        : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                )}
            >
                {Icon && <Icon className="w-4 h-4" />}
                <span className="uppercase tracking-widest text-[10px]">{value || label}</span>
                <svg
                    className={clsx("w-3 h-3 transition-transform duration-300 opacity-50 group-hover:opacity-100", isOpen && "rotate-180")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 top-full mt-4 min-w-[240px] overflow-hidden rounded-2xl border border-black/10 dark:border-white/20 bg-white/95 dark:bg-[#0A0A0A]/90 backdrop-blur-3xl shadow-xl z-50"
                    >
                        <div className="p-2 space-y-1">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "flex w-full items-center justify-between px-4 py-3 rounded-xl text-left text-[10px] font-black uppercase tracking-widest transition-all duration-200",
                                        value === option.label
                                            ? "bg-black/5 dark:bg-white/10 text-black dark:text-white"
                                            : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                                    )}
                                >
                                    <span>{option.label}</span>
                                    {value === option.label && (
                                        <motion.div
                                            layoutId="activeCheck"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="text-[#F44A22]"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </motion.div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── ExploreFilterBar ─────────────────────────────────────────────────────────
export default function ExploreFilterBar({
    sort,
    setSort,
    date,
    setDate,
    city,
    setCity,
    cityOptions = [],
    searchTerm = "",
    setSearchTerm,
}) {
    const sortOptions = [
        { label: "Trending", value: "heat" },
        { label: "Newest", value: "new" },
        { label: "Soonest", value: "soonest" },
        { label: "Price: Low to High", value: "price" },
    ];

    const dateOptions = [
        { label: "Any Date", value: "all" },
        { label: "Today", value: "today" },
        { label: "Tomorrow", value: "tomorrow" },
        { label: "This Week", value: "week" },
        { label: "This Weekend", value: "weekend" },
    ];

    return (
        <div className="flex justify-center w-full px-4">
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="inline-flex items-center gap-1 p-1.5 rounded-full border border-black/5 dark:border-white/10 bg-white/50 dark:bg-black/50 shadow-sm dark:shadow-glow backdrop-blur-2xl"
            >
                {setSearchTerm && (
                    <>
                        <SearchInput value={searchTerm} onChange={setSearchTerm} />
                        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />
                    </>
                )}
                <FilterPill
                    label="Sort"
                    value={sortOptions.find(o => o.value === sort)?.label}
                    options={sortOptions}
                    onChange={setSort}
                />
                <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />
                <FilterPill
                    label="Date"
                    value={dateOptions.find(o => o.value === date)?.label}
                    options={dateOptions}
                    onChange={setDate}
                />
                <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />
                <FilterPill
                    label="City"
                    value={cityOptions.find(o => o.value === city)?.label || city}
                    options={cityOptions}
                    onChange={setCity}
                />
            </motion.div>
        </div>
    );
}
