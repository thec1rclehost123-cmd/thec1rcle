"use client";

import { motion } from "framer-motion";
import {
    Shield,
    Info,
    CheckCircle2,
    AlertCircle,
    Clock,
    Users,
    Shirt,
    Baby,
    User,
    UserCheck
} from "lucide-react";

export default function VenuePoliciesSection({ venue }) {
    const rules = venue?.rules || [];
    const agePolicy = venue?.agePolicy || "all";
    const dressCode = venue?.dressCode || "Casual";
    const timings = venue?.timings || {};
    const capacity = venue?.capacity || {};

    const agePolicyIcon = {
        "all": <Baby className="w-5 h-5" />,
        "18+": <User className="w-5 h-5" />,
        "21+": <UserCheck className="w-5 h-5" />,
        "25+": <Users className="w-5 h-5" />,
    }[agePolicy] || <Shield className="w-5 h-5" />;

    return (
        <section className="py-32 bg-white dark:bg-[#0A0A0A] border-t border-black/5 dark:border-white/5 overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row gap-20">
                    {/* Left Side: Policies & Rules */}
                    <div className="flex-1 space-y-16">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-red-500/10 rounded-2xl">
                                    <Shield className="w-6 h-6 text-red-500" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tight text-black dark:text-white">Venue Rules & Entry</h2>
                            </div>
                            <p className="text-black/50 dark:text-white/50 text-sm max-w-lg mb-12">
                                Please adhere to the following guidelines to ensure a seamless experience for all guests. The management reserves the right of admission.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {rules.map((rule, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="flex items-start gap-4 p-5 bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl border border-black/5 dark:border-white/5"
                                    >
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <p className="text-sm font-medium text-black dark:text-white leading-relaxed">
                                            {rule}
                                        </p>
                                    </motion.div>
                                ))}
                                {rules.length === 0 && (
                                    <p className="text-black/30 dark:text-white/30 text-xs italic italic">No specific house rules listed.</p>
                                )}
                            </div>
                        </div>

                        {/* Timing Section */}
                        {Object.keys(timings).length > 0 && (
                            <div className="pt-8">
                                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-black/40 dark:text-white/40 mb-8">Hours of Operation</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                    {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                                        <div key={day} className={`p-4 rounded-2xl border text-center transition-all ${new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase() === day
                                                ? "bg-red-500/5 border-red-500/20 shadow-sm"
                                                : "bg-black/[0.01] dark:bg-white/[0.01] border-black/5 dark:border-white/5"
                                            }`}>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase() === day
                                                    ? "text-red-500"
                                                    : "text-black/30 dark:text-white/30"
                                                }`}>{day}</p>
                                            <p className="text-[11px] font-bold text-black dark:text-white truncate">
                                                {timings[day] || "Closed"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Quick Info Cards */}
                    <div className="w-full md:w-80 space-y-4">
                        {/* Age Restriction */}
                        <div className="p-8 bg-black dark:bg-[#111] rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors" />
                            <div className="relative">
                                <div className="p-3 bg-white/5 rounded-2xl w-fit mb-6">
                                    {agePolicyIcon}
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Age Restriction</h4>
                                <p className="text-3xl font-black text-white">{agePolicy === 'all' ? 'Family Friendly' : agePolicy}</p>
                                <p className="text-[11px] text-white/50 mt-4 leading-relaxed">
                                    Valid physical identification is mandatory for entry. Digital copies may not be accepted.
                                </p>
                            </div>
                        </div>

                        {/* Dress Code */}
                        <div className="p-8 bg-black dark:bg-[#111] rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors" />
                            <div className="relative">
                                <div className="p-3 bg-white/5 rounded-2xl w-fit mb-6">
                                    <Shirt className="w-5 h-5 text-purple-400" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Dress Code</h4>
                                <p className="text-3xl font-black text-white">{dressCode}</p>
                                <p className="text-[11px] text-white/50 mt-4 leading-relaxed">
                                    {venue?.dressCodeDescription || "Elegance is expected. Avoid sportswear or casual slippers."}
                                </p>
                            </div>
                        </div>

                        {/* Capacity Info */}
                        {capacity?.total && (
                            <div className="p-6 bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl border border-black/5 dark:border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-1">Total Capacity</h4>
                                        <p className="text-xl font-black text-black dark:text-white">{capacity.total} Guests</p>
                                    </div>
                                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                                        <Users className="w-4 h-4 text-emerald-500" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
                            <div className="flex gap-4">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Pro Tip</h4>
                                    <p className="text-[10px] font-medium text-amber-700/70 leading-relaxed">
                                        Arrive early for better seating options and to avoid long entry queues during peak hours.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
