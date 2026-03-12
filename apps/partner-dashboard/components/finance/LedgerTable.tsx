"use client";

import { useState } from "react";
import clsx from "clsx";
import {
    Search, Download, Filter, ChevronDown, ChevronRight,
    ArrowUpRight, ArrowDownLeft, Clock, ExternalLink,
} from "lucide-react";
import type {
    LedgerTransaction,
    TransactionCategory,
    SettlementStatus,
} from "@/lib/finance/definitions";
import {
    formatINR,
    SETTLEMENT_STATUS_CONFIG,
    TRANSACTION_CATEGORY_LABELS,
} from "@/lib/finance/definitions";

// ── Types ────────────────────────────────────────────────────────────────────

interface LedgerTableProps {
    transactions: LedgerTransaction[];
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    onExportCSV?: () => void;
    onSearch?: (q: string) => void;
    onCategoryFilter?: (cat: TransactionCategory | "") => void;
    onStatusFilter?: (status: SettlementStatus | "") => void;
    totalCount?: number;
    page?: number;
    onPageChange?: (page: number) => void;
    pageSize?: number;
}

// ── Category filter options ──────────────────────────────────────────────────

const CATEGORY_OPTIONS: Array<{ value: TransactionCategory | ""; label: string }> = [
    { value: "",                   label: "All Categories" },
    { value: "ticket_sale",        label: "Ticket Sales" },
    { value: "cover_payment",      label: "Cover Charge" },
    { value: "table_booking",      label: "Table Bookings" },
    { value: "bottle_booking",     label: "Bottle Service" },
    { value: "tip",                label: "Tips" },
    { value: "commission_accrual", label: "Commissions" },
    { value: "refund",             label: "Refunds" },
    { value: "chargeback",         label: "Chargebacks" },
    { value: "processor_fee",      label: "Processor Fees" },
    { value: "platform_fee",       label: "Platform Fees" },
    { value: "payout_initiated",   label: "Payouts" },
    { value: "manual_adjustment",  label: "Adjustments" },
];

const STATUS_OPTIONS: Array<{ value: SettlementStatus | ""; label: string }> = [
    { value: "",           label: "All Statuses" },
    { value: "pending",    label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "paid",       label: "Paid" },
    { value: "failed",     label: "Failed" },
    { value: "held",       label: "Held" },
    { value: "reversed",   label: "Reversed" },
];

// ── LedgerTable ──────────────────────────────────────────────────────────────

