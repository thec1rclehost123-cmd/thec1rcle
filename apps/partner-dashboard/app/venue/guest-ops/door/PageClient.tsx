"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GuestOpsShell } from "@/components/guest-ops/GuestOpsShell";
import { GuestDetailDrawer } from "@/components/guest-ops/GuestDetailDrawer";
import { GuestSourceChip } from "@/components/guest-ops/chips/GuestSourceChip";
import { GuestStatusChip } from "@/components/guest-ops/chips/GuestStatusChip";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VENUE_PERMISSIONS } from "@/lib/rbac/types";
import clsx from "clsx";
import {
    Search, Loader2, CheckCircle2, XCircle, AlertTriangle, ScanLine,
    User, Phone, Hash, FileText,
} from "lucide-react";
import type { GuestRecord, GuestOpsOverview } from "@/lib/types/guestOps";

type SearchField = "name" | "phone" | "ticketId" | "ref";

const SEARCH_TABS: { value: SearchField; label: string; icon: React.ElementType; placeholder: string }[] = [
    { value: "name",     icon: User,     label: "Name",      placeholder: "Search by full or partial name…" },
    { value: "phone",    icon: Phone,    label: "Phone",     placeholder: "Search by phone number…" },
    { value: "ticketId", icon: Hash,     label: "Ticket ID", placeholder: "Enter ticket ID…" },
    { value: "ref",      icon: FileText, label: "Order Ref", placeholder: "Enter order reference…" },
];

