"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GuestOpsShell } from "@/components/guest-ops/GuestOpsShell";
import { GuestSourceChip } from "@/components/guest-ops/chips/GuestSourceChip";
import { GuestStatusChip } from "@/components/guest-ops/chips/GuestStatusChip";
import { GuestDetailDrawer } from "@/components/guest-ops/GuestDetailDrawer";
import { AddGuestModal } from "@/components/guest-ops/modals/AddGuestModal";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useGuestOpsShellData } from "@/lib/hooks/useGuestOpsShellData";
import { cn } from "@/lib/utils";
import {
    Plus, Search, Loader2, AlertTriangle, ChevronDown, ChevronUp, Download,
    UserPlus, Filter, Check,
} from "lucide-react";
import type { GuestRecord } from "@/lib/types/guestOps";

const FILTER_TABS = [
    { label: "All",        value: "all" },
    { label: "Checked In", value: "checked_in" },
    { label: "Not Arrived",value: "expected" },
    { label: "VIP",        value: "vip" },
    { label: "Comp",       value: "comp" },
    { label: "Table",      value: "table" },
    { label: "Host List",  value: "host_manual" },
    { label: "Promo List", value: "promoter_manual" },
    { label: "Flagged",    value: "flagged" },
    { label: "Denied",     value: "denied" },
];

const TABLE_COLS = [
    { key: "name",      label: "Name",       width: "w-48" },
    { key: "type",      label: "Type",       width: "w-28" },
    { key: "source",    label: "Source",     width: "w-28" },
    { key: "status",    label: "Status",     width: "w-28" },
    { key: "phone",     label: "Phone",      width: "w-28" },
    { key: "checkedIn", label: "Check-In",   width: "w-36" },
    { key: "addedBy",   label: "Added By",   width: "w-32" },
];

