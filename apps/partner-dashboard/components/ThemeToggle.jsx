"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";

/**
 * Premium Theme Toggle Component
 * Supports: Light, Dark, and System preference
 */
export default function ThemeToggle({ variant = "switch" }) {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme, resolvedTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-16 h-9 rounded-full bg-[var(--surface-tertiary)] animate-pulse" />;
    }

    const isDark = resolvedTheme === "dark";

    // Switch variant - simple toggle
    if (variant === "switch") {
        return (
            <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="relative flex h-9 w-16 items-center rounded-full bg-[var(--surface-tertiary)] p-1 transition-all duration-300 hover:bg-[var(--surface-secondary)] border border-[var(--border-subtle)]"
                aria-label="Toggle Dark Mode"
            >
                <motion.div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-base)] shadow-md"
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{ x: isDark ? 28 : 0 }}
                >
                    <AnimatePresence mode="wait">
                        {isDark ? (
                            <motion.div
                                key="moon"
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Moon className="h-4 w-4 text-[var(--c1rcle-orange)]" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="sun"
                                initial={{ rotate: 90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: -90, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Sun className="h-4 w-4 text-amber-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </button>
        );
    }

    // Segmented variant - Light / System / Dark
    if (variant === "segmented") {
        const options = [
            { value: "light", icon: Sun, label: "Light" },
            { value: "system", icon: Monitor, label: "System" },
            { value: "dark", icon: Moon, label: "Dark" },
        ];

        return (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-tertiary)] border border-[var(--border-subtle)]">
                {options.map((option) => {
                    const Icon = option.icon;
                    const isActive = theme === option.value;

                    return (
                        <button
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                }`}
                            aria-label={option.label}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="theme-active-bg"
                                    className="absolute inset-0 bg-[var(--surface-base)] rounded-lg shadow-sm border border-[var(--border-subtle)]"
                                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                />
                            )}
                            <Icon className="relative z-10 h-4 w-4" />
                            <span className="relative z-10 hidden sm:inline">{option.label}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    // Dropdown variant
    if (variant === "dropdown") {
        const [open, setOpen] = useState(false);

        const options = [
            { value: "light", icon: Sun, label: "Light Mode" },
            { value: "dark", icon: Moon, label: "Dark Mode" },
            { value: "system", icon: Monitor, label: "System" },
        ];

        const currentOption = options.find(o => o.value === theme) || options[2];
        const CurrentIcon = currentOption.icon;

        return (
            <div className="relative">
                <button
                    onClick={() => setOpen(!open)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all"
                >
                    <CurrentIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentOption.label}</span>
                </button>

                <AnimatePresence>
                    {open && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpen(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-2 z-50 min-w-[160px] p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-lg"
                            >
                                {options.map((option) => {
                                    const Icon = option.icon;
                                    const isActive = theme === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setTheme(option.value);
                                                setOpen(false);
                                            }}
                                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                                ? "bg-[var(--c1rcle-orange-glow)] text-[var(--c1rcle-orange)]"
                                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
                                                }`}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {option.label}
                                            {isActive && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--c1rcle-orange)]" />
                                            )}
                                        </button>
                                    );
                                })}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return null;
}

/**
 * Compact icon-only toggle for tight spaces
 */
export function ThemeToggleCompact() {
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9 rounded-lg bg-[var(--surface-tertiary)] animate-pulse" />;
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-tertiary)] transition-all"
            aria-label="Toggle theme"
        >
            <AnimatePresence mode="wait">
                {isDark ? (
                    <motion.div
                        key="moon"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Moon className="h-4 w-4" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Sun className="h-4 w-4" />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );
}
