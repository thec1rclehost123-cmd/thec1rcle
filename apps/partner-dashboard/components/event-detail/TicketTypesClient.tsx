"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Link2, Settings, GripVertical, Trash2, X, AlertTriangle, Loader2, FlaskConical } from "lucide-react";
import { VenueTable, type Column } from "@/components/ui/VenueTable";
import { Button, IconButton } from "@/components/ui/Button";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = "on_sale" | "hidden" | "sold_out" | "scheduled";

interface TicketType {
    id: string;
    name: string;
    status: TicketStatus;
    price: number | null;
    sold: number;
    capacity: number;
    openSale: string | null;
    endSale: string | null;
}

interface TicketFormValues {
    name: string;
    price: string;
    quantity: string;
    openSale: string;
    endSale: string;
}

// ─── Dev-mode mock fallback ───────────────────────────────────────────────────
// Loaded automatically when the API is unreachable in local development so the
// team can keep working on the UI without a live Firebase connection.

const DEV_MOCK_TICKETS: TicketType[] = [
    { id: "mock-1", name: "GA — Early Bird",  status: "on_sale",   price: 500,  sold: 10, capacity: 100, openSale: null, endSale: null },
    { id: "mock-2", name: "GA — Tier 1",      status: "on_sale",   price: 800,  sold: 35, capacity: 150, openSale: null, endSale: null },
    { id: "mock-3", name: "GA — Tier 2",      status: "on_sale",   price: 1000, sold: 80, capacity: 200, openSale: null, endSale: null },
    { id: "mock-4", name: "VIP",              status: "sold_out",  price: 2500, sold: 50, capacity: 50,  openSale: null, endSale: null },
    { id: "mock-5", name: "GA — Last Chance", status: "scheduled", price: 1500, sold: 0,  capacity: 100, openSale: null, endSale: null },
    { id: "mock-6", name: "Staff Comp",       status: "hidden",    price: null, sold: 10, capacity: 30,  openSale: null, endSale: null },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string }> = {
    on_sale:   { label: "On Sale",   color: "#34D399", bg: "rgba(52,211,153,0.10)"  },
    hidden:    { label: "Hidden",    color: "#A1A1AA", bg: "rgba(161,161,170,0.10)" },
    sold_out:  { label: "Sold Out",  color: "#F87171", bg: "rgba(248,113,113,0.10)" },
    scheduled: { label: "Scheduled", color: "#FBBF24", bg: "rgba(251,191,36,0.10)"  },
};

function formatPrice(price: number | null) {
    if (price === null) return "FREE";
    return `₹${price.toLocaleString("en-IN")}`;
}

function formatDateDisplay(iso: string | null) {
    if (!iso) return <span style={{ color: "var(--v-text-tertiary)" }}>No date</span>;
    const d = new Date(iso);
    return (
        <span style={{ color: "var(--v-text-secondary)" }}>
            {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
    );
}

// ─── Date Input ───────────────────────────────────────────────────────────────

const dateInputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--v-elevated)",
    border: "1px solid var(--v-border)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--v-text-primary)",
    outline: "none",
    colorScheme: "dark",
};

// ─── Add Ticket Modal ─────────────────────────────────────────────────────────

const EMPTY_FORM: TicketFormValues = { name: "", price: "", quantity: "50", openSale: "", endSale: "" };

