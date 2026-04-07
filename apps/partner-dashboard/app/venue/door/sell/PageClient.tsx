"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, CheckCircle2, AlertTriangle, Loader2,
    UserCheck, UtensilsCrossed, RefreshCw,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useDoorHub } from "@/lib/context/DoorHubContext";
import { cn } from "@/lib/utils";
import type { EventCapacity, DoorGender, DoorPurpose } from "@/lib/types/doorSell";
import type { WalkInEntry } from "@/lib/types/walkIns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function idempotencyKey(uid: string) {
    return `door-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Capacity Bar ──────────────────────────────────────────────────────────────

function CapacityBar({ cap }: { cap: EventCapacity | null }) {
    if (!cap) return null;

    // No capacity configured — show unlimited
    if (cap.total === 0) {
        return (
            <div
                className="rounded-2xl border px-5 py-4 flex items-center gap-3"
                style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
            >
                <Users size={16} className="text-[var(--v-text-muted)] shrink-0" />
                <span className="text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                    No capacity limit configured for this event
                </span>
            </div>
        );
    }

    const pct = Math.min(100, ((cap.soldCount + cap.doorWalkInCount) / cap.total) * 100);
    const isNear = cap.available <= Math.ceil(cap.total * 0.1) && !cap.isSoldOut;
    const barColor = cap.isSoldOut ? "#F87171" : isNear ? "#FBBF24" : "#34D399";

    return (
        <div
            className="rounded-2xl border px-5 py-4 space-y-3"
            style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={14} className="text-[var(--v-text-muted)]" />
                    <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                        Capacity
                    </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                        {cap.soldCount + cap.doorWalkInCount}
                        <span className="text-[var(--v-text-muted)] font-normal"> / {cap.total}</span>
                    </span>
                    {cap.isSoldOut ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-red-500/10 text-red-400">
                            Sold Out
                        </span>
                    ) : (
                        <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums"
                            style={{
                                background: isNear ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.1)",
                                color: isNear ? "#FBBF24" : "#34D399",
                            }}
                        >
                            {cap.available} left
                        </span>
                    )}
                </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--v-elevated)" }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: barColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                />
            </div>
            {isNear && (
                <p className="text-[12px] font-medium text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Near capacity — {cap.available} spot{cap.available !== 1 ? "s" : ""} remaining
                </p>
            )}
        </div>
    );
}

// ── Flash feedback ─────────────────────────────────────────────────────────────

type FlashState = { type: "success" | "error"; message: string } | null;

// ── Main Component ─────────────────────────────────────────────────────────────

export function DoorSellClient() {
    const { profile } = useDashboardAuth();
    const hub = useDoorHub();
    const eventId = hub?.eventId ?? "";
    const venueId = hub?.venueId ?? "";

    const nameRef = useRef<HTMLInputElement>(null);

    // ── Form state ────────────────────────────────────────────────────────────
    const [guestName, setGuestName] = useState("");
    const [partySize, setPartySize] = useState(1);
    const [gender, setGender] = useState<DoorGender | null>(null);
    const [purpose, setPurpose] = useState<DoorPurpose | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [flash, setFlash] = useState<FlashState>(null);

    // ── Capacity ──────────────────────────────────────────────────────────────
    const [capacity, setCapacity] = useState<EventCapacity | null>(null);
    const [capLoading, setCapLoading] = useState(false);

    // ── Walk-in list (party entries) ──────────────────────────────────────────
    const [walkIns, setWalkIns] = useState<WalkInEntry[]>([]);
    const [listLoading, setListLoading] = useState(false);

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    const fetchCapacity = useCallback(async () => {
        if (!eventId || !venueId) return;
        setCapLoading(true);
        try {
            const res = await fetch(`/api/venue/door/capacity?eventId=${eventId}&venueId=${venueId}`, { headers: authHeaders() });
            if (res.ok) {
                const d = await res.json();
                setCapacity(d.capacity ?? null);
            }
        } finally {
            setCapLoading(false);
        }
    }, [eventId, venueId, authHeaders]);

    const fetchWalkIns = useCallback(async () => {
        if (!eventId || !venueId) return;
        setListLoading(true);
        try {
            const res = await fetch(`/api/venue/walk-ins?eventId=${eventId}&venueId=${venueId}&purpose=party&limit=30`, { headers: authHeaders() });
            if (res.ok) {
                const d = await res.json();
                setWalkIns(d.entries ?? []);
            }
        } finally {
            setListLoading(false);
        }
    }, [eventId, venueId, authHeaders]);

    // Reset when event changes
    useEffect(() => {
        setCapacity(null);
        setWalkIns([]);
        setGuestName("");
        setPartySize(1);
        setGender(null);
        setPurpose(null);
        if (eventId) {
            fetchCapacity();
            fetchWalkIns();
        }
    }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Autofocus name on mount
    useEffect(() => {
        nameRef.current?.focus();
    }, []);

    const showFlash = (type: "success" | "error", message: string) => {
        setFlash({ type, message });
        setTimeout(() => setFlash(null), 2500);
    };

    const resetForm = () => {
        setGuestName("");
        setPartySize(1);
        setGender(null);
        setPurpose(null);
        // Re-focus name after short delay to allow DOM update
        setTimeout(() => nameRef.current?.focus(), 50);
    };

    // Quick action: pre-fill gender + purpose then focus name
    const quickAction = (g: DoorGender, p: DoorPurpose) => {
        setGender(g);
        setPurpose(p);
        setPartySize(1);
        nameRef.current?.focus();
    };

    const canSubmit =
        guestName.trim().length > 0 &&
        partySize >= 1 &&
        gender !== null &&
        purpose !== null &&
        !submitting &&
        !(purpose === "party" && capacity?.isSoldOut);

    const handleSubmit = async () => {
        if (!canSubmit || !eventId || !venueId) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/venue/door/sell?venueId=${venueId}`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    eventId,
                    venueId,
                    guestName: guestName.trim(),
                    partySize,
                    gender,
                    purpose,
                    idempotencyKey: idempotencyKey((profile as any)?.uid ?? "staff"),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                showFlash("error", data.error ?? "Failed to create entry");
                return;
            }
            showFlash(
                "success",
                purpose === "party"
                    ? `Party entry added — ${partySize} guest${partySize !== 1 ? "s" : ""}`
                    : `Dine-in entry added — ${partySize} guest${partySize !== 1 ? "s" : ""}`
            );
            resetForm();
            // Refresh lists + capacity
            fetchCapacity();
            if (purpose === "party") fetchWalkIns();
            if (data.remainingCapacity !== null) {
                setCapacity(prev => prev ? { ...prev, available: data.remainingCapacity, isSoldOut: data.remainingCapacity === 0 } : prev);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const soldOut = purpose === "party" && capacity?.isSoldOut;

    return (
        <div className="space-y-4 max-w-xl">
            {/* Flash feedback */}
            <AnimatePresence>
                {flash && (
                    <motion.div
                        key="flash"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                            "rounded-2xl px-5 py-3 flex items-center gap-3 text-[13px] font-semibold",
                            flash.type === "success"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                        )}
                    >
                        {flash.type === "success"
                            ? <CheckCircle2 size={16} />
                            : <AlertTriangle size={16} />
                        }
                        {flash.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Capacity bar */}
            {capLoading ? (
                <div className="rounded-2xl border px-5 py-4 flex items-center gap-2"
                    style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}>
                    <Loader2 size={14} className="animate-spin text-[var(--v-text-muted)]" />
                    <span className="text-[13px] text-[var(--v-text-muted)]">Loading capacity…</span>
                </div>
            ) : (
                <CapacityBar cap={capacity} />
            )}

            {/* Sold out banner */}
            {capacity?.isSoldOut && (
                <div className="rounded-2xl border px-5 py-4 flex items-center gap-3"
                    style={{ background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.3)" }}>
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <div>
                        <p className="text-[13px] font-bold text-red-400">Event Sold Out</p>
                        <p className="text-[12px] text-red-400/70">Party entries are disabled. Dine-in is still available.</p>
                    </div>
                </div>
            )}

            {/* No event selected */}
            {!eventId && (
                <div className="rounded-2xl border px-5 py-8 text-center"
                    style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}>
                    <p className="text-[13px]" style={{ color: "var(--v-text-muted)" }}>
                        Select an event above to start adding entries
                    </p>
                </div>
            )}

            {eventId && (
                <>
                    {/* Quick action buttons */}
                    <div
                        className="rounded-2xl border px-5 py-4 space-y-3"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                            Quick Actions
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => quickAction("male", "party")}
                                disabled={capacity?.isSoldOut}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all",
                                    capacity?.isSoldOut
                                        ? "opacity-40 cursor-not-allowed bg-[var(--v-elevated)] text-[var(--v-text-muted)]"
                                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95"
                                )}
                            >
                                <UserCheck size={15} />
                                + Male Entry
                            </button>
                            <button
                                onClick={() => quickAction("female", "party")}
                                disabled={capacity?.isSoldOut}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all",
                                    capacity?.isSoldOut
                                        ? "opacity-40 cursor-not-allowed bg-[var(--v-elevated)] text-[var(--v-text-muted)]"
                                        : "bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 active:scale-95"
                                )}
                            >
                                <UserCheck size={15} />
                                + Female Entry
                            </button>
                            <button
                                onClick={() => quickAction("male", "dinein")}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all"
                            >
                                <UtensilsCrossed size={15} />
                                + Dine-in
                            </button>
                        </div>
                    </div>

                    {/* Entry Form */}
                    <div
                        className="rounded-2xl border px-5 py-5 space-y-5"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                            Entry Form
                        </p>

                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>
                                Guest Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                ref={nameRef}
                                type="text"
                                value={guestName}
                                onChange={e => setGuestName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && canSubmit && handleSubmit()}
                                placeholder="Enter name…"
                                className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                                style={{
                                    background: "var(--v-elevated)",
                                    border: "1px solid var(--v-border)",
                                    color: "var(--v-text-primary)",
                                }}
                                autoComplete="off"
                            />
                        </div>

                        {/* Party size */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>
                                Number of People
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setPartySize(n)}
                                        className={cn(
                                            "w-11 h-11 rounded-xl text-[14px] font-bold transition-all active:scale-95",
                                            partySize === n
                                                ? "text-white"
                                                : "text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]"
                                        )}
                                        style={partySize === n ? { background: "#F44A22" } : { background: "var(--v-elevated)" }}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={partySize > 6 ? partySize : ""}
                                    onChange={e => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!isNaN(v) && v >= 1) setPartySize(v);
                                    }}
                                    placeholder="7+"
                                    className="w-16 h-11 rounded-xl px-3 text-[14px] font-bold text-center outline-none transition-all"
                                    style={{
                                        background: partySize > 6 ? "#F44A22" : "var(--v-elevated)",
                                        border: "1px solid var(--v-border)",
                                        color: partySize > 6 ? "#fff" : "var(--v-text-secondary)",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Gender */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>
                                Gender <span className="text-red-400">*</span>
                            </label>
                            <div className="flex gap-2">
                                {(["male", "female"] as DoorGender[]).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setGender(g)}
                                        className={cn(
                                            "flex-1 py-2.5 rounded-xl text-[13px] font-bold capitalize transition-all active:scale-95",
                                            gender === g
                                                ? g === "male"
                                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                                    : "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                                                : "border hover:bg-[var(--v-card-hover)]"
                                        )}
                                        style={gender !== g ? { background: "var(--v-elevated)", borderColor: "var(--v-border)", color: "var(--v-text-muted)" } : {}}
                                    >
                                        {g === "male" ? "Male" : "Female"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Purpose */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>
                                Purpose <span className="text-red-400">*</span>
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPurpose("party")}
                                    disabled={capacity?.isSoldOut}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95",
                                        purpose === "party"
                                            ? "bg-[#F44A22]/20 text-[#F44A22] border border-[#F44A22]/30"
                                            : "border hover:bg-[var(--v-card-hover)]",
                                        capacity?.isSoldOut && "opacity-40 cursor-not-allowed"
                                    )}
                                    style={purpose !== "party" ? { background: "var(--v-elevated)", borderColor: "var(--v-border)", color: "var(--v-text-muted)" } : {}}
                                >
                                    <UserCheck size={14} />
                                    Party
                                </button>
                                <button
                                    onClick={() => setPurpose("dinein")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95",
                                        purpose === "dinein"
                                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            : "border hover:bg-[var(--v-card-hover)]"
                                    )}
                                    style={purpose !== "dinein" ? { background: "var(--v-elevated)", borderColor: "var(--v-border)", color: "var(--v-text-muted)" } : {}}
                                >
                                    <UtensilsCrossed size={14} />
                                    Dine-in
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className={cn(
                                "w-full py-3.5 rounded-xl text-[14px] font-black uppercase tracking-widest transition-all",
                                canSubmit
                                    ? "text-white hover:opacity-90 active:scale-[0.98]"
                                    : "opacity-40 cursor-not-allowed text-white"
                            )}
                            style={{ background: soldOut ? "#F87171" : "#F44A22" }}
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    Adding…
                                </span>
                            ) : soldOut ? (
                                "Event Sold Out"
                            ) : (
                                "Confirm Entry"
                            )}
                        </button>
                    </div>

                    {/* Recent party entries */}
                    <div
                        className="rounded-2xl border overflow-hidden"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--v-border)" }}>
                            <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                Recent Walk-ins
                            </p>
                            <button onClick={fetchWalkIns} className="p-1 rounded-lg hover:bg-[var(--v-elevated)] transition-colors">
                                <RefreshCw size={13} className={cn("text-[var(--v-text-muted)]", listLoading && "animate-spin")} />
                            </button>
                        </div>
                        {listLoading ? (
                            <div className="flex items-center gap-2 px-5 py-6">
                                <Loader2 size={14} className="animate-spin text-[var(--v-text-muted)]" />
                                <span className="text-[13px] text-[var(--v-text-muted)]">Loading…</span>
                            </div>
                        ) : walkIns.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                                <p className="text-[13px]" style={{ color: "var(--v-text-muted)" }}>No walk-ins yet</p>
                            </div>
                        ) : (
                            <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                                {walkIns.slice(0, 15).map(entry => (
                                    <div key={entry.id} className="flex items-center gap-4 px-5 py-3">
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                                            style={{
                                                background: entry.gender === "female" ? "rgba(236,72,153,0.12)" : "rgba(59,130,246,0.12)",
                                                color: entry.gender === "female" ? "#ec4899" : "#60a5fa",
                                            }}
                                        >
                                            {entry.gender === "female" ? "F" : "M"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--v-text-primary)" }}>
                                                {entry.guestName}
                                            </p>
                                            <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                                                {entry.partySize} {entry.partySize === 1 ? "person" : "people"}
                                            </p>
                                        </div>
                                        <p className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--v-text-muted)" }}>
                                            {new Date(entry.addedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
