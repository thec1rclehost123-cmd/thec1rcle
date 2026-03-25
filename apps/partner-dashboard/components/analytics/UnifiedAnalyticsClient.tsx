
"use client";

import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import StudioShell from "@/components/studio/StudioShell";
import { useQuery } from "@tanstack/react-query";
import { normalizeAnalyticsData } from "@/lib/analytics/zeroState";

import {
    KPISection,
    PerformanceRingsSection,
    RevenueSection,
    TicketsGuestlistSection,
    AudienceSection,
    FunnelSection,
    ScannerSection,
    EventComparisonSection,
    SourceHeatmapSection,
    FinanceSection,
    TableSection,
    InsightsSection
} from "./sections";

type DateRange = { from: Date; to: Date } | undefined;
function subDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
}

const CATEGORY_MAP: Record<string, { title: string; desc: string }> = {
    overview: { title: "Analytics Overview", desc: "Complete performance summary — revenue, attendance, funnel, and operations." },
    timeline: { title: "Timing Intelligence", desc: "Deep dive into booking windows, peak hours, and seasonal trends." },
    reach: { title: "Demand & Reach", desc: "Analyze purchase intent, ticket sales trends, and source performance." },
    engagement: { title: "Turnout & Engagement", desc: "Track fill rates, attendance consistency, and no-show analysis." },
    revenue: { title: "Money Intelligence", desc: "Detailed breakdown of revenue, platform fees, and finance status." },
    audience: { title: "Crowd & Audience", desc: "Demographics, loyalty patterns, and guest quality scores." },
    ops: { title: "Gate & Operations", desc: "Scanner efficiency, entry velocity, and door management metrics." },
    attribution: { title: "Partner Attribution", desc: "Performance tracking for hosts, promoters, and external sources." }
};

// ── Main client ───────────────────────────────────────────────────────────────

export default function UnifiedAnalyticsClient({
    role,
    idParam
}: {
    role: "venue" | "host" | "promoter";
    idParam: string;
}) {
    const params = useParams();
    const searchParams = useSearchParams();

    // Determine category from props, path param, or search param
    const category = (params.category || searchParams.get("tab") || "overview") as string;
    const catConfig = CATEGORY_MAP[category] || CATEGORY_MAP.overview;

    const { profile, getIdToken } = useDashboardAuth() as any;
    const entityId = profile?.activeMembership?.partnerId;

    const [range, setRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [eventId, setEventId] = useState<string>("all");

    // Derive a stable range string for the API and query key
    const rangeStr = !range ? "30d"
        : (range.to.getTime() - range.from.getTime()) <= 8 * 86_400_000 ? "7d"
        : (range.to.getTime() - range.from.getTime()) <= 31 * 86_400_000 ? "30d"
        : (range.to.getTime() - range.from.getTime()) <= 91 * 86_400_000 ? "90d"
        : "ytd";

    const { data: analyticsData, isLoading, isError } = useQuery({
        queryKey: [role, "analytics", entityId, eventId, rangeStr],
        queryFn: async () => {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
            const url = `/api/${role}/analytics/overview?${idParam}=${entityId}&eventId=${eventId}&range=${rangeStr}`;
            const r = await fetch(url, { headers });
            if (!r.ok) return null;
            return r.json();
        },
        enabled: !!entityId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });

    const data = normalizeAnalyticsData(analyticsData);

    const shouldShow = (sectionCat: string | string[]) => {
        if (category === "overview") return true;
        if (Array.isArray(sectionCat)) return sectionCat.includes(category);
        return sectionCat === category;
    };

    return (
        <StudioShell
            role={role}
            title={catConfig.title}
            description={catConfig.desc}
            onRangeChange={(r) => {
                const days = parseInt(r) || 30;
                setRange({ from: subDays(new Date(), days), to: new Date() });
            }}
            onEventChange={setEventId}
        >
            <div className="space-y-4 pb-20">
                {/* Zero-data notice */}
                {!isLoading && !data.hasData && (
                    <div
                        className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
                        style={{ background: "var(--v-elevated)", borderColor: "var(--v-border)" }}
                    >
                        <Info className="w-4 h-4 shrink-0" style={{ color: "var(--v-text-muted)" }} />
                        <p className="text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                            No analytics recorded yet — all metrics will populate after your first event goes live.
                            Values below show the exact structure that real data will fill.
                        </p>
                    </div>
                )}

                {/* Error notice */}
                {isError && (
                    <div
                        className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
                        style={{ background: "var(--v-error-bg)", borderColor: "var(--v-error)" }}
                    >
                        <RefreshCw className="w-4 h-4" style={{ color: "var(--v-error)" }} />
                        <p className="text-[13px]" style={{ color: "var(--v-error)" }}>
                            Could not load analytics data. Showing last-known values.
                        </p>
                    </div>
                )}

                {shouldShow(["overview", "timeline", "reach", "revenue", "ops", "engagement"]) && (
                    <KPISection data={data} loading={isLoading} category={category} />
                )}

                {shouldShow(["overview", "reach", "engagement", "audience", "ops"]) && (
                    <PerformanceRingsSection data={data} loading={isLoading} category={category} />
                )}

                {shouldShow(["overview", "revenue", "reach"]) && (
                    <RevenueSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "reach", "timeline"]) && (
                    <TicketsGuestlistSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "audience"]) && (
                    <AudienceSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "reach"]) && (
                    <FunnelSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "ops", "engagement"]) && (
                    <ScannerSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "timeline"]) && (
                    <EventComparisonSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "reach", "timeline", "attribution"]) && (
                    <SourceHeatmapSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "revenue"]) && (
                    <FinanceSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "attribution", "revenue"]) && (
                    <TableSection data={data} loading={isLoading} />
                )}

                {shouldShow("overview") && (
                    <InsightsSection data={data} loading={isLoading} />
                )}
            </div>
        </StudioShell>
    );
}

