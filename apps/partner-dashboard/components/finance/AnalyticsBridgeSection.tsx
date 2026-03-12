"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Users, Ticket, DoorOpen, Zap, TrendingUp } from "lucide-react";
import type { FinanceProfileType } from "@/lib/finance/definitions";

interface BridgeLink {
    label: string;
    description: string;
    href: string;
    icon: React.ElementType;
    color: string;
}

interface AnalyticsBridgeSectionProps {
    profileType: FinanceProfileType;
    partnerId?: string;
    eventId?: string;
    timeRange?: string;
}

// ── Analytics Bridge link config by profile type ──────────────────────────

function getBridgeLinks(
    profileType: FinanceProfileType,
    partnerId?: string,
    timeRange = "30d"
): BridgeLink[] {
    const base = `?period=${timeRange}${partnerId ? `&partnerId=${partnerId}` : ""}`;

    if (profileType === "venue") {
        return [
            {
                label: "Ticket Revenue",
                description: "Source breakdown by channel and time",
                href: `/venue/analytics/events${base}&metric=ticketRevenue`,
                icon: Ticket,
                color: "#818CF8",
            },
            {
                label: "Entry Operations",
                description: "Door throughput, scan velocity, staffing",
                href: `/venue/analytics/live${base}`,
                icon: DoorOpen,
                color: "#34D399",
            },
            {
                label: "Tonight Pulse",
                description: "Real-time revenue and entry for active nights",
                href: `/venue/analytics/live`,
                icon: Zap,
                color: "#F59E0B",
            },
            {
                label: "Host Contributions",
                description: "Per-host revenue attribution and commissions",
                href: `/venue/analytics/hosts${base}`,
                icon: Users,
                color: "#FB923C",
            },
            {
                label: "Revenue Trends",
                description: "Historical revenue and growth patterns",
                href: `/venue/analytics${base}&metric=revenue`,
                icon: TrendingUp,
                color: "#38BDF8",
            },
            {
                label: "Full Analytics",
                description: "Complete operational analytics suite",
                href: `/venue/analytics`,
                icon: BarChart3,
                color: "#A78BFA",
            },
        ];
    }

    if (profileType === "host") {
        return [
            {
                label: "Event Performance",
                description: "Revenue by event and ticket tier",
                href: `/host/analytics/performance${base}`,
                icon: Ticket,
                color: "#818CF8",
            },
            {
                label: "Audience Analytics",
                description: "Guest demographics and conversion",
                href: `/host/analytics/audience${base}`,
                icon: Users,
                color: "#34D399",
            },
            {
                label: "Revenue Trends",
                description: "Earnings growth and patterns over time",
                href: `/host/analytics${base}&metric=earnings`,
                icon: TrendingUp,
                color: "#FB923C",
            },
            {
                label: "Full Analytics",
                description: "Complete host analytics suite",
                href: `/host/analytics`,
                icon: BarChart3,
                color: "#A78BFA",
            },
        ];
    }

    // promoter
    return [
        {
            label: "Attribution Analytics",
            description: "Sales and conversions attributed to your links",
            href: `/promoter/analytics/performance${base}`,
            icon: TrendingUp,
            color: "#818CF8",
        },
        {
            label: "Guest Stream",
            description: "Guests who joined via your referral links",
            href: `/promoter/guests`,
            icon: Users,
            color: "#34D399",
        },
        {
            label: "Funnel Velocity",
            description: "Link-to-purchase conversion and drop-off",
            href: `/promoter/analytics/funnel${base}`,
            icon: Zap,
            color: "#F59E0B",
        },
        {
            label: "Full Analytics",
            description: "Complete promoter analytics suite",
            href: `/promoter/analytics`,
            icon: BarChart3,
            color: "#A78BFA",
        },
    ];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalyticsBridgeSection({
    profileType,
    partnerId,
    timeRange = "30d",
}: AnalyticsBridgeSectionProps) {
    const links = getBridgeLinks(profileType, partnerId, timeRange);

    return (
        <div>
            <p className="v-label mb-4">ANALYTICS BRIDGE</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="group flex items-center gap-3 p-4 rounded-xl transition-all duration-150 hover:brightness-110"
                            style={{
                                background: "var(--v-card)",
                                border: "1px solid var(--v-border)",
                            }}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${link.color}18` }}
                            >
                                <Icon className="w-4 h-4" style={{ color: link.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--v-text-primary)" }}>
                                    {link.label}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: "var(--v-text-muted)" }}>
                                    {link.description}
                                </p>
                            </div>
                            <ArrowRight
                                className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-150"
                                style={{ color: "var(--v-text-muted)" }}
                            />
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default AnalyticsBridgeSection;