export default function GuestListPageClient() {
    const { hasPermission } = useDashboardAuth();

    const {
        eventId, venueId, events, summary, openExceptions, authHeaders,
    } = useGuestOpsShellData();

    const [guests, setGuests] = useState<GuestRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [filter, setFilter] = useState("all");
    const [sortField, setSortField] = useState("addedAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState<GuestRecord | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const canManage = hasPermission("MANAGE_GUEST_OPS");
    const canExport = hasPermission("EXPORT_GUESTS");

    const fetchGuests = useCallback(async (cursor?: string) => {
        if (!eventId || !venueId) return;
        cursor ? setIsLoadingMore(true) : setIsLoading(true);
        try {
            const params = new URLSearchParams({ venueId, limit: "50", sortField, sortDir });
            if (filter !== "all") {
                // map tab value to filter param
                if (["checked_in", "expected", "denied", "flagged"].includes(filter)) params.set("status", filter);
                else if (["vip", "comp", "table", "host_manual", "promoter_manual"].includes(filter)) params.set("guestType", filter);
            }
            if (cursor) params.set("cursor", cursor);

            const res = await fetch(`/api/partners/venues/guest-ops/${eventId}/guests?${params}`, { headers: authHeaders() });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            setGuests(prev => cursor ? [...prev, ...(data.guests ?? [])] : (data.guests ?? []));
            setNextCursor(data.nextCursor ?? null);
            setHasMore(data.hasMore ?? false);
            setTotal(data.total ?? 0);
        } catch (_) {} finally {
            cursor ? setIsLoadingMore(false) : setIsLoading(false);
        }
    }, [eventId, venueId, filter, sortField, sortDir, authHeaders]);

    useEffect(() => { fetchGuests(); }, [fetchGuests]);

    // Search debounce — triggers a separate search query
    const handleSearch = useCallback((q: string) => {
        setSearch(q);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        if (q.length < 2) { fetchGuests(); return; }
        searchDebounce.current = setTimeout(async () => {
            if (!eventId || !venueId) return;
            setIsLoading(true);
            try {
                const res = await fetch(`/api/partners/venues/guest-ops/${eventId}/guests/search?venueId=${venueId}&q=${encodeURIComponent(q)}&field=name`, { headers: authHeaders() });
                if (res.ok) { const d = await res.json(); setGuests(d.results ?? []); setHasMore(false); }
            } catch (_) {} finally { setIsLoading(false); }
        }, 200);
    }, [eventId, venueId, fetchGuests, authHeaders]);

    const handleGuestAction = useCallback(async (action: string, guestId: string, body: object = {}) => {
        if (!eventId || !venueId) return;
        await fetch(`/api/partners/venues/guest-ops/${eventId}/guests/${guestId}/${action}?venueId=${venueId}`, {
            method: "POST", headers: authHeaders(), body: JSON.stringify(body),
        });
        fetchGuests();
        setSelectedGuest(null);
    }, [eventId, venueId, authHeaders, fetchGuests]);

    const isLocked = summary?.isLocked ?? false;

    return (
        <GuestOpsShell events={events} summary={summary} openExceptions={openExceptions}>
            <div className="space-y-3">
                {/* Toolbar */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--v-text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search by name…"
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border bg-[var(--v-elevated)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)]"
                            style={{ borderColor: "var(--v-border)" }}
                        />
                    </div>
                    <span className="text-[12px] text-[var(--v-text-muted)] ml-auto">
                        {total > 0 ? `${total.toLocaleString()} guests` : ""}
                    </span>
                    {canExport && !isLocked && (
                        <a
                            href={`/api/partners/venues/guest-ops/${eventId}/guests/export?venueId=${venueId}&format=csv&piiLevel=masked`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--v-elevated)] text-[13px] font-medium text-[var(--v-text-primary)] hover:bg-[var(--v-card-hover)]"
                        >
                            <Download size={13} />
                            Export
                        </a>
                    )}
                    {canManage && !isLocked && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--v-orange)] text-white text-[13px] font-medium hover:brightness-110"
                        >
                            <UserPlus size={13} />
                            Add Guest
                        </button>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
                    {FILTER_TABS.map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => { setFilter(tab.value); setGuests([]); setNextCursor(null); }}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all",
                                filter === tab.value
                                    ? "bg-[var(--v-orange)] text-white"
                                    : "bg-[var(--v-elevated)] text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--v-border)" }}>
                    {/* Header */}
                    <div
                        className="grid text-[11px] font-semibold uppercase tracking-wide text-[var(--v-text-muted)] px-4 py-2.5 border-b"
                        style={{ gridTemplateColumns: "1fr 100px 100px 100px 100px 140px 120px 80px", background: "var(--v-elevated)", borderColor: "var(--v-border)" }}
                    >
                        <span>Name</span>
                        <span>Type</span>
                        <span>Source</span>
                        <span>Status</span>
                        <span>Phone</span>
                        <span>Check-In</span>
                        <span>Added By</span>
                        <span></span>
                    </div>

                    {isLoading ? (
                        <GuestTableSkeleton />
                    ) : guests.length === 0 ? (
                        <EmptyGuestList filter={filter} />
                    ) : (
                        <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                            {guests.map(guest => (
                                <GuestRow
                                    key={guest.guestId}
                                    guest={guest}
                                    isLocked={isLocked}
                                    canManage={canManage}
                                    onSelect={() => setSelectedGuest(guest)}
                                    onCheckIn={() => handleGuestAction("check-in", guest.guestId, { reason: "Manual check-in from guest list" })}
                                    onDeny={() => setSelectedGuest(guest)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Load more */}
                    {hasMore && !isLoading && (
                        <div className="flex justify-center p-3 border-t" style={{ borderColor: "var(--v-border)" }}>
                            <button
                                onClick={() => fetchGuests(nextCursor ?? undefined)}
                                disabled={isLoadingMore}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--v-elevated)] text-[13px] font-medium hover:bg-[var(--v-card-hover)]"
                            >
                                {isLoadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                                Load more
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Guest Detail Drawer */}
            {selectedGuest && (
                <GuestDetailDrawer
                    guest={selectedGuest}
                    eventId={eventId}
                    venueId={venueId}
                    isLocked={isLocked}
                    canManage={canManage}
                    onClose={() => setSelectedGuest(null)}
                    onAction={(action, body) => handleGuestAction(action, selectedGuest.guestId, body)}
                />
            )}

            {/* Add Guest Modal */}
            {showAddModal && (
                <AddGuestModal
                    eventId={eventId}
                    venueId={venueId}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => { setShowAddModal(false); fetchGuests(); }}
                />
            )}
        </GuestOpsShell>
    );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function GuestRow({ guest, isLocked, canManage, onSelect, onCheckIn, onDeny }: {
    guest: GuestRecord;
    isLocked: boolean;
    canManage: boolean;
    onSelect: () => void;
    onCheckIn: () => void;
    onDeny: () => void;
}) {
    return (
        <div
            className="grid items-center px-4 py-2.5 hover:bg-[var(--v-card-hover)] cursor-pointer text-[13px] transition-colors"
            style={{ gridTemplateColumns: "1fr 100px 100px 100px 100px 140px 120px 80px" }}
            onClick={onSelect}
        >
            <div className="font-medium text-[var(--v-text-primary)] truncate pr-2">{guest.displayName}</div>
            <div><GuestSourceChip source={guest.guestType as any} size="xs" /></div>
            <div><GuestSourceChip source={guest.source} size="xs" /></div>
            <div><GuestStatusChip status={guest.status} size="xs" /></div>
            <div className="text-[12px] text-[var(--v-text-muted)] font-mono">{guest.maskedPhone ?? "—"}</div>
            <div className="text-[11px] text-[var(--v-text-muted)]">
                {guest.checkedIn && guest.checkedInAt
                    ? new Date(guest.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
            </div>
            <div className="text-[12px] text-[var(--v-text-muted)] truncate">{guest.addedByName || "—"}</div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {!isLocked && !guest.checkedIn && guest.status === "expected" && canManage && (
                    <button
                        onClick={onCheckIn}
                        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"
                        title="Check In"
                    >
                        <Check size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

function GuestTableSkeleton() {
    return (
        <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid items-center px-4 py-3 animate-pulse"
                    style={{ gridTemplateColumns: "1fr 100px 100px 100px 100px 140px 120px 80px" }}>
                    <div className="h-3.5 bg-[var(--v-elevated)] rounded w-3/4" />
                    <div className="h-5 bg-[var(--v-elevated)] rounded w-16" />
                    <div className="h-5 bg-[var(--v-elevated)] rounded w-16" />
                    <div className="h-5 bg-[var(--v-elevated)] rounded w-16" />
                    <div className="h-3 bg-[var(--v-elevated)] rounded w-20" />
                    <div className="h-3 bg-[var(--v-elevated)] rounded w-16" />
                    <div className="h-3 bg-[var(--v-elevated)] rounded w-20" />
                    <div />
                </div>
            ))}
        </div>
    );
}

function EmptyGuestList({ filter }: { filter: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <Filter size={28} className="text-[var(--v-text-muted)] mb-3" />
            <p className="text-[14px] font-medium text-[var(--v-text-primary)] mb-1">
                No guests{filter !== "all" ? ` in "${filter}" filter` : ""}
            </p>
            <p className="text-[12px] text-[var(--v-text-muted)]">
                {filter === "all" ? "Add the first guest or wait for ticket orders to arrive." : "Try a different filter."}
            </p>
        </div>
    );
}
