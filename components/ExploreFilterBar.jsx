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
                        className="absolute left-0 top-full mt-4 min-w-[240px] overflow-hidden rounded-2xl border border-white/20 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] z-50"
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
                                        "flex w-full items-center justify-between px-4 py-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all duration-200",
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
        <div className="flex justify-center w-full px-4">
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="inline-flex items-center gap-1 p-1.5 rounded-full border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#111]/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-2xl"
            >
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

