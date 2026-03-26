"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Users, Search,
    Phone, Mail, AlertCircle, Loader2,
} from "lucide-react";
import type { User } from "firebase/auth";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { OnlineCustomer } from "@/app/api/venue/crm/online/route";
import type { ManualCustomer } from "@/app/api/venue/crm/customers/route";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CRMData {
    online: OnlineCustomer[];
    manual: ManualCustomer[];
    loading: boolean;
    error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth-aware fetch
// ─────────────────────────────────────────────────────────────────────────────

async function authFetch(user: User, url: string, init?: RequestInit): Promise<Response> {
    const token = await user.getIdToken();
    return fetch(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function calculateAge(dob: string): number {
    if (!dob) return 0;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
    const initials = name.split(" ").map((n) => n[0] ?? "").slice(0, 2).join("").toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-secondary)" }}>
            {initials}
        </div>
    );
}

function AgeBadge({ age }: { age: number }) {
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-secondary)" }}>
            {age > 0 ? `${age} yrs` : "—"}
        </span>
    );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--v-elevated)" }}>
                <Icon size={24} style={{ color: "var(--v-text-tertiary)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--v-text-tertiary)" }}>{message}</p>
        </div>
    );
}

function SkeletonRows({ cols }: { cols: number }) {
    return (
        <>
            {[...Array(4)].map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--v-border)" }}>
                    {[...Array(cols)].map((__, j) => (
                        <td key={j} className="px-4 py-3">
                            <div className="h-4 rounded-md animate-pulse"
                                style={{ background: "var(--v-elevated)", width: j === 0 ? "55%" : j === cols - 1 ? "35%" : "70%" }} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] font-medium"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--v-error)" }}>
            <AlertCircle size={16} className="shrink-0" />
            {message}
        </div>
    );
}

// ── Table shell ───────────────────────────────────────────────────────────────

function CustomerTable({
    headers, count, loading, icon: Icon, label, children, emptyIcon, emptyMessage,
}: {
    headers: string[]; count: number; loading: boolean;
    icon: React.ElementType; label: string; children: React.ReactNode;
    emptyIcon?: React.ElementType; emptyMessage?: string;
}) {
    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: "var(--v-card)", border: "1px solid var(--v-border)", boxShadow: "var(--v-shadow-card)" }}>
            {/* Header bar */}
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--v-elevated)" }}>
                    <Icon size={15} style={{ color: "var(--v-text-secondary)" }} />
                </div>
                <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{label}</span>
                {loading
                    ? <Loader2 size={13} className="ml-1 animate-spin" style={{ color: "var(--v-text-tertiary)" }} />
                    : <span className="ml-auto text-[11px] font-bold" style={{ color: "var(--v-text-tertiary)" }}>
                        {count} record{count !== 1 ? "s" : ""}
                      </span>
                }
            </div>
            {/* Table */}
            <div className="overflow-x-auto">
                {!loading && count === 0 ? (
                    <EmptyState icon={emptyIcon ?? Icon} message={emptyMessage ?? "No records found"} />
                ) : (
                    <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--v-border)", background: "var(--v-elevated)" }}>
                                {headers.map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                                        style={{ color: "var(--v-text-tertiary)" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{loading ? <SkeletonRows cols={headers.length} /> : children}</tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const rowProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "var(--v-card-hover)"; },
    onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "transparent"; },
    className: "transition-colors duration-100",
    style: { borderBottom: "1px solid var(--v-border)" } as React.CSSProperties,
};

// ─────────────────────────────────────────────────────────────────────────────
// Total Tab — merged online + manual with filter
// ─────────────────────────────────────────────────────────────────────────────

function TotalTab({ data }: { data: CRMData }) {
    const [filterQuery, setFilterQuery] = useState("");

    // Merge and deduplicate by email (online first, then manual)
    const merged = useMemo(() => {
        type Row = {
            id: string; name: string; email: string; phone: string;
            dob: string; event: string; source: "online" | "manual";
        };
        const rows: Row[] = [];
        const seen = new Set<string>();
        for (const c of data.online) {
            rows.push({ id: c.id, name: c.name, email: c.email, phone: c.phone, dob: "", event: c.eventName || "", source: "online" });
            if (c.email) seen.add(c.email.toLowerCase());
        }
        for (const c of data.manual) {
            if (!seen.has(c.email.toLowerCase())) {
                rows.push({ id: c.id, name: c.name, email: c.email, phone: c.phone, dob: c.dob, event: c.eventAppeared || "", source: "manual" });
            }
        }
        return rows;
    }, [data.online, data.manual]);

    // Real-time case-insensitive filter across name, email, phone, event, source label
    const filtered = useMemo(() => {
        const q = filterQuery.trim().toLowerCase();
        if (!q) return merged;
        return merged.filter((row) => {
            const sourceLabel = row.source === "online" ? "online" : "walk-in";
            return (
                row.name.toLowerCase().includes(q) ||
                row.email.toLowerCase().includes(q) ||
                row.phone.toLowerCase().includes(q) ||
                row.event.toLowerCase().includes(q) ||
                sourceLabel.includes(q)
            );
        });
    }, [merged, filterQuery]);

    return (
        <div className="space-y-4">
            {data.error && <ErrorBanner message={data.error} />}
            {/* Filter input */}
            <div className="relative">
                <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--v-text-tertiary)" }}
                />
                <input
                    type="text"
                    placeholder="Filter by name, email, phone, event, or source…"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    style={{
                        width: "100%",
                        background: "var(--v-card)",
                        border: "1px solid var(--v-border)",
                        borderRadius: 12,
                        padding: "9px 14px 9px 34px",
                        fontSize: 13,
                        color: "var(--v-text-primary)",
                        outline: "none",
                    }}
                />
            </div>

            {/* Table */}
            <CustomerTable
                headers={["Name", "Email", "Phone", "Date of Birth", "Age", "Event", "Source"]}
                count={filtered.length}
                loading={data.loading}
                icon={Users}
                label="All Customers"
                emptyMessage="No customers match your filter"
            >
                {filtered.map((c) => {
                    const age = calculateAge(c.dob);
                    const isOnline = c.source === "online";
                    return (
                        <tr key={`${c.source}-${c.id}`} {...rowProps}>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Avatar name={c.name} />
                                    <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{c.name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                                <span className="flex items-center gap-1.5">
                                    <Mail size={11} style={{ color: "var(--v-text-tertiary)", flexShrink: 0 }} />{c.email || "—"}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                                <span className="flex items-center gap-1.5">
                                    <Phone size={11} style={{ color: "var(--v-text-tertiary)", flexShrink: 0 }} />{c.phone || "—"}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.dob ? fmtDate(c.dob) : "—"}</td>
                            <td className="px-4 py-3">
                                {c.dob ? <AgeBadge age={age} /> : <span style={{ color: "var(--v-text-tertiary)" }}>—</span>}
                            </td>
                            <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "var(--v-text-primary)" }}>{c.event || "—"}</td>
                            <td className="px-4 py-3">
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                                    style={{
                                        background: isOnline ? "rgba(129,140,248,0.1)" : "rgba(244,74,34,0.1)",
                                        color: isOnline ? "var(--v-info)" : "var(--v-orange)",
                                    }}
                                >
                                    {isOnline ? "Online" : "Walk-in"}
                                </span>
                            </td>
                        </tr>
                    );
                })}
            </CustomerTable>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats strip — reads from already-fetched data, no extra requests
