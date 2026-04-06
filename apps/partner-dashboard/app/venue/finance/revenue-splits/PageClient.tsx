"use client";

import { SplitSquareVertical, ArrowDown, Building2, Users, Banknote, Wallet, Info, Settings } from "lucide-react";

function SplitFlowRow({
    icon: Icon,
    label,
    sublabel,
    amount,
    accent,
    accentBg,
    isNet,
}: {
    icon: React.ElementType;
    label: string;
    sublabel: string;
    amount: string;
    accent: string;
    accentBg: string;
    isNet?: boolean;
}) {
    return (
        <div
            className="flex items-center gap-4 rounded-xl p-4"
            style={{
                background: isNet ? accentBg : "var(--v-card)",
                border: `1px solid ${isNet ? accent + "40" : "var(--v-border)"}`,
            }}
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: accentBg, border: `1px solid ${accent}30` }}
            >
                <Icon className="w-5 h-5" style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>{sublabel}</p>
            </div>
            <p
                className="text-[20px] font-black tabular-nums shrink-0"
                style={{ color: isNet ? accent : "var(--v-text-primary)" }}
            >
                {amount}
            </p>
        </div>
    );
}

export function RevenueSplitsClient() {
    return (
        <div className="space-y-6">
            {/* Info banner */}
            <div
                className="flex items-start gap-3 rounded-2xl p-4"
                style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.18)" }}
            >
                <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#818CF8" }} />
                <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#818CF8" }}>
                        Revenue split automation is coming soon
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-secondary)" }}>
                        Once active, every ticket sale automatically routes funds to the right wallets — no manual settlement needed. Splits are configured per event.
                    </p>
                </div>
            </div>

            {/* How splits work */}
            <div
                className="rounded-2xl p-6"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
            >
                <p
                    className="text-[11px] font-bold uppercase tracking-widest mb-5"
                    style={{ color: "var(--v-text-tertiary)" }}
                >
                    How a Ticket Sale is Split
                </p>

                <div className="flex flex-col gap-2">
                    {/* Full sale amount */}
                    <SplitFlowRow
                        icon={Wallet}
                        label="Ticket Sale"
                        sublabel="Total amount paid by the guest"
                        amount="₹1,000"
                        accent="#F44A22"
                        accentBg="rgba(244,74,34,0.08)"
                    />

                    {/* Arrow */}
                    <div className="flex justify-center">
                        <ArrowDown className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                    </div>

                    {/* Promoter deduction */}
                    <SplitFlowRow
                        icon={Banknote}
                        label="Promoter Commission"
                        sublabel="Deducted first if a promoter code was used · configurable % per event"
                        amount="− ₹100"
                        accent="#FBBF24"
                        accentBg="rgba(251,191,36,0.08)"
                    />

                    {/* Arrow */}
                    <div className="flex justify-center">
                        <ArrowDown className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                    </div>

                    {/* Host deduction */}
                    <SplitFlowRow
                        icon={Users}
                        label="Host Share"
                        sublabel="Deducted if event is hosted by an external host · configurable % per event"
                        amount="− ₹150"
                        accent="#818CF8"
                        accentBg="rgba(129,140,248,0.08)"
                    />

                    {/* Arrow */}
                    <div className="flex justify-center">
                        <ArrowDown className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                    </div>

                    {/* Net to club */}
                    <SplitFlowRow
                        icon={Building2}
                        label="Net to Club Wallet"
                        sublabel="Remaining amount credited to your venue wallet after all deductions"
                        amount="₹750"
                        accent="#34D399"
                        accentBg="rgba(52,211,153,0.08)"
                        isNet
                    />
                </div>

                <p className="text-[11px] mt-4" style={{ color: "var(--v-text-tertiary)" }}>
                    * Example uses placeholder values. Actual splits are configured per event at the time of ticket tier setup.
                </p>
            </div>

            {/* Rules */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    {
                        icon: Banknote,
                        title: "Promoter commission first",
                        desc: "If a guest used a promoter code at checkout, the promoter's commission is deducted from the full ticket price before any other split.",
                        accent: "#FBBF24",
                        bg: "rgba(251,191,36,0.08)",
                    },
                    {
                        icon: Users,
                        title: "Host split next",
                        desc: "If the event is hosted by an external host (not the venue itself), a configurable percentage of the remaining amount goes to the host's wallet.",
                        accent: "#818CF8",
                        bg: "rgba(129,140,248,0.08)",
                    },
                    {
                        icon: Settings,
                        title: "Configured per event",
                        desc: "Split percentages are set on each event — not a fixed venue-wide rule. This allows flexible arrangements for different events and partners.",
                        accent: "#F44A22",
                        bg: "rgba(244,74,34,0.08)",
                    },
                ].map((item) => (
                    <div
                        key={item.title}
                        className="rounded-xl p-4 flex flex-col gap-2"
                        style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: item.bg }}
                        >
                            <item.icon className="w-4 h-4" style={{ color: item.accent }} />
                        </div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{item.title}</p>
                        <p className="text-[12px] leading-relaxed" style={{ color: "var(--v-text-tertiary)" }}>{item.desc}</p>
                    </div>
                ))}
            </div>

            {/* Empty state — no events with splits yet */}
            <div>
                <p
                    className="text-[11px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: "var(--v-text-tertiary)" }}
                >
                    Events with Split Configuration
                </p>
                <div
                    className="rounded-2xl py-14 flex flex-col items-center gap-4"
                    style={{ border: "2px dashed var(--v-border)" }}
                >
                    <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{ background: "var(--v-elevated)" }}
                    >
                        <SplitSquareVertical className="w-7 h-7" style={{ color: "var(--v-text-tertiary)" }} />
                    </div>
                    <div className="text-center">
                        <p className="text-[14px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                            No split configurations yet
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: "var(--v-text-tertiary)" }}>
                            Revenue split rules will appear here once configured on individual events.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
