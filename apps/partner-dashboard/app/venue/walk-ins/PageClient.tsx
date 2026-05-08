"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    Search,
    Printer,
    Download,
    Filter,
    X,
    ChevronDown,
    Check,
    AlertCircle,
} from "lucide-react";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { formatINR } from "@/lib/finance/definitions";
import type { WalkInEntry, WalkInCategory, PaymentMode } from "@/lib/types/walkIns";
import { randomUUID } from "@/lib/utils/uuid";

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS: { value: WalkInCategory; label: string }[] = [
    { value: "general", label: "General" },
    { value: "vip", label: "VIP" },
    { value: "couple", label: "Couple" },
    { value: "group", label: "Group" },
    { value: "media", label: "Media" },
    { value: "other", label: "Other" },
];

const PAYMENT_OPTIONS: { value: PaymentMode; label: string }[] = [
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "upi", label: "UPI" },
    { value: "complimentary", label: "Comp" },
    { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<WalkInCategory, string> = {
    general: "bg-zinc-500/15 text-zinc-400",
    vip: "bg-amber-500/15 text-amber-400",
    couple: "bg-pink-500/15 text-pink-400",
    group: "bg-blue-500/15 text-blue-400",
    media: "bg-purple-500/15 text-purple-400",
    other: "bg-zinc-600/15 text-zinc-500",
};

const PAYMENT_ICONS: Record<PaymentMode, string> = {
    cash: "₹",
    card: "💳",
    upi: "UPI",
    complimentary: "✓",
    other: "—",
};

// ── Quick-entry form ───────────────────────────────────────────────────────────
interface EntryFormState {
    guestName: string;
    phone: string;
    partySize: string;
    category: WalkInCategory;
    paymentMode: PaymentMode;
    amount: string;
    note: string;
}

const EMPTY_FORM: EntryFormState = {
    guestName: "",
    phone: "",
    partySize: "1",
    category: "general",
    paymentMode: "cash",
    amount: "",
    note: "",
};

function QuickEntryRow({
    eventId,
    venueId,
    onSuccess,
}: {
    eventId: string;
    venueId: string;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState<EntryFormState>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const qc = useQueryClient();

    const mut = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/partners/venues/walk-ins?venueId=${venueId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId,
                    guestName: form.guestName,
                    phone: form.phone,
                    partySize: Number(form.partySize) || 1,
                    category: form.category,
                    paymentMode: form.paymentMode,
                    amount: parseFloat(form.amount) || 0,
                    note: form.note,
                    idempotencyKey: randomUUID(),
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "Failed");
            }
            return res.json();
        },
        onSuccess: () => {
            setForm(EMPTY_FORM);
            setError(null);
            qc.invalidateQueries({ queryKey: ["walk-ins", venueId, eventId] });
            onSuccess();
            nameRef.current?.focus();
        },
        onError: (e: Error) => setError(e.message),
    });

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && form.guestName.trim()) {
            mut.mutate();
        }
    };

    return (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-secondary p-4">
            <p className="text-xs text-text-tertiary mb-3">New entry — press Enter to add</p>
            <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_0.8fr_1fr_1fr_1fr_auto] gap-2 items-start">
                <Input
                    ref={nameRef}
                    placeholder="Guest name *"
                    value={form.guestName}
                    onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                    onKeyDown={handleKey}
                    autoComplete="off"
                />
                <Input
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    onKeyDown={handleKey}
                    type="tel"
                />
                <Input
                    placeholder="Party"
                    value={form.partySize}
                    onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))}
                    onKeyDown={handleKey}
                    type="number"
                    min="1"
                />
                <Select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as WalkInCategory }))}
                >
                    {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </Select>
                <Select
                    value={form.paymentMode}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as PaymentMode }))}
                >
                    {PAYMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </Select>
                <Input
                    placeholder="₹ Amount"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    onKeyDown={handleKey}
                    type="number"
                    min="0"
                />
                <Button
                    onClick={() => mut.mutate()}
                    disabled={mut.isPending || !form.guestName.trim()}
                    className="h-9 px-4 bg-surface-elevated hover:bg-surface-elevated text-text-primary border border-border-default"
                >
                    {mut.isPending ? "…" : <Plus className="h-4 w-4" />}
                </Button>
            </div>
            {error && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" />{error}
                </p>
            )}
        </div>
    );
}