// ─────────────────────────────────────────────────────────────────────────────

function StatsStrip({ data }: { data: CRMData }) {
    const total = data.online.length + data.manual.length;
    return (
        <div className="mb-6">
            <div className="p-4 rounded-xl w-fit min-w-[160px]"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--v-text-tertiary)" }}>
                    Total Customers
                </div>
                <div className="text-2xl font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                    {data.loading
                        ? <span className="inline-block w-8 h-6 rounded-md animate-pulse" style={{ background: "var(--v-elevated)" }} />
                        : total}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM Page — fetches once, shares data with TotalTab
// ─────────────────────────────────────────────────────────────────────────────

export default function CRMPage() {
    const { user, profile } = useDashboardAuth();
    const venueId: string = profile?.activeMembership?.partnerId ?? "";

    // ── Single shared data state ─────────────────────────────────────────────
    const [crmData, setCrmData] = useState<CRMData>({
        online: [], manual: [], loading: true, error: null,
    });

    // ── Fetch both datasets in parallel, once, on mount ──────────────────────
    useEffect(() => {
        if (!user || !venueId) return;
        let cancelled = false;

        setCrmData({ online: [], manual: [], loading: true, error: null });

        const base = `?venueId=${encodeURIComponent(venueId)}`;
        Promise.all([
            authFetch(user, `/api/venue/crm/online${base}`).then((r) => r.json()).catch(() => ({ customers: [], error: "Failed to load online customers" })),
            authFetch(user, `/api/venue/crm/customers${base}`).then((r) => r.json()).catch(() => ({ customers: [], error: "Failed to load walk-in customers" })),
        ])
            .then(([onlineData, manualData]) => {
                if (cancelled) return;
                // Surface the first error as a warning but still render whatever data loaded
                const err = onlineData.error || manualData.error || null;
                setCrmData({
                    online:  onlineData.customers  ?? [],
                    manual:  manualData.customers  ?? [],
                    loading: false,
                    error:   err,
                });
            })
            .catch((err) => {
                if (!cancelled) setCrmData({ online: [], manual: [], loading: false, error: err.message });
            });

        return () => { cancelled = true; };
    }, [user, venueId]);

    // ── Wait for Firebase auth ───────────────────────────────────────────────
    if (!user) {
        return (
            <VenuePageShell title="CRM" subtitle="Customer relationship management">
                <div className="flex items-center justify-center py-32">
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--v-text-tertiary)" }} />
                </div>
            </VenuePageShell>
        );
    }

    return (
        <VenuePageShell
            title="CRM"
            subtitle="Customer relationship management — track every guest across online and walk-in channels."
        >
            {/* Stats (shared data — no extra fetch) */}
            <StatsStrip data={crmData} />

            {/* Guard */}
            {!venueId ? (
                <ErrorBanner message="Venue ID not found. Please reload or re-login." />
            ) : (
                <TotalTab data={crmData} />
            )}
        </VenuePageShell>
    );
}
