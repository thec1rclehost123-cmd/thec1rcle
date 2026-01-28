"use client";

import { useState } from "react";
import {
    Shield,
    Clock,
    Users,
    ShirtIcon,
    Baby,
    User,
    UserCheck,
    Info,
    Plus,
    Trash2,
    CheckCircle2
} from "lucide-react";

interface PoliciesSectionProps {
    venue: any;
    onUpdate: (updates: any) => Promise<void>;
}

const AGE_POLICIES = [
    { value: "all", label: "All Ages", description: "No age restrictions", icon: Baby },
    { value: "18+", label: "18+ Only", description: "Valid ID required", icon: User },
    { value: "21+", label: "21+ Only", description: "Valid ID required", icon: UserCheck },
    { value: "25+", label: "25+ Only", description: "Premium crowd policy", icon: Users },
];

const DRESS_CODE_OPTIONS = [
    "Casual",
    "Smart Casual",
    "Business Casual",
    "Formal",
    "Black Tie Optional",
    "Cocktail Attire",
    "No Sportswear",
    "No Slippers",
    "All Black",
    "White Party",
    "Theme-Based"
];

const DAYS_OF_WEEK = [
    { key: "mon", label: "Mon" },
    { key: "tue", label: "Tue" },
    { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" },
    { key: "fri", label: "Fri" },
    { key: "sat", label: "Sat" },
    { key: "sun", label: "Sun" },
];

export default function PoliciesSection({ venue, onUpdate }: PoliciesSectionProps) {
    const [newRule, setNewRule] = useState("");

    const handleAddRule = () => {
        if (!newRule.trim()) return;
        const currentRules = venue?.rules || [];
        onUpdate({ rules: [...currentRules, newRule.trim()] });
        setNewRule("");
    };

    const handleRemoveRule = (idx: number) => {
        const currentRules = venue?.rules || [];
        onUpdate({ rules: currentRules.filter((_: any, i: number) => i !== idx) });
    };

    const handleTimingUpdate = (day: string, value: string) => {
        const currentTimings = venue?.timings || {};
        onUpdate({
            timings: {
                ...currentTimings,
                [day]: value
            }
        });
    };

    return (
        <div className="space-y-12">
            {/* Age Policy */}
            <section className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Age Policy</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Set age restrictions for entry</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {AGE_POLICIES.map((policy) => {
                        const Icon = policy.icon;
                        const isSelected = venue?.agePolicy === policy.value;
                        return (
                            <button
                                key={policy.value}
                                onClick={() => onUpdate({ agePolicy: policy.value })}
                                className={`p-5 rounded-2xl border-2 transition-all text-left ${isSelected
                                    ? "bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/20"
                                    : "bg-[var(--surface-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                                    }`}
                            >
                                <div className={`p-2.5 rounded-xl mb-3 w-fit ${isSelected ? "bg-blue-500/20" : "bg-[var(--surface-elevated)]"}`}>
                                    <Icon className={`w-5 h-5 ${isSelected ? "text-blue-500" : "text-[var(--text-tertiary)]"}`} />
                                </div>
                                <p className={`text-sm font-bold mb-1 ${isSelected ? "text-blue-600" : "text-[var(--text-primary)]"}`}>
                                    {policy.label}
                                </p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">{policy.description}</p>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Dress Code */}
            <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-violet-500/10 rounded-xl">
                        <ShirtIcon className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Dress Code</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Set expectations for guest attire</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {DRESS_CODE_OPTIONS.map((code) => (
                        <button
                            key={code}
                            onClick={() => onUpdate({ dressCode: code })}
                            className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all ${venue?.dressCode === code
                                ? "bg-violet-500 text-white"
                                : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]"
                                }`}
                        >
                            {code}
                        </button>
                    ))}
                </div>

                {/* Custom Dress Code */}
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Custom Dress Code Description</label>
                    <textarea
                        value={venue?.dressCodeDescription || ""}
                        onChange={(e) => onUpdate({ dressCodeDescription: e.target.value })}
                        placeholder="e.g., No sportswear, slippers or shorts. Smart casual preferred."
                        className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
                    />
                </div>
            </section>

            {/* Hours of Operation */}
            <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl">
                        <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Hours of Operation</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Set your weekly operating schedule</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {DAYS_OF_WEEK.map((day) => (
                        <div key={day.key} className="flex items-center gap-4 p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)]">
                            <div className="w-12 text-center">
                                <span className="text-sm font-bold text-[var(--text-primary)]">{day.label}</span>
                            </div>
                            <input
                                type="text"
                                value={venue?.timings?.[day.key] || ""}
                                onChange={(e) => handleTimingUpdate(day.key, e.target.value)}
                                placeholder="e.g., 7PM - 1AM or Closed"
                                className="flex-1 px-4 py-2 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none"
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* House Rules */}
            <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-red-500/10 rounded-xl">
                        <Shield className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">House Rules</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Entry policies and venue guidelines</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {(venue?.rules || []).map((rule: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] group">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="flex-1 text-sm text-[var(--text-primary)]">{rule}</span>
                            <button
                                onClick={() => handleRemoveRule(idx)}
                                className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {/* Add Rule */}
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newRule}
                            onChange={(e) => setNewRule(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                            placeholder="Add a new rule..."
                            className="flex-1 px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10"
                        />
                        <button
                            onClick={handleAddRule}
                            disabled={!newRule.trim()}
                            className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-xl text-[11px] font-bold hover:bg-red-400 transition-all disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Preset Rules */}
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Common Rules</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            "Valid ID required",
                            "No outside food or drinks",
                            "Management reserves right to admission",
                            "No cameras or recording",
                            "Couples/Stag ratio applies",
                            "Guestlist closes at 11 PM"
                        ].map((presetRule) => (
                            <button
                                key={presetRule}
                                onClick={() => {
                                    if (!venue?.rules?.includes(presetRule)) {
                                        onUpdate({ rules: [...(venue?.rules || []), presetRule] });
                                    }
                                }}
                                disabled={venue?.rules?.includes(presetRule)}
                                className="px-3 py-2 bg-[var(--surface-secondary)] text-[var(--text-tertiary)] rounded-lg text-[10px] font-bold border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                + {presetRule}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Capacity */}
            <section className="space-y-6 pt-8 border-t border-[var(--border-subtle)]">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                        <Users className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Venue Capacity</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Maximum guest capacity (optional)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Total Capacity</label>
                        <input
                            type="number"
                            value={venue?.capacity?.total || ""}
                            onChange={(e) => onUpdate({ capacity: { ...venue?.capacity, total: parseInt(e.target.value) || null } })}
                            placeholder="e.g., 500"
                            className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Standing</label>
                        <input
                            type="number"
                            value={venue?.capacity?.standing || ""}
                            onChange={(e) => onUpdate({ capacity: { ...venue?.capacity, standing: parseInt(e.target.value) || null } })}
                            placeholder="e.g., 400"
                            className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Seated</label>
                        <input
                            type="number"
                            value={venue?.capacity?.seated || ""}
                            onChange={(e) => onUpdate({ capacity: { ...venue?.capacity, seated: parseInt(e.target.value) || null } })}
                            placeholder="e.g., 150"
                            className="w-full px-4 py-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
