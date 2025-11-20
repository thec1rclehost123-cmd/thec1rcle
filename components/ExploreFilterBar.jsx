"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

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

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
                {Icon && <Icon className="w-4 h-4" />}
                <span className="capitalize">{value || label}</span>
                <svg
                    className={clsx("w-3 h-3 transition-transform duration-200", isOpen && "rotate-180")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 min-w-[160px] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl z-50"
                    >
                        <div className="py-1">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5",
                                        value === option.value ? "text-white font-medium bg-white/5" : "text-white/60"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function ExploreFilterBar({
    sort,
    setSort,
    date,
    setDate,
    city,
    setCity,
    cityOptions = []
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
        <div className="flex justify-center w-full mb-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-[#111] p-1 shadow-2xl backdrop-blur-xl">
                <FilterPill
                    label="Sort"
                    value={sortOptions.find(o => o.value === sort)?.label}
                    options={sortOptions}
                    onChange={setSort}
                />
                <div className="h-4 w-[1px] bg-white/10" />
                <FilterPill
                    label="Date"
                    value={dateOptions.find(o => o.value === date)?.label}
                    options={dateOptions}
                    onChange={setDate}
                />
                <div className="h-4 w-[1px] bg-white/10" />
                <FilterPill
                    label="City"
                    value={`in ${cityOptions.find(o => o.value === city)?.label || city}`}
                    options={cityOptions}
                    onChange={setCity}
                />
            </div>
        </div>
    );
}
