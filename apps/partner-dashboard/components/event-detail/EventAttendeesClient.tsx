"use client";

import { useState, useMemo } from "react";
import {
    Search, SlidersHorizontal, Tag, Plus, Info,
    Instagram, MessageCircle, Phone,
} from "lucide-react";
import { VenueTable, type Column } from "@/components/ui/VenueTable";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactChannel = "instagram" | "chat" | "phone";

interface Attendee {
    id: string;
    name: string;
    avatarUrl?: string;
    tickets: number;
    totalSpend: number;
    contact: ContactChannel[];
    tags: string[];
    lastPurchase: string; // ISO date string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ATTENDEES: Attendee[] = [
    { id: "1",  name: "Jaden Boreanaz",     tickets: 1, totalSpend: 500,  contact: ["chat", "phone"],                lastPurchase: "2026-03-12", tags: [] },
    { id: "2",  name: "Saad Azam",          tickets: 3, totalSpend: 1500, contact: ["instagram", "chat", "phone"],   lastPurchase: "2026-03-11", tags: ["VIP"] },
    { id: "3",  name: "Jeff Clayton",       tickets: 1, totalSpend: 500,  contact: ["instagram"],                    lastPurchase: "2026-03-11", tags: [] },
    { id: "4",  name: "Antoine Bell",       tickets: 1, totalSpend: 500,  contact: ["instagram", "chat", "phone"],   lastPurchase: "2026-03-11", tags: [] },
    { id: "5",  name: "William Nolan",      tickets: 1, totalSpend: 500,  contact: ["chat", "phone"],                lastPurchase: "2026-03-11", tags: [] },
    { id: "6",  name: "Trey Revis",         tickets: 1, totalSpend: 500,  contact: ["instagram", "chat", "phone"],   lastPurchase: "2026-03-11", tags: ["Promoter"] },
    { id: "7",  name: "Benjamin Gotfredson",tickets: 2, totalSpend: 1000, contact: [],                               lastPurchase: "2026-03-11", tags: [] },
    { id: "8",  name: "Michael Porter",     tickets: 1, totalSpend: 500,  contact: ["chat", "phone"],                lastPurchase: "2026-03-11", tags: [] },
    { id: "9",  name: "Aria Patel",         tickets: 2, totalSpend: 1000, contact: ["instagram", "phone"],           lastPurchase: "2026-03-10", tags: ["VIP"] },
    { id: "10", name: "Rohan Mehta",        tickets: 1, totalSpend: 500,  contact: ["instagram", "chat"],            lastPurchase: "2026-03-10", tags: [] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number) {
    return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const CONTACT_ICONS: Record<ContactChannel, { icon: React.ElementType; title: string }> = {
    instagram: { icon: Instagram,      title: "Instagram" },
    chat:      { icon: MessageCircle,  title: "Message"   },
    phone:     { icon: Phone,          title: "Phone"     },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventAttendeesClient({ eventId }: { eventId: string }) {
    const [search, setSearch]           = useState("");
    const [selected, setSelected]       = useState<Set<string>>(new Set());

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return MOCK_ATTENDEES;
        return MOCK_ATTENDEES.filter(a => a.name.toLowerCase().includes(q));
    }, [search]);

    const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id));

    function toggleAll() {
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) {
                filtered.forEach(a => next.delete(a.id));
            } else {
                filtered.forEach(a => next.add(a.id));
            }
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
            render: (row) => (
                <div className="flex items-center gap-3">
                    <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                    <div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                            {row.name}
                        </p>
                        {row.tags.length > 0 && (
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: "var(--v-orange-glow)", color: "var(--v-orange)" }}
                            >
                                {row.tags[0]}
                            </span>
                        )}
                    </div>
                </div>
            ),
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
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                    {formatINR(row.totalSpend)}
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
            render: (row) => (
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

    return (
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--v-text-primary)" }}>
                        Event Attendees
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                        {filtered.length} attendee{filtered.length !== 1 ? "s" : ""}
                        {selected.size > 0 && (
                            <span style={{ color: "var(--c1rcle-orange)" }}>
                                {" "}· {selected.size} selected
                            </span>
                        )}
                    </p>
                </div>

                {/* Bulk actions — visible when rows selected */}
                {selected.size > 0 && (
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" icon={<Tag size={13} />}>
                            Tag Selected
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                            Clear
                        </Button>
                    </div>
                )}
            </div>

            {/* Toolbar: Search + Filter + Tag */}
            <div className="flex items-center gap-3 mb-5">
                {/* Search */}
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
                    <p className="text-[13px] py-8 text-center" style={{ color: "var(--v-text-tertiary)" }}>
                        No attendees match your search.
                    </p>
                }
                // Pass select-all checkbox into the header via a custom th override isn't
                // supported by VenueTable, so we handle bulk selection via the toolbar above.
            />

        </div>
    );
}