export function LedgerTable({
    transactions,
    loading = false,
    error = false,
    onRetry,
    onExportCSV,
    onSearch,
    onCategoryFilter,
    onStatusFilter,
    totalCount = 0,
    page = 1,
    onPageChange,
    pageSize = 50,
}: LedgerTableProps) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [catFilter, setCatFilter] = useState<TransactionCategory | "">("");
    const [statusFilter, setStatusFilter] = useState<SettlementStatus | "">("");

    const handleSearch = (q: string) => {
        setSearch(q);
        onSearch?.(q);
    };

    const handleCat = (cat: TransactionCategory | "") => {
        setCatFilter(cat);
        onCategoryFilter?.(cat);
    };

    const handleStatus = (s: SettlementStatus | "") => {
        setStatusFilter(s);
        onStatusFilter?.(s);
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="flex flex-col gap-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 p-4 flex-wrap" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--v-text-muted)" }} />
                        <input
                            type="text"
                            placeholder="Search by ID or description…"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 pr-3 py-2 text-[12px] rounded-xl outline-none focus:ring-1 focus:ring-[var(--v-orange)]"
                            style={{
                                background: "var(--v-elevated)",
                                color: "var(--v-text-primary)",
                                border: "1px solid var(--v-border)",
                                width: 220,
                            }}
                        />
                    </div>

                    {/* Category filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--v-text-muted)" }} />
                        <select
                            value={catFilter}
                            onChange={(e) => handleCat(e.target.value as TransactionCategory | "")}
                            className="pl-8 pr-7 py-2 text-[12px] rounded-xl outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-[var(--v-orange)]"
                            style={{
                                background: "var(--v-elevated)",
                                color: "var(--v-text-secondary)",
                                border: "1px solid var(--v-border)",
                            }}
                        >
                            {CATEGORY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "var(--v-text-muted)" }} />
                    </div>

                    {/* Status filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => handleStatus(e.target.value as SettlementStatus | "")}
                            className="px-3 py-2 text-[12px] rounded-xl outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-[var(--v-orange)]"
                            style={{
                                background: "var(--v-elevated)",
                                color: "var(--v-text-secondary)",
                                border: "1px solid var(--v-border)",
                                paddingRight: 28,
                            }}
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "var(--v-text-muted)" }} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {totalCount > 0 && (
                        <span className="text-[11px] tabular-nums" style={{ color: "var(--v-text-muted)" }}>
                            {totalCount.toLocaleString("en-IN")} entries
                        </span>
                    )}
                    {onExportCSV && (
                        <button
                            onClick={onExportCSV}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all hover:brightness-110"
                            style={{
                                background: "var(--v-elevated)",
                                color: "var(--v-text-secondary)",
                                border: "1px solid var(--v-border)",
                            }}
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Column Headers */}
            <div
                className="grid items-center px-5 py-3"
                style={{
                    gridTemplateColumns: "120px 1fr 110px 120px 130px 100px 32px",
                    background: "var(--v-elevated)",
                    borderBottom: "1px solid var(--v-border)",
                }}
            >
                {["TXN ID", "DESCRIPTION", "AMOUNT", "CATEGORY", "STATUS", "DATE", ""].map((h) => (
                    <span key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                        {h}
                    </span>
                ))}
            </div>

            {/* Rows */}
            <div>
                {loading ? (
                    <LedgerSkeleton />
                ) : error ? (
                    <LedgerError onRetry={onRetry} />
                ) : transactions.length === 0 ? (
                    <LedgerEmpty />
                ) : (
                    transactions.map((tx) => (
                        <LedgerRow
                            key={tx.id}
                            tx={tx}
                            expanded={expandedRow === tx.id}
                            onToggle={() => setExpandedRow(expandedRow === tx.id ? null : tx.id)}
                        />
                    ))
                )}
            </div>

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
                <div
                    className="flex items-center justify-between px-5 py-4"
                    style={{ borderTop: "1px solid var(--v-border)" }}
                >
                    <span className="text-[12px]" style={{ color: "var(--v-text-muted)" }}>
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => onPageChange?.(page - 1)}
                            disabled={page <= 1}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
                            style={{
                                background: "var(--v-elevated)",
                                color: "var(--v-text-secondary)",
                                border: "1px solid var(--v-border)",
                            }}
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => onPageChange?.(page + 1)}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
                            style={{
                                background: "var(--v-elevated)",
                                color: "var(--v-text-secondary)",
                                border: "1px solid var(--v-border)",
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── LedgerRow ────────────────────────────────────────────────────────────────

function LedgerRow({
    tx,
    expanded,
    onToggle,
}: {
    tx: LedgerTransaction;
    expanded: boolean;
    onToggle: () => void;
}) {
    const statusCfg = SETTLEMENT_STATUS_CONFIG[tx.status] || SETTLEMENT_STATUS_CONFIG.pending;
    const isIn = tx.direction === "in";
    const date = new Date(tx.timestamp);
    const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
    const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    return (
        <>
            <div
                className="grid items-center px-5 py-3.5 cursor-pointer transition-all duration-100"
                style={{
                    gridTemplateColumns: "120px 1fr 110px 120px 130px 100px 32px",
                    borderBottom: "1px solid var(--v-border)",
                    background: expanded ? "var(--v-elevated)" : "transparent",
                }}
                onClick={onToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onToggle()}
            >
                {/* TXN ID */}
                <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                    TR-{tx.id.slice(-6).toUpperCase()}
                </span>

                {/* Description */}
                <div className="min-w-0 pr-4">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--v-text-primary)" }}>
                        {tx.description || TRANSACTION_CATEGORY_LABELS[tx.category as TransactionCategory] || tx.category}
                    </p>
                    {tx.eventName && (
                        <p className="text-[11px] truncate" style={{ color: "var(--v-text-muted)" }}>
                            {tx.eventName}
                        </p>
                    )}
                </div>

                {/* Amount */}
                <div className="flex items-center gap-1.5">
                    {isIn
                        ? <ArrowUpRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#34D399" }} />
                        : <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" style={{ color: "#F87171" }} />
                    }
                    <span
                        className="text-[14px] font-bold tabular-nums"
                        style={{ color: isIn ? "#34D399" : "#F87171" }}
                    >
                        {isIn ? "+" : "-"}{formatINR(tx.amount)}
                    </span>
                </div>

                {/* Category */}
                <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full w-fit truncate"
                    style={{ background: "var(--v-elevated)", color: "var(--v-text-muted)", border: "1px solid var(--v-border)" }}
                >
                    {TRANSACTION_CATEGORY_LABELS[tx.category as TransactionCategory] || tx.category}
                </span>

                {/* Status */}
                <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full w-fit"
                    style={{ background: statusCfg.bg, color: statusCfg.text }}
                >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusCfg.dot }} />
                    {statusCfg.label}
                </span>

                {/* Date */}
                <div>
                    <p className="text-[12px]" style={{ color: "var(--v-text-secondary)" }}>{dateStr}</p>
                    <p className="text-[10px]" style={{ color: "var(--v-text-muted)" }}>{timeStr}</p>
                </div>

                {/* Expand toggle */}
                <ChevronRight
                    className={clsx("w-4 h-4 transition-transform duration-200", expanded && "rotate-90")}
                    style={{ color: "var(--v-text-muted)" }}
                />
            </div>

            {/* Expanded detail row */}
            {expanded && (
                <div
                    className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
                    style={{
                        background: "var(--v-hero)",
                        borderBottom: "1px solid var(--v-border)",
                    }}
                >
                    <DetailCell label="Transaction ID" value={`TR-${tx.id}`} mono />
                    <DetailCell label="Net Amount" value={tx.netAmount != null ? formatINR(tx.netAmount) : "—"} />
                    <DetailCell label="Processor Fee" value={tx.processorFee ? formatINR(tx.processorFee) : "—"} />
                    <DetailCell label="Platform Fee" value={tx.platformFee ? formatINR(tx.platformFee) : "—"} />
                    <DetailCell label="Payment Source" value={tx.paymentSource || "—"} />
                    <DetailCell label="Settlement Batch" value={tx.settlementBatchId || "—"} mono />
                    <DetailCell label="Origin" value={tx.originPath?.replace(/_/g, " ") || "—"} />
                    {tx.partnerName && <DetailCell label="Partner" value={tx.partnerName} />}
                    {tx.notes && (
                        <div className="col-span-2">
                            <DetailCell label="Notes" value={tx.notes} />
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

function DetailCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--v-text-muted)" }}>
                {label}
            </p>
            <p
                className={clsx("text-[12px]", mono && "font-mono")}
                style={{ color: "var(--v-text-secondary)" }}
            >
                {value}
            </p>
        </div>
    );
}

// ── States ───────────────────────────────────────────────────────────────────

function LedgerSkeleton() {
    return (
        <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid items-center px-5 py-4" style={{ gridTemplateColumns: "120px 1fr 110px 120px 130px 100px 32px" }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                        <div key={j} className="v-skeleton h-4 rounded" style={{ width: `${60 + j * 8}%`, maxWidth: 120 }} />
                    ))}
                    <div />
                </div>
            ))}
        </div>
    );
}

function LedgerError({ onRetry }: { onRetry?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-[14px]" style={{ color: "var(--v-text-secondary)" }}>Failed to load transactions.</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold"
                    style={{ background: "var(--v-elevated)", color: "var(--v-text-primary)", border: "1px solid var(--v-border)" }}
                >
                    Retry
                </button>
            )}
        </div>
    );
}

function LedgerEmpty() {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Clock className="w-8 h-8" style={{ color: "var(--v-text-muted)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--v-text-secondary)" }}>No transactions found</p>
            <p className="text-[12px]" style={{ color: "var(--v-text-muted)" }}>Try adjusting your filters or date range.</p>
        </div>
    );
}

export default LedgerTable;