function TicketFormModal({
    open,
    saving,
    onClose,
    onSave,
}: {
    open: boolean;
    saving: boolean;
    onClose: () => void;
    onSave: (v: TicketFormValues) => void;
}) {
    const [form, setForm] = useState<TicketFormValues>(EMPTY_FORM);

    if (!open) return null;

    const set = (field: keyof TicketFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave(form);
    };

    const handleClose = () => {
        setForm(EMPTY_FORM);
        onClose();
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6,
        color: "var(--v-text-secondary)",
        letterSpacing: "0.03em",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        background: "var(--v-elevated)",
        border: "1px solid var(--v-border)",
        borderRadius: 10,
        padding: "9px 12px",
        fontSize: 13,
        color: "var(--v-text-primary)",
        outline: "none",
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={handleClose}
        >
            <form
                onSubmit={handleSubmit}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl p-6"
                style={{
                    background: "var(--v-card)",
                    border: "1px solid var(--v-border)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
                }}
            >
                {/* Modal header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[16px] font-bold" style={{ color: "var(--v-text-primary)" }}>
                            New Ticket Type
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                            Fill in the details for this tier
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                        style={{ color: "var(--v-text-tertiary)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--v-elevated)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Name */}
                    <div>
                        <label style={labelStyle}>Ticket Name *</label>
                        <input
                            style={inputStyle}
                            placeholder="e.g. GA — Early Bird"
                            value={form.name}
                            onChange={set("name")}
                            required
                            onFocus={e => (e.target.style.borderColor = "var(--c1rcle-orange)")}
                            onBlur={e => (e.target.style.borderColor = "var(--v-border)")}
                        />
                    </div>

                    {/* Price + Quantity */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label style={labelStyle}>Price (₹)</label>
                            <input
                                style={inputStyle}
                                type="number"
                                placeholder="500"
                                min="0"
                                value={form.price}
                                onChange={set("price")}
                                onFocus={e => (e.target.style.borderColor = "var(--c1rcle-orange)")}
                                onBlur={e => (e.target.style.borderColor = "var(--v-border)")}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Quantity</label>
                            <input
                                style={inputStyle}
                                type="number"
                                placeholder="50"
                                min="1"
                                value={form.quantity}
                                onChange={set("quantity")}
                                onFocus={e => (e.target.style.borderColor = "var(--c1rcle-orange)")}
                                onBlur={e => (e.target.style.borderColor = "var(--v-border)")}
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid var(--v-border)" }} />

                    {/* Open Sale Date */}
                    <div>
                        <label style={labelStyle}>Open Sale Date</label>
                        <input
                            style={dateInputStyle}
                            type="date"
                            value={form.openSale}
                            onChange={set("openSale")}
                            onFocus={e => (e.target.style.borderColor = "var(--c1rcle-orange)")}
                            onBlur={e => (e.target.style.borderColor = "var(--v-border)")}
                        />
                    </div>

                    {/* End Sale Date */}
                    <div>
                        <label style={labelStyle}>End Sale Date</label>
                        <input
                            style={dateInputStyle}
                            type="date"
                            value={form.endSale}
                            onChange={set("endSale")}
                            onFocus={e => (e.target.style.borderColor = "var(--c1rcle-orange)")}
                            onBlur={e => (e.target.style.borderColor = "var(--v-border)")}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 mt-6">
                    <Button variant="ghost" size="sm" type="button" onClick={handleClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" disabled={saving}>
                        {saving ? (
                            <span className="flex items-center gap-1.5">
                                <Loader2 size={13} className="animate-spin" />
                                Saving…
                            </span>
                        ) : "Save Ticket"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketTypesClient({ eventId }: { eventId: string }) {
    const { user, profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId ?? "";
    const queryClient = useQueryClient();
    const isDev = process.env.NODE_ENV === "development";

    const [modalOpen, setModalOpen]               = useState(false);
    const [deleteConfirmId, setDeleteConfirmId]   = useState<string | null>(null);
    const [usingMockData, setUsingMockData]       = useState(false);

    // ── Missing eventId guard ───────────────────────────────────────────────
    if (!eventId) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto flex flex-col items-center justify-center py-20 gap-3">
                <p className="text-[15px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                    No event selected
                </p>
                <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                    Open an event from the Events list to manage its ticket types.
                </p>
            </div>
        );
    }

    // Authenticated fetch helper
    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = await user?.getIdToken();
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                "Content-Type": "application/json",
            },
        });
    }, [user]);

    const baseUrl = `/api/venue/events/${eventId}/tickets?venueId=${venueId}`;

    // ── Fetch ticket tiers ──────────────────────────────────────────────────
    const { data, isLoading, isError } = useQuery<{ tiers: TicketType[] }>({
        queryKey: ["venue-tickets", eventId, venueId],
        queryFn: async () => {
            // Don't attempt the call without a venueId — surface a clear message
            if (!venueId) throw new Error("venueId not resolved — profile still loading");

            let res: Response;
            try {
                res = await authedFetch(baseUrl);
            } catch (networkErr: any) {
                // Use warn in dev — console.error triggers the Next.js error overlay
                if (isDev) {
                    console.warn("[TicketTypes] Network error (dev fallback active):", networkErr);
                    setUsingMockData(true);
                    return { tiers: DEV_MOCK_TICKETS };
                }
                console.error("[TicketTypes] Network error fetching tiers:", networkErr);
                throw networkErr;
            }

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                // Use warn in dev so the Next.js error overlay doesn't fire
                if (isDev) {
                    console.warn(
                        `[TicketTypes] API ${res.status} — using mock data (eventId=${eventId} venueId=${venueId}):`,
                        body
                    );
                    setUsingMockData(true);
                    return { tiers: DEV_MOCK_TICKETS };
                }
                console.error(
                    `[TicketTypes] API error ${res.status} for eventId=${eventId} venueId=${venueId}:`,
                    body
                );
                throw new Error(body.error || `HTTP ${res.status}: Failed to load ticket tiers`);
            }

            setUsingMockData(false);
            return res.json();
        },
        // Wait for both ids before firing; profile may resolve slightly after mount
        enabled: !!eventId && !!venueId,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const tickets: TicketType[] = data?.tiers ?? [];

    // ── Add ticket tier ─────────────────────────────────────────────────────
    const addMutation = useMutation({
        mutationFn: async (form: TicketFormValues) => {
            const res = await authedFetch(baseUrl, {
                method: "POST",
                body: JSON.stringify({
                    name: form.name.trim(),
                    price: form.price,
                    quantity: form.quantity,
                    openSale: form.openSale || null,
                    endSale: form.endSale || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to create ticket");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["venue-tickets", eventId, venueId] });
            setModalOpen(false);
        },
    });

    // ── Delete ticket tier ──────────────────────────────────────────────────
    const deleteMutation = useMutation({
        mutationFn: async (tierId: string) => {
            const res = await authedFetch(`${baseUrl}&tierId=${tierId}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete ticket");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["venue-tickets", eventId, venueId] });
            setDeleteConfirmId(null);
        },
    });

    // Build columns here so they close over state setters
    const columns: Column<TicketType>[] = [
        {
            key: "drag",
            header: "",
            width: "w-8",
            render: () => (
                <GripVertical size={14} style={{ color: "var(--v-text-tertiary)" }} className="cursor-grab" />
            ),
        },
        {
            key: "name",
            header: "Name",
            sortable: true,
            render: (row) => (
                <span className="text-[14px] font-medium" style={{ color: "var(--v-text-primary)" }}>
                    {row.name}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (row) => {
                const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.scheduled;
                return (
                    <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                        style={{ color: cfg.color, background: cfg.bg }}
                    >
                        {cfg.label}
                    </span>
                );
            },
        },
        {
            key: "price",
            header: "Price",
            sortable: true,
            render: (row) => (
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                    {formatPrice(row.price)}
                </span>
            ),
        },
        {
            key: "sold",
            header: "Sold",
            sortable: true,
            render: (row) => {
                const isFull = row.sold >= row.capacity;
                return (
                    <span
                        className="text-[13px] font-semibold tabular-nums"
                        style={{ color: isFull ? "#F87171" : "var(--v-text-primary)" }}
                    >
                        {row.sold} / {row.capacity}
                    </span>
                );
            },
        },
        {
            key: "openSale",
            header: "Open Sale",
            render: (row) => (
                <span className="text-[13px]">{formatDateDisplay(row.openSale)}</span>
            ),
        },
        {
            key: "endSale",
            header: "End Sale",
            render: (row) => (
                <span className="text-[13px]">{formatDateDisplay(row.endSale)}</span>
            ),
        },
        {
            key: "actions",
            header: "",
            width: "w-40",
            render: (row) => {
                const confirming = deleteConfirmId === row.id;
                const deleting = deleteMutation.isPending && deleteMutation.variables === row.id;

                if (confirming) {
                    return (
                        <div className="flex items-center gap-1.5 justify-end">
                            <span
                                className="flex items-center gap-1 text-[11px] font-semibold"
                                style={{ color: "#F87171" }}
                            >
                                <AlertTriangle size={11} />
                                Delete?
                            </span>
                            <button
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                                style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}
                                onClick={() => deleteMutation.mutate(row.id)}
                                disabled={deleting}
                            >
                                {deleting ? <Loader2 size={11} className="animate-spin" /> : "Yes"}
                            </button>
                            <button
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                                style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={deleting}
                            >
                                No
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton
                            icon={<Link2 size={14} />}
                            aria-label="Copy ticket link"
                            variant="ghost"
                            size="sm"
                            title="Copy link"
                            onClick={() => navigator.clipboard.writeText(`/tickets/${row.id}`)}
                        />
                        <IconButton
                            icon={<Settings size={14} />}
                            aria-label="Ticket settings"
                            variant="ghost"
                            size="sm"
                            title="Settings"
                        />
                        <IconButton
                            icon={<Trash2 size={14} />}
                            aria-label="Delete ticket type"
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => setDeleteConfirmId(row.id)}
                        />
                    </div>
                );
            },
        },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2
                        className="text-[22px] font-bold tracking-tight"
                        style={{ color: "var(--v-text-primary)" }}
                    >
                        Ticket Types
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                        {isLoading
                            ? "Loading…"
                            : `${tickets.length} ticket tier${tickets.length !== 1 ? "s" : ""} for this event`}
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus size={15} />}
                    iconPosition="left"
                    onClick={() => setModalOpen(true)}
                >
                    Add Ticket Type
                </Button>
            </div>

            {/* Dev mock data banner */}
            {usingMockData && (
                <div
                    className="mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
                    style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24" }}
                >
                    <FlaskConical size={14} />
                    Development mode — showing mock ticket data. API unreachable; check console for details.
                </div>
            )}

            {/* Error state (only shown in production or when not using mock fallback) */}
            {isError && !usingMockData && (
                <div
                    className="mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171" }}
                >
                    <AlertTriangle size={14} />
                    Failed to load ticket tiers. Please refresh and try again.
                </div>
            )}

            {/* Mutation error */}
            {(addMutation.isError || deleteMutation.isError) && (
                <div
                    className="mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171" }}
                >
                    <AlertTriangle size={14} />
                    {(addMutation.error as Error)?.message || (deleteMutation.error as Error)?.message}
                </div>
            )}

            {/* Table */}
            <VenueTable
                columns={columns}
                rows={tickets}
                keyExtractor={(row) => row.id}
                emptyState={
                    isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-12">
                            <Loader2 size={18} className="animate-spin" style={{ color: "var(--v-text-tertiary)" }} />
                            <span className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                                Loading ticket tiers…
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <p className="text-[14px] font-medium" style={{ color: "var(--v-text-tertiary)" }}>
                                No ticket types yet
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={<Plus size={14} />}
                                onClick={() => setModalOpen(true)}
                            >
                                Add your first ticket type
                            </Button>
                        </div>
                    )
                }
            />

            {/* Modal */}
            <TicketFormModal
                open={modalOpen}
                saving={addMutation.isPending}
                onClose={() => setModalOpen(false)}
                onSave={(form) => addMutation.mutate(form)}
            />
        </div>
    );
}
