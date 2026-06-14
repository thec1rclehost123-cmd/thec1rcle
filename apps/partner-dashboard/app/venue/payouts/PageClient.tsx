"use client";

import { useState } from "react";
import {
    Banknote,
    Download,
    Clock,
    CheckCircle2,
    AlertCircle,
    Search,
    CreditCard,
} from "lucide-react";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { AppleHeroStat } from "@/components/ui/AppleHeroStat";
import { VenueStatStrip } from "@/components/ui/VenueStatStrip";
import { BentoCard } from "@/components/ui/BentoCard";

const MOCK_PAYOUTS = [
    { id: "PY-88219", amount: 68400, date: "2026-01-25", status: "completed", account: "HDFC •••• 8821" },
    { id: "PY-88104", amount: 42100, date: "2026-01-18", status: "completed", account: "HDFC •••• 8821" },
    { id: "PY-88002", amount: 125000, date: "2026-01-11", status: "completed", account: "HDFC •••• 8821" },
    { id: "PY-87941", amount: 35600, date: "2026-01-04", status: "failed", account: "ICICI •••• 1102" },
];

function fmtCurrency(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
}

export default function PayoutsPage() {
    const [payouts] = useState(MOCK_PAYOUTS);
    const [search, setSearch] = useState("");

    const filtered = payouts.filter(p => p.id.toLowerCase().includes(search.toLowerCase()));
    const totalSettled = payouts.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0);

    return (
        <VenuePageShell
            title="Payouts"
            subtitle="Track your earnings and bank transfers"
            actions={
                <VenueActionButton variant="secondary">
                    <Download className="w-4 h-4" /> Export CSV
                </VenueActionButton>
            }
        >
            {/* Hero balance */}
            <AppleHeroStat
                label="AVAILABLE BALANCE"
                value="₹48,200"
                subtitle="Settling in 2 days · HDFC Bank •••• 8821"
                cta={{ label: "Withdraw", href: "#" }}
            />

            {/* Financial strip */}
            <VenueStatStrip
                stats={[
                    { label: "TOTAL SETTLED (JAN)", value: fmtCurrency(totalSettled), trend: { value: "+12% vs Dec", direction: "up" } },
                    { label: "PENDING PAYOUT", value: "₹48,200" },
                    {
                        label: "ACTIVE BANK",
                        value: "HDFC •••• 8821",
                        icon: <CreditCard className="w-3.5 h-3.5" />,
                    },
                ]}
                columns={3}
            />

            {/* Payout history */}
            <BentoCard
                header={
                    <>
                        <span className="v-label">TRANSFER HISTORY</span>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--v-text-muted)" }} />
                            <input
                                type="text"
                                placeholder="Search by ID..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 text-[12px] rounded-xl outline-none focus:ring-1"
                                style={{
                                    background: "var(--v-elevated)",
                                    color: "var(--v-text-primary)",
                                    border: "1px solid var(--v-border)",
                                    width: 180,
                                }}
                            />
                        </div>
                    </>
                }
                padding="sm"
            >
                {/* Table header */}
                <div
                    className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr_40px] px-5 py-3 rounded-xl mb-1"
                    style={{ background: "var(--v-elevated)" }}
                >
                    {["PAYOUT ID", "DATE", "AMOUNT", "DESTINATION", "STATUS", ""].map((h) => (
                        <span key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                            {h}
                        </span>
                    ))}
                </div>

                {/* Rows */}
                <div className="space-y-1">
                    {filtered.map(p => {
                        const ok = p.status === "completed";
                        return (
                            <div
                                key={p.id}
                                className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr_40px] px-5 py-3 rounded-xl items-center transition-colors hover:brightness-125"
                                style={{ background: "var(--v-elevated)" }}
                            >
                                <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                    #{p.id}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--v-text-muted)" }} />
                                    <span className="text-[12px]" style={{ color: "var(--v-text-secondary)" }}>{p.date}</span>
                                </div>
                                <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                    {fmtCurrency(p.amount)}
                                </span>
                                <span
                                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full w-fit"
                                    style={{ background: "var(--v-card)", color: "var(--v-text-muted)" }}
                                >
                                    {p.account}
                                </span>
                                <div>
                                    <span
                                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                                        style={{
                                            background: ok ? "var(--v-success-bg)" : "var(--v-error-bg)",
                                            color: ok ? "var(--v-success)" : "var(--v-error)",
                                        }}
                                    >
                                        {ok
                                            ? <><CheckCircle2 className="w-2.5 h-2.5" /> Settled</>
                                            : <><AlertCircle className="w-2.5 h-2.5" /> Retrying</>
                                        }
                                    </span>
                                </div>
                                <button
                                    className="p-1.5 rounded-lg transition-colors hover:brightness-125"
                                    style={{ color: "var(--v-text-muted)" }}
                                    aria-label="Download invoice"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </BentoCard>
        </VenuePageShell>
    );
}
