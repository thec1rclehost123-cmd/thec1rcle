"use client";

import { useState, useMemo } from "react";
import {
    Search, SlidersHorizontal, Tag, Plus, Info,
    Instagram, MessageCircle, Phone,
    Loader2, AlertTriangle, FlaskConical, RefreshCw,
} from "lucide-react";
import { VenueTable, type Column } from "@/components/ui/VenueTable";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    useEventAttendees,
    type Attendee,
    type ContactChannel,
} from "@/lib/hooks/useEventAttendees";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number) {
    return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const CONTACT_ICONS: Record<ContactChannel, { icon: React.ElementType; title: string }> = {
    instagram: { icon: Instagram,     title: "Instagram" },
    chat:      { icon: MessageCircle, title: "Message"   },
    phone:     { icon: Phone,         title: "Phone"     },
};

const SOURCE_BADGE: Record<Attendee["source"], { label: string; color: string; bg: string }> = {
    online: { label: "Online", color: "#34D399", bg: "rgba(52,211,153,0.10)" },
    door:   { label: "Door",   color: "#818CF8", bg: "rgba(129,140,248,0.10)" },
    manual: { label: "Manual", color: "#FBBF24", bg: "rgba(251,191,36,0.10)" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventAttendeesClient({ eventId }: { eventId: string }) {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId ?? "";

    const [search,   setSearch]   = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [useMock,  setUseMock]  = useState(false);

    // ── Live data hook ──────────────────────────────────────────────────────
    const {
        attendees: liveAttendees,
        totalCount,
        isLoading,
        isError,
        isUsingMock: apiUsingMock,
        refresh,
    } = useEventAttendees(eventId, venueId);

    // The "Mock Data" toggle overrides to a stable set for UI testing
    const attendees = useMock ? liveAttendees.slice(0, 10) : liveAttendees;
    const showingMock = useMock || apiUsingMock;

    // ── Search filter ───────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return attendees;
        return attendees.filter(a => a.name.toLowerCase().includes(q));
    }, [search, attendees]);

    const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id));

    function toggleAll() {
        setSelected(prev => {
            const next = new Set(prev);
            allSelected
                ? filtered.forEach(a => next.delete(a.id))
                : filtered.forEach(a => next.add(a.id));
            return next;
        });
    }

    function toggleOne(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    // ── Column definitions ──────────────────────────────────────────────────
    const columns: Column<Attendee>[] = [
        {
            key: "select",
            header: "",
            width: "w-10",
            render: (row) => (
                <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="w-4 h-4 rounded cursor-pointer accent-[var(--c1rcle-orange)]"
                    onClick={e => e.stopPropagation()}
                />
            ),
        },
        {
            key: "name",
            header: "Name",
            sortable: true,
            render: (row) => {
                const src = SOURCE_BADGE[row.source];
                return (
                    <div className="flex items-center gap-3">
                        <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                        <div>
                            <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                                {row.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {row.tags.length > 0 && (
                                    <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: "var(--v-orange-glow)", color: "var(--c1rcle-orange)" }}
                                    >
                                        {row.tags[0]}
                                    </span>
                                )}
                                <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                    style={{ color: src.color, background: src.bg }}
                                >
                                    {src.label}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            key: "tickets",
            header: "Tickets",
            sortable: true,
            render: (row) => (
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                    {row.tickets}
                </span>
            ),
        },
        {
            key: "totalSpend",
            header: "Total Spend",
            sortable: true,
            render: (row) => (
                <span
                    className="text-[13px] font-semibold tabular-nums"
                    style={{ color: row.totalSpend > 0 ? "var(--v-text-primary)" : "var(--v-text-tertiary)" }}
                >
                    {row.totalSpend > 0 ? formatINR(row.totalSpend) : "—"}
                </span>
            ),
        },
        {
            key: "contact",
            header: "Contact",
            render: (row) => (
                <div className="flex items-center gap-1">
                    {row.contact.length === 0 ? (
                        <span className="text-[12px]" style={{ color: "var(--v-text-tertiary)" }}>—</span>
                    ) : (
                        row.contact.map(ch => {
                            const { icon: Icon, title } = CONTACT_ICONS[ch];
                            return (
                                <button
                                    key={ch}
                                    title={title}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                                    style={{ color: "var(--v-text-tertiary)" }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.background = "var(--v-elevated)";
                                        (e.currentTarget as HTMLElement).style.color = "var(--v-text-primary)";
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.background = "transparent";
                                        (e.currentTarget as HTMLElement).style.color = "var(--v-text-tertiary)";
                                    }}
                                >
                                    <Icon size={13} />
                                </button>
                            );
                        })
                    )}
                </div>
            ),
        },
        {
            key: "tags",
            header: "Tags",
            render: () => (
                <button
                    className="w-7 h-7 flex items-center justify-center rounded-full border transition-colors"
                    style={{ borderColor: "var(--v-border)", color: "var(--v-text-tertiary)" }}
                    title="Add tag"
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--c1rcle-orange)";
                        (e.currentTarget as HTMLElement).style.color = "var(--c1rcle-orange)";
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--v-border)";
                        (e.currentTarget as HTMLElement).style.color = "var(--v-text-tertiary)";
                    }}
                >
                    <Plus size={12} />
                </button>
            ),
        },
        {
            key: "lastPurchase",
            header: "Last Purchase",
            sortable: true,
            render: (row) => (
                <span className="text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                    {formatDate(row.lastPurchase)}
                </span>
            ),
        },
        {
            key: "info",
            header: "",
            width: "w-12",
            render: () => (
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                        icon={<Info size={14} />}
                        aria-label="Attendee details"
                        variant="ghost"
                        size="sm"
                        title="View details"
                    />
                </div>
            ),
        },
    ];

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--v-text-primary)" }}>
                        Event Attendees
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                        {isLoading
                            ? "Loading…"
                            : `${totalCount} attendee${totalCount !== 1 ? "s" : ""}`}
                        {selected.size > 0 && (
                            <span style={{ color: "var(--c1rcle-orange)" }}>
                                {" "}· {selected.size} selected
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Bulk actions */}
                    {selected.size > 0 && (
                        <>
                            <Button variant="secondary" size="sm" icon={<Tag size={13} />}>
                                Tag Selected
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                                Clear
                            </Button>
                        </>
                    )}

                    {/* Refresh */}
                    <IconButton
                        icon={<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />}
                        aria-label="Refresh attendees"
                        variant="ghost"
                        size="sm"
                        title="Refresh"
                        onClick={refresh}
                    />

                    {/* Mock Data toggle */}
                    <button
                        onClick={() => setUseMock(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                        style={{
                            background: useMock ? "rgba(251,191,36,0.12)" : "var(--v-elevated)",
                            border: `1px solid ${useMock ? "rgba(251,191,36,0.3)" : "var(--v-border)"}`,
                            color: useMock ? "#FBBF24" : "var(--v-text-tertiary)",
                        }}
                        title={useMock ? "Disable mock data" : "Enable mock data for UI testing"}
                    >
                        <FlaskConical size={11} />
                        Mock
                    </button>
                </div>
            </div>

            {/* Status banners */}
            {showingMock && (
                <div
                    className="mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
                    style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24" }}
                >
                    <FlaskConical size={14} />
                    {useMock
                        ? "Mock mode enabled — showing sample attendee data for UI testing."
                        : "Dev mode — API unreachable, showing cached sample data. Check console for details."}
                </div>
            )}

            {isError && !showingMock && (
                <div
                    className="mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171" }}
                >
                    <AlertTriangle size={14} />
                    Failed to load attendees. Check your connection and try refreshing.
                </div>
            )}

            {/* Toolbar: Search + Filter + Tag */}
            <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                    <Search
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "var(--v-text-tertiary)" }}
                    />
                    <input
                        type="text"
                        placeholder="Search by name…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] transition-colors"
                        style={{
                            background: "var(--v-elevated)",
                            border: "1px solid var(--v-border)",
                            color: "var(--v-text-primary)",
                            outline: "none",
                        }}
                        onFocus={e => (e.target.style.borderColor = "var(--c1rcle-orange)")}
                        onBlur={e => (e.target.style.borderColor = "var(--v-border)")}
                    />
                </div>

                <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={13} />}>
                    Filter
                </Button>
                <Button variant="secondary" size="sm" icon={<Tag size={13} />}>
                    Tag
                </Button>
            </div>

            {/* Table */}
            <VenueTable
                columns={columns}
                rows={filtered}
                keyExtractor={row => row.id}
                emptyState={
                    isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-12">
                            <Loader2 size={18} className="animate-spin" style={{ color: "var(--v-text-tertiary)" }} />
                            <span className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                                Loading attendees…
                            </span>
                        </div>
                    ) : (
                        <p className="text-[13px] py-8 text-center" style={{ color: "var(--v-text-tertiary)" }}>
                            {search ? "No attendees match your search." : "No attendees yet."}
                        </p>
                    )
                }
            />

        </div>
    );
}