// ── Table row ──────────────────────────────────────────────────────────────────
function WalkInRow({
    entry,
    index,
    venueId,
    onVoid,
}: {
    entry: WalkInEntry;
    index: number;
    venueId: string;
    onVoid: (entry: WalkInEntry) => void;
}) {
    return (
        <motion.tr
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="group border-b border-border-subtle hover:bg-surface-secondary transition-colors"
        >
            <td className="py-2.5 px-3 text-xs text-text-tertiary w-10">{index + 1}</td>
            <td className="py-2.5 px-3 text-sm text-text-primary font-medium">{entry.guestName}</td>
            <td className="py-2.5 px-3 text-xs text-text-secondary">{entry.partySize}</td>
            <td className="py-2.5 px-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[entry.category]}`}>
                    {entry.category}
                </span>
            </td>
            <td className="py-2.5 px-3 text-xs text-text-secondary">
                <span className="font-mono">{PAYMENT_ICONS[entry.paymentMode]}</span>
                {" "}{entry.paymentMode}
            </td>
            <td className="py-2.5 px-3 text-xs text-text-secondary tabular-nums">
                {entry.amountPaise > 0
                    ? `₹${(entry.amountPaise / 100).toLocaleString("en-IN")}`
                    : "—"}
            </td>
            <td className="py-2.5 px-3 text-xs text-text-tertiary">
                {new Date(entry.addedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </td>
            <td className="py-2.5 px-3 text-xs text-text-tertiary truncate max-w-[120px]">{entry.addedByName}</td>
            <td className="py-2.5 px-3 text-xs text-text-tertiary truncate max-w-[160px]">{entry.note}</td>
            <td className="py-2.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onVoid(entry)}
                    className="rounded-lg p-1 text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Void"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </td>
        </motion.tr>
    );
}

// ── Totals bar ─────────────────────────────────────────────────────────────────
function TotalsBar({
    totals,
}: {
    totals: { count: number; totalPaise: number; partySize: number };
}) {
    return (
        <div className="dash-card flex items-center gap-6 px-4 py-3">
            <div>
                <p className="text-xs text-text-tertiary">Entries</p>
                <p className="text-lg font-semibold text-text-primary tabular-nums">{totals.count}</p>
            </div>
            <div>
                <p className="text-xs text-text-tertiary">Total guests</p>
                <p className="text-lg font-semibold text-text-primary tabular-nums">{totals.partySize}</p>
            </div>
            <div>
                <p className="text-xs text-text-tertiary">Revenue collected</p>
                <p className="text-lg font-semibold text-text-primary tabular-nums">
                    ₹{(totals.totalPaise / 100).toLocaleString("en-IN")}
                </p>
            </div>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function WalkInsClient() {
    const sp = useSearchParams();
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId ?? "";
    const qc = useQueryClient();

    // State
    const [selectedEventId, setSelectedEventId] = useState<string>(
        sp.get("eventId") ?? ""
    );
    const [q, setQ] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Load events for selector
    const { data: eventsData } = useQuery({
        queryKey: ["venue-events-list", venueId],
        queryFn: async () => {
            const res = await fetch(`/api/partners/venues/events?venueId=${venueId}&limit=30`);
            if (!res.ok) return { events: [] };
            return res.json();
        },
        enabled: !!venueId,
        staleTime: 60_000,
    });

    // Load walk-in entries
    const params = new URLSearchParams({ venueId });
    if (selectedEventId) params.set("eventId", selectedEventId);
    if (q) params.set("q", q);
    if (categoryFilter) params.set("category", categoryFilter);
    if (paymentFilter) params.set("paymentMode", paymentFilter);
    params.set("summary", "1");

    const { data, isLoading } = useQuery({
        queryKey: ["walk-ins", venueId, selectedEventId, q, categoryFilter, paymentFilter],
        queryFn: async () => {
            const endpoint = selectedEventId
                ? `/api/partners/venues/walk-ins/${selectedEventId}?${params}`
                : `/api/partners/venues/walk-ins?${params}`;
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!venueId,
        staleTime: 15_000,
        refetchInterval: 30_000,
    });

    const voidMut = useMutation({
        mutationFn: async (entry: WalkInEntry) => {
            const res = await fetch(
                `/api/partners/venues/walk-ins/${entry.eventId}?venueId=${venueId}&logId=${entry.id}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["walk-ins"] }),
    });

    const handleVoid = (entry: WalkInEntry) => {
        if (confirm(`Void entry for ${entry.guestName}?`)) {
            voidMut.mutate(entry);
        }
    };

    const handlePrint = () => window.print();

    const entries: WalkInEntry[] = data?.entries ?? [];
    const totals = data?.totals ?? { count: 0, totalPaise: 0, partySize: 0 };

    return (
        <VenuePageShell
            title="Walk-ins"
            subtitle="Event-day entry register — keyboard-optimised for fast operation"
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handlePrint} className="no-print">
                        <Printer className="h-4 w-4 mr-1.5" /> Print
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 no-print">
                {/* Event selector */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="min-w-[200px]"
                    >
                        <option value="">All events</option>
                        {(eventsData?.events ?? []).map((ev: any) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.title ?? ev.name} — {ev.startDate?.slice(0, 10)}
                            </option>
                        ))}
                    </Select>

                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search by name, operator, note…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFilters((v) => !v)}
                    >
                        <Filter className="h-4 w-4 mr-1.5" /> Filters
                        {(categoryFilter || paymentFilter) && (
                            <span className="ml-1.5 rounded-full bg-surface-elevated px-1.5 text-xs">
                                {[categoryFilter, paymentFilter].filter(Boolean).length}
                            </span>
                        )}
                    </Button>
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-center gap-3 flex-wrap pb-2">
                                <Select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                >
                                    <option value="">All categories</option>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </Select>
                                <Select
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value)}
                                >
                                    <option value="">All payment modes</option>
                                    {PAYMENT_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </Select>
                                {(categoryFilter || paymentFilter) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setCategoryFilter(""); setPaymentFilter(""); }}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Quick-entry row (only when event selected) */}
                {selectedEventId && (
                    <QuickEntryRow
                        eventId={selectedEventId}
                        venueId={venueId}
                        onSuccess={() => {}}
                    />
                )}

                {/* Totals */}
                {entries.length > 0 && <TotalsBar totals={totals} />}
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-border-default">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-border-default">
                            {["#", "Name", "Party", "Category", "Payment", "Amount", "Time", "Operator", "Note", ""].map(
                                (h) => (
                                    <th key={h} className="py-2.5 px-3 text-xs font-medium text-text-tertiary no-print:sticky top-0 bg-surface-secondary">
                                        {h}
                                    </th>
                                )
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-border-subtle">
                                    {[...Array(10)].map((_, j) => (
                                        <td key={j} className="py-3 px-3">
                                            <Skeleton className="h-4 w-full" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                        <AnimatePresence initial={false}>
                            {entries.map((entry, i) => (
                                <WalkInRow
                                    key={entry.id}
                                    entry={entry}
                                    index={i}
                                    venueId={venueId}
                                    onVoid={handleVoid}
                                />
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>

                {!isLoading && entries.length === 0 && (
                    <div className="py-16">
                        <EmptyState
                            icon={ClipboardList}
                            title="No walk-in entries yet"
                            description={
                                selectedEventId
                                    ? "Add the first entry using the form above"
                                    : "Select an event and start logging walk-ins"
                            }
                        />
                    </div>
                )}
            </div>

            {/* Print styles */}
            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white; color: black; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
                    th { background: #f5f5f5; font-weight: 600; }
                }
            `}</style>
        </VenuePageShell>
    );
}

// icon import fix
import { ClipboardList } from "lucide-react";