export default function DoorSearchPageClient() {
    const { profile } = useDashboardAuth();
    const searchParams = useSearchParams();
    const venueId = profile?.activeMembership?.partnerId ?? "";
    const eventId = searchParams.get("eventId") ?? "";
    const role = profile?.activeMembership?.role ?? "";

    // Shell state
    const [events, setEvents] = useState<any[]>([]);
    const [summary, setSummary] = useState<GuestOpsOverview | null>(null);
    const [openExceptions, setOpenExceptions] = useState(0);
    const [shellLoading, setShellLoading] = useState(true);

    // Search state
    const [searchField, setSearchField] = useState<SearchField>("name");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GuestRecord[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Action state
    const [selectedGuest, setSelectedGuest] = useState<GuestRecord | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // guestId being acted on
    const [lastActionResult, setLastActionResult] = useState<{
        guestId: string; success: boolean; message: string;
    } | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const permissions = VENUE_PERMISSIONS[role as keyof typeof VENUE_PERMISSIONS] ?? [];
    const canManage = permissions.includes("MANAGE_GUEST_OPS");

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    // Fetch shell context
    useEffect(() => {
        if (!eventId || !venueId) { setShellLoading(false); return; }
        Promise.all([
            fetch(`/api/venue/events?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/venue/guest-ops/${eventId}/summary?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/venue/guest-ops/${eventId}/exceptions?venueId=${venueId}&status=open`, { headers: authHeaders() }),
        ]).then(async ([evRes, sumRes, excRes]) => {
            if (evRes.ok) { const d = await evRes.json(); setEvents(d.events ?? []); }
            if (sumRes.ok) setSummary(await sumRes.json());
            if (excRes.ok) { const d = await excRes.json(); setOpenExceptions(d.openCount ?? 0); }
        }).finally(() => setShellLoading(false));
    }, [eventId, venueId, authHeaders]);

    // Autofocus search input when eventId is ready
    useEffect(() => {
        if (eventId) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [eventId]);

    const doSearch = useCallback(async (q: string, field: SearchField) => {
        if (!q.trim() || q.trim().length < 2 || !eventId || !venueId) {
            setResults([]);
            setHasSearched(false);
            return;
        }
        setIsSearching(true);
        setSearchError(null);
        setLastActionResult(null);
        try {
            const res = await fetch(
                `/api/venue/guest-ops/${eventId}/guests/search?venueId=${venueId}&q=${encodeURIComponent(q.trim())}&field=${field}`,
                { headers: authHeaders() }
            );
            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setResults(data.results ?? []);
            setHasSearched(true);
        } catch {
            setSearchError("Search failed. Check your connection.");
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [eventId, venueId, authHeaders]);

    const handleQueryChange = useCallback((q: string) => {
        setQuery(q);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(q, searchField), 250);
    }, [doSearch, searchField]);

    const handleTabChange = useCallback((field: SearchField) => {
        setSearchField(field);
        setResults([]);
        setHasSearched(false);
        setQuery("");
        setLastActionResult(null);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const handleAction = useCallback(async (action: string, guestId: string, body: object = {}) => {
        setActionLoading(guestId);
        setLastActionResult(null);
        try {
            const res = await fetch(
                `/api/venue/guest-ops/${eventId}/guests/${guestId}/${action}?venueId=${venueId}`,
                { method: "POST", headers: authHeaders(), body: JSON.stringify(body) }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setLastActionResult({ guestId, success: true, message: data.message ?? "Done" });
                // Re-run search to refresh results
                await doSearch(query, searchField);
            } else {
                setLastActionResult({ guestId, success: false, message: data.error ?? "Action failed" });
            }
        } catch {
            setLastActionResult({ guestId, success: false, message: "Network error" });
        } finally {
            setActionLoading(null);
            setSelectedGuest(null);
        }
    }, [eventId, venueId, authHeaders, doSearch, query, searchField]);

    const isLocked = summary?.isLocked ?? false;
    const currentTab = SEARCH_TABS.find(t => t.value === searchField)!;

    return (
        <GuestOpsShell
            events={events}
            summary={summary}
            openExceptions={openExceptions}
            isLoading={shellLoading}
        >
            <div className="max-w-2xl mx-auto space-y-4">
                {!eventId ? (
                    <NoEventState />
                ) : (
                    <>
                        {/* Search field tabs */}
                        <div className="flex gap-1.5">
                            {SEARCH_TABS.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.value}
                                        onClick={() => handleTabChange(tab.value)}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all",
                                            searchField === tab.value
                                                ? "bg-[var(--v-orange)] text-white"
                                                : "bg-[var(--v-elevated)] text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]"
                                        )}
                                    >
                                        <Icon size={12} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search input */}
                        <div className="relative">
                            <Search
                                size={16}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--v-text-muted)]"
                            />
                            {isSearching && (
                                <Loader2
                                    size={16}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--v-text-muted)] animate-spin"
                                />
                            )}
                            <input
                                ref={inputRef}
                                type={searchField === "phone" ? "tel" : "text"}
                                value={query}
                                onChange={e => handleQueryChange(e.target.value)}
                                placeholder={currentTab.placeholder}
                                className="w-full pl-11 pr-11 py-3.5 text-[15px] rounded-2xl border bg-[var(--v-card)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)] shadow-sm"
                                style={{ borderColor: "var(--v-border)" }}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>

                        {/* Action result toast */}
                        {lastActionResult && (
                            <div
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] font-medium",
                                    lastActionResult.success
                                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                                )}
                            >
                                {lastActionResult.success
                                    ? <CheckCircle2 size={15} />
                                    : <AlertTriangle size={15} />}
                                {lastActionResult.message}
                            </div>
                        )}

                        {/* Search error */}
                        {searchError && (
                            <div className="flex items-center gap-2 text-[13px] text-red-500">
                                <AlertTriangle size={13} />
                                {searchError}
                            </div>
                        )}

                        {/* Results */}
                        {hasSearched && results.length === 0 && !isSearching && (
                            <NotFoundState query={query} field={searchField} />
                        )}

                        {results.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-[12px] text-[var(--v-text-muted)]">
                                    {results.length} result{results.length !== 1 ? "s" : ""}
                                </div>
                                {results.map(guest => (
                                    <DoorSearchResultCard
                                        key={guest.guestId}
                                        guest={guest}
                                        isLocked={isLocked}
                                        canManage={canManage}
                                        isActing={actionLoading === guest.guestId}
                                        lastActionGuestId={lastActionResult?.guestId}
                                        onViewDetail={() => setSelectedGuest(guest)}
                                        onCheckIn={() => handleAction("check-in", guest.guestId, { reason: "Manual check-in via Door Search" })}
                                        onDeny={() => setSelectedGuest(guest)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Auto-expand single result */}
                        {results.length === 1 && !selectedGuest && results[0].status !== "checked_in" && canManage && !isLocked && (
                            <div className="text-center">
                                <p className="text-[12px] text-[var(--v-text-muted)]">
                                    Single match found — click the card above to open or use quick actions.
                                </p>
                            </div>
                        )}
                    </>
                )}
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
                    onAction={handleAction}
                />
            )}
        </GuestOpsShell>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DoorSearchResultCard({ guest, isLocked, canManage, isActing, lastActionGuestId, onViewDetail, onCheckIn, onDeny }: {
    guest: GuestRecord;
    isLocked: boolean;
    canManage: boolean;
    isActing: boolean;
    lastActionGuestId?: string;
    onViewDetail: () => void;
    onCheckIn: () => void;
    onDeny: () => void;
}) {
    const isThisActed = lastActionGuestId === guest.guestId;

    return (
        <div
            className={clsx(
                "p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md",
                guest.status === "checked_in"
                    ? "border-green-200 dark:border-green-800"
                    : guest.status === "denied"
                    ? "border-red-200 dark:border-red-800"
                    : guest.status === "flagged"
                    ? "border-amber-200 dark:border-amber-800"
                    : ""
            )}
            style={{ background: "var(--v-card)", borderColor: guest.status === "expected" ? "var(--v-border)" : undefined }}
            onClick={onViewDetail}
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0",
                    guest.status === "checked_in" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                    guest.status === "denied" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                    "bg-[var(--v-elevated)] text-[var(--v-text-muted)]"
                )}>
                    {guest.displayName.charAt(0).toUpperCase()}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-[var(--v-text-primary)]">
                            {guest.displayName}
                        </span>
                        <GuestStatusChip status={guest.status} size="xs" />
                        <GuestSourceChip source={guest.guestType as any} size="xs" />
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {guest.maskedPhone && (
                            <span className="text-[12px] text-[var(--v-text-muted)] font-mono">{guest.maskedPhone}</span>
                        )}
                        {guest.ticketTierName && (
                            <span className="text-[12px] text-[var(--v-text-muted)]">{guest.ticketTierName}</span>
                        )}
                        {guest.hostName && (
                            <span className="text-[12px] text-[var(--v-text-muted)]">via {guest.hostName}</span>
                        )}
                        {guest.promoterName && (
                            <span className="text-[12px] text-[var(--v-text-muted)]">via {guest.promoterName}</span>
                        )}
                    </div>

                    {guest.checkedIn && guest.checkedInAt && (
                        <div className="flex items-center gap-1 mt-1">
                            <CheckCircle2 size={11} className="text-green-500" />
                            <span className="text-[11px] text-green-600 dark:text-green-400">
                                Checked in at {new Date(guest.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                {guest.checkInDeviceName ? ` · ${guest.checkInDeviceName}` : ""}
                            </span>
                        </div>
                    )}
                </div>

                {/* Quick actions — only if not locked and canManage */}
                {!isLocked && canManage && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {guest.status === "expected" && (
                            <button
                                onClick={onCheckIn}
                                disabled={isActing}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-[12px] font-semibold transition-all disabled:opacity-60"
                            >
                                {isActing
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <CheckCircle2 size={12} />}
                                Check In
                            </button>
                        )}
                        {(guest.status === "expected" || guest.status === "flagged") && (
                            <button
                                onClick={onDeny}
                                disabled={isActing}
                                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all disabled:opacity-60"
                                title="Deny entry"
                            >
                                <XCircle size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function NoEventState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <ScanLine size={40} className="text-[var(--v-text-muted)] mb-4" />
            <h3 className="text-[16px] font-semibold text-[var(--v-text-primary)] mb-2">Select an event</h3>
            <p className="text-[13px] text-[var(--v-text-muted)] max-w-xs">
                Choose an event from the selector above to use door search.
            </p>
        </div>
    );
}

function NotFoundState({ query, field }: { query: string; field: SearchField }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={32} className="text-[var(--v-text-muted)] mb-3" />
            <p className="text-[14px] font-medium text-[var(--v-text-primary)] mb-1">No guests found</p>
            <p className="text-[12px] text-[var(--v-text-muted)]">
                No results for "{query}" in {field}.
                {field === "phone" ? " Try without country code." : " Check spelling and try again."}
            </p>
        </div>
    );
}
