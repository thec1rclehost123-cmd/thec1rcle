"use client";

import { motion } from "framer-motion";
import { User, Users, UserPlus } from "lucide-react";

const GENDER_OPTIONS = [
    { id: "male", label: "Male", icon: User },
    { id: "female", label: "Female", icon: UserPlus },
    { id: "other", label: "Other", icon: Users },
];

export default function GenderSelector({ value, onChange, error, disabled }) {
    return (
        <div className="space-y-3 w-full">
            <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] uppercase tracking-[0.3em] text-orange font-black">
                    Your Identity
                </label>
                {error && (
                    <motion.span
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[9px] uppercase tracking-widest text-orange font-bold"
                    >
                        Required
                    </motion.span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {GENDER_OPTIONS.map((option) => {
                    const isSelected = value === option.id;
                    const Icon = option.icon;

                    return (
                        <motion.button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(option.id)}
                            whileHover={!disabled ? { y: -2, scale: 1.02, transition: { duration: 0.2 } } : {}}
                            whileTap={!disabled ? { scale: 0.98 } : {}}
                            className={`
                                relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300
                                ${isSelected
                                    ? "bg-orange/10 border-orange shadow-[0_0_20px_rgba(244,74,34,0.2)]"
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"}
                                ${error && !isSelected ? "border-orange/20" : ""}
                                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                            `}
                            aria-pressed={isSelected}
                            aria-label={`Select gender: ${option.label}`}
                        >
                            {/* Selected State Aura Blur */}
                            {isSelected && (
                                <motion.div
                                    layoutId="gender-aura"
                                    className="absolute inset-0 bg-orange/5 blur-xl rounded-2xl -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}

                            {/* Selection Ring */}
                            {isSelected && (
                                <motion.div
                                    layoutId="gender-ring"
                                    className="absolute inset-0 border-2 border-orange rounded-2xl"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}

                            <Icon className={`w-4 h-4 ${isSelected ? "text-orange" : "text-white/40"}`} />
                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isSelected ? "text-white" : "text-white/40"}`}>
                                {option.label}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-orange/80 mt-2 ml-1"
                >
                    {error}
                </motion.p>
            )}
        </div>
    );
}
