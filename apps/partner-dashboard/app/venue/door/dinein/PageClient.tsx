"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { UtensilsCrossed, Loader2, RefreshCw, Users } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useDoorHub } from "@/lib/context/DoorHubContext";
import { cn } from "@/lib/utils";
import type { DineinEntry, DineinListResponse } from "@/lib/types/doorSell";

export function DoorDineinClient() {
    const { profile } = useDashboardAuth();
    const hub = useDoorHub();
    const eventId = hub?.eventId ?? "";
    const venueId = hub?.venueId ?? "";

    const [entries, setEntries] = useState<DineinEntry[]>([]);
    const [totals, setTotals] = useState({ count: 0, partySize: 0 });
    const [loading, setLoading] = useState(false);

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    const fetchEntries = useCallback(async () => {
        if (!eventId || !venueId) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/venue/door/dinein?eventId=${eventId}&venueId=${venueId}&limit=50`,
                { headers: authHeaders() }
            );
            if (res.ok) {
                const d: DineinListResponse = await res.json();
                setEntries(d.entries ?? []);
                setTotals(d.totals ?? { count: 0, partySize: 0 });
            }
        } finally {
            setLoading(false);
        }
    }, [eventId, venueId, authHeaders]);

    useEffect(() => {
        setEntries([]);
        setTotals({ count: 0, partySize: 0 });
        if (eventId) fetchEntries();
    }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!eventId) {
        return (
            <div
                className="rounded-2xl border px-5 py-8 text-center"
                style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
            >
                <p className="text-[13px]" style={{ color: "var(--v-text-muted)" }}>
                    Select an event above to view dine-in entries
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-xl">
            {/* Totals strip */}
            <div
                className="rounded-2xl border px-5 py-4 flex items-center gap-6"
                style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
            >
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                        Tables
                    </p>
                    <p className="text-[24px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                        {totals.count}
                    </p>
                </div>
                <div className="w-px h-10 self-center" style={{ background: "var(--v-border)" }} />
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                        Total Guests
                    </p>
                    <p className="text-[24px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                        {totals.partySize}
                    </p>
                </div>
                <button
                    onClick={fetchEntries}
                    className="ml-auto p-2 rounded-lg hover:bg-[var(--v-elevated)] transition-colors"
                >
                    <RefreshCw size={14} className={cn("text-[var(--v-text-muted)]", loading && "animate-spin")} />
                </button>
            </div>

            {/* List */}
            <div
                className="rounded-2xl border overflow-hidden"
                style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
            >
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--v-border)" }}>
                    <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                        Dine-in Entries
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 px-5 py-8">
                        <Loader2 size={14} className="animate-spin text-[var(--v-text-muted)]" />
                        <span className="text-[13px] text-[var(--v-text-muted)]">Loading…</span>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="px-5 py-12 flex flex-col items-center gap-3 text-center">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background: "var(--v-elevated)" }}
                        >
                            <UtensilsCrossed size={20} className="text-[var(--v-text-muted)]" />
                        </div>
                        <p className="text-[13px]" style={{ color: "var(--v-text-muted)" }}>
                            No dine-in entries yet
                        </p>
                        <p className="text-[12px]" style={{ color: "var(--v-text-muted)" }}>
                            Use the Ticket Purchase tab to add dine-in guests
                        </p>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                        {/* Header row */}
                        <div
                            className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2"
                            style={{ background: "var(--v-elevated)" }}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>Name</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--v-text-muted)" }}>People</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--v-text-muted)" }}>Time</span>
                        </div>
                        {entries.map((entry, i) => (
                            <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-[var(--v-card-hover)] transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(251,191,36,0.1)" }}
                                    >
                                        <UtensilsCrossed size={14} className="text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--v-text-primary)" }}>
                                            {entry.guestName}
                                        </p>
                                        <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                                            Added by {entry.addedByName}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 justify-end">
                                    <Users size={12} className="text-[var(--v-text-muted)]" />
                                    <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {entry.partySize}
                                    </span>
                                </div>
                                <p className="text-[11px] tabular-nums text-right" style={{ color: "var(--v-text-muted)" }}>
                                    {new Date(entry.addedAt).toLocaleTimeString("en-IN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
