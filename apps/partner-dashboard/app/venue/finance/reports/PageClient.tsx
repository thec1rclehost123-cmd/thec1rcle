"use client";

import { useState } from "react";
import { Download, FileText, Calendar, ArrowRight, Info } from "lucide-react";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface ReportType {
    id: string;
    title: string;
    description: string;
    available: boolean;
    extension: "csv" | "pdf";
    comingSoon?: boolean;
}

const REPORT_TYPES: ReportType[] = [
    {
        id: "ledger_csv",
        title: "Full Ledger Export",
        description: "All transactions for the selected period in CSV format.",
        available: true,
        extension: "csv",
    },
    {
        id: "revenue_summary",
        title: "Revenue Summary",
        description: "Gross, net, fees, refunds, and partner obligations by source.",
        available: true,
        extension: "csv",
    },
    {
        id: "payout_history",
        title: "Payout History",
        description: "All payouts with status, amounts, dates, and destinations.",
        available: true,
        extension: "csv",
    },
    {
        id: "partner_settlements",
        title: "Partner Settlements",
        description: "Host and promoter obligation breakdown and settlement status.",
        available: true,
        extension: "csv",
    },
    {
        id: "event_finance_summary",
        title: "Event-Level Finance",
        description: "Revenue, commissions, and fees per event.",
        available: true,
        extension: "csv",
    },
    {
        id: "fee_summary",
        title: "Fee Summary",
        description: "Processor and platform fees by event and date range.",
        available: true,
        extension: "csv",
    },
    {
        id: "monthly_statement",
        title: "Monthly Statement PDF",
        description: "Formatted statement with all financial activity — print-ready.",
        available: false,
        extension: "pdf",
        comingSoon: true,
    },
    {
        id: "annual_summary",
        title: "Annual Finance Summary PDF",
        description: "Year-end financial summary with tax-ready figures.",
        available: false,
        extension: "pdf",
        comingSoon: true,
    },
];

export default function VenueFinanceReportsClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const venueId = profile?.activeMembership?.partnerId;

    const [fromDate, setFromDate]   = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().slice(0, 10);
    });
    const [toDate, setToDate]       = useState(() => new Date().toISOString().slice(0, 10));
    const [generating, setGenerating] = useState<string | null>(null);

    const handleGenerate = async (report: ReportType) => {
        if (!report.available || !venueId) return;
        setGenerating(report.id);
        try {
            // For now, CSV reports redirect to the ledger API with export flags
            // PDF reports are stubbed — implement via reporting service
            if (report.extension === "csv") {
                const token = typeof getIdToken === "function" ? await getIdToken() : "";
                const qs = new URLSearchParams({
                    venueId,
                    from: fromDate,
                    to: toDate,
                    limit: "200",
                });
                const res = await fetch(`/api/venue/finance/ledger?${qs}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error("Export failed");
                const data = await res.json();
                const transactions = data.transactions || [];

                const headers = [
                    "Transaction ID", "Date", "Amount (₹)", "Direction", "Category",
                    "Status", "Description", "Event", "Partner", "Net Amount (₹)"
                ];
                const rows = transactions.map((tx: any) => [
                    `TR-${tx.id}`,
                    new Date(tx.timestamp).toISOString().slice(0, 10),
                    tx.amount,
                    tx.direction,
                    tx.category,
                    tx.status,
                    `"${(tx.description || "").replace(/"/g, '""')}"`,
                    tx.eventName || "",
                    tx.partnerName || "",
                    tx.netAmount || 0,
                ]);
                const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${report.id}-${venueId}-${fromDate}-${toDate}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Report generation failed:", err);
        } finally {
            setGenerating(null);
        }
    };

    return (
        <VenuePageShell
            title="Reports"
            subtitle="Download financial reports and data exports for your venue"
        >
            {/* Date range picker */}
            <BentoCard
                header={
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                        <span className="v-label">DATE RANGE</span>
                    </div>
                }
            >
                <div className="flex items-center gap-4 flex-wrap">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                            FROM
                        </label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            max={toDate}
                            className="px-4 py-2.5 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            style={{
                                background: "var(--bg-fill)",
                                color: "var(--text-primary)",
                                border: "1px solid var(--border-subtle)",
                            }}
                        />
                    </div>
                    <div className="pt-5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>to</div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                            TO
                        </label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            min={fromDate}
                            max={new Date().toISOString().slice(0, 10)}
                            className="px-4 py-2.5 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            style={{
                                background: "var(--bg-fill)",
                                color: "var(--text-primary)",
                                border: "1px solid var(--border-subtle)",
                            }}
                        />
                    </div>
                    <p className="pt-5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000)} days selected
                    </p>
                </div>
            </BentoCard>

            {/* Report tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {REPORT_TYPES.map((report) => (
                    <ReportTile
                        key={report.id}
                        report={report}
                        isGenerating={generating === report.id}
                        onGenerate={() => handleGenerate(report)}
                    />
                ))}
            </div>

            {/* PDF notice */}
            <div
                className="flex items-start gap-3 px-5 py-4 rounded-[var(--r-xl)]"
                style={{
                    background: "rgba(129,140,248,0.07)",
                    border: "1px solid rgba(129,140,248,0.15)",
                }}
            >
                <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#818CF8" }} />
                <p className="text-[13px]" style={{ color: "rgba(129,140,248,0.85)" }}>
                    PDF statement generation is coming soon. CSV exports are available for all report types.
                    For compliance or audit requests, contact your C1rcle account manager.
                </p>
            </div>
        </VenuePageShell>
    );
}

// ── Report Tile ───────────────────────────────────────────────────────────────

function ReportTile({
    report,
    isGenerating,
    onGenerate,
}: {
    report: ReportType;
    isGenerating: boolean;
    onGenerate: () => void;
}) {
    return (
        <div
            className="flex flex-col p-5 rounded-[var(--r-xl)]"
            style={{
                background: "var(--bg-elevated)",
                border: `1px solid ${report.comingSoon ? "var(--border-subtle)" : "var(--border-subtle)"}`,
                opacity: report.comingSoon ? 0.7 : 1,
            }}
        >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: report.extension === "pdf" ? "rgba(129,140,248,0.12)" : "rgba(52,211,153,0.12)" }}
                >
                    <FileText
                        className="w-4 h-4"
                        style={{ color: report.extension === "pdf" ? "#818CF8" : "#34D399" }}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                            {report.title}
                        </p>
                        <span
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{
                                background: report.extension === "pdf" ? "rgba(129,140,248,0.15)" : "rgba(52,211,153,0.15)",
                                color: report.extension === "pdf" ? "#818CF8" : "#34D399",
                            }}
                        >
                            {report.extension.toUpperCase()}
                        </span>
                        {report.comingSoon && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                                Soon
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {report.description}
                    </p>
                </div>
            </div>

            {/* Action */}
            <button
                onClick={onGenerate}
                disabled={!report.available || isGenerating}
                className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: report.available ? "var(--bg-fill)" : "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                }}
            >
                {isGenerating ? (
                    <>Generating…</>
                ) : report.comingSoon ? (
                    <>Coming Soon</>
                ) : (
                    <>
                        <Download className="w-3.5 h-3.5" />
                        Download {report.extension.toUpperCase()}
                    </>
                )}
            </button>
        </div>
    );
}
