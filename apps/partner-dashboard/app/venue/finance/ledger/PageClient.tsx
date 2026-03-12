"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";
import { LedgerTable } from "@/components/finance/LedgerTable";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { Download } from "lucide-react";
import type { LedgerTransaction, TransactionCategory, SettlementStatus } from "@/lib/finance/definitions";

const PAGE_SIZE = 50;

export default function VenueFinanceLedgerClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const venueId = profile?.activeMembership?.partnerId;
    const searchParams = useSearchParams();

    const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
    const [totalCount, setTotalCount]     = useState(0);
    const [page, setPage]                 = useState(1);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState(false);
    const [exporting, setExporting]       = useState(false);

    // Filter state — sync with URL params for deep-link support
    const [search, setSearch]   = useState(searchParams.get("search") || "");
    const [category, setCategory] = useState<TransactionCategory | "">((searchParams.get("category") || "") as any);
    const [status, setStatus]   = useState<SettlementStatus | "">((searchParams.get("status") || "") as any);

    // Debounce search
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchLedger = useCallback(async (opts?: {
        p?: number;
        q?: string;
        cat?: TransactionCategory | "";
        st?: SettlementStatus | "";
    }) => {
        if (!venueId) return;
        const p   = opts?.p   ?? page;
        const q   = opts?.q   ?? search;
        const cat = opts?.cat ?? category;
        const st  = opts?.st  ?? status;

        setLoading(true);
        setError(false);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const qs = new URLSearchParams({
                venueId,
                page: String(p),
                limit: String(PAGE_SIZE),
                ...(q   && { search: q }),
                ...(cat && { category: cat }),
                ...(st  && { status: st }),
            });

            const res = await fetch(`/api/venue/finance/ledger?${qs}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            setTransactions(data.transactions || []);
            setTotalCount(data.pagination?.total || 0);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [venueId, page, search, category, status, getIdToken]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSearch = (q: string) => {
        setSearch(q);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => {
            setPage(1);
            fetchLedger({ p: 1, q });
        }, 350);
    };

    const handleCategory = (cat: TransactionCategory | "") => {
        setCategory(cat);
        setPage(1);
        fetchLedger({ p: 1, cat });
    };

    const handleStatus = (st: SettlementStatus | "") => {
        setStatus(st);
        setPage(1);
        fetchLedger({ p: 1, st });
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchLedger({ p: newPage });
    };

    // ── CSV Export ────────────────────────────────────────────────────────────

    const handleExportCSV = async () => {
        if (!transactions.length) return;
        setExporting(true);
        try {
            const headers = [
                "Transaction ID", "Date", "Amount (₹)", "Direction", "Category",
                "Status", "Description", "Event", "Partner", "Payment Source",
                "Settlement Batch", "Processor Fee (₹)", "Platform Fee (₹)", "Net Amount (₹)"
            ];
            const rows = transactions.map((tx) => [
                `TR-${tx.id}`,
                new Date(tx.timestamp).toISOString(),
                tx.amount,
                tx.direction,
                tx.category,
                tx.status,
                `"${(tx.description || "").replace(/"/g, "\"\"")}"`,
                tx.eventName || "",
                tx.partnerName || "",
                tx.paymentSource || "",
                tx.settlementBatchId || "",
                tx.processorFee || 0,
                tx.platformFee || 0,
                tx.netAmount || 0,
            ]);

            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ledger-${venueId}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    return (
        <VenuePageShell
            title="Ledger"
            subtitle="Complete transaction history for your venue"
            actions={
                <VenueActionButton
                    variant="secondary"
                    onClick={handleExportCSV}
                    disabled={exporting || loading || transactions.length === 0}
                >
                    <Download className="w-3.5 h-3.5" />
                    {exporting ? "Exporting…" : "Export CSV"}
                </VenueActionButton>
            }
        >
            <BentoCard padding="sm" empty={false}>
                <LedgerTable
                    transactions={transactions}
                    loading={loading}
                    error={error}
                    onRetry={() => fetchLedger()}
                    onExportCSV={handleExportCSV}
                    onSearch={handleSearch}
                    onCategoryFilter={handleCategory}
                    onStatusFilter={handleStatus}
                    totalCount={totalCount}
                    page={page}
                    onPageChange={handlePageChange}
                    pageSize={PAGE_SIZE}
                />
            </BentoCard>
        </VenuePageShell>
    );
}
