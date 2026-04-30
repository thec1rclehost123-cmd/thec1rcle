"use client";

import { useState } from "react";
import { Info, RefreshCw, Calendar, ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useQuery } from "@tanstack/react-query";
import { normalizeAnalyticsV2 } from "@/lib/analytics/zeroState";
import { mapEventForClient } from "@c1rcle/core/events";
import { parseAsIST } from "@c1rcle/core/time";
function format(date: Date | string, _fmt: string): string {
    return new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

import {
    SummarySection,
    FunnelSection,
    RevenueSection,
    CrowdSection,
    DoorSection,
    CompareSection,
} from "./sections";

type DateRange = { from: Date; to: Date } | undefined;
function subDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
}


export default function EventAnalyticsClient({
    role,
    idParam,
    eventId,
    embedded = false,
}: {
    role: "venue" | "host";
    idParam: string;
    eventId: string;
    embedded?: boolean;
}) {
    const { profile, user } = useDashboardAuth();
    const entityId = profile?.activeMembership?.partnerId;
    const useEmbeddedEventAnalytics = embedded && role === "venue" && Boolean(eventId);

    const [rangeDays, setRangeDays] = useState<number>(30);
    const range: DateRange = {
        from: subDays(new Date(), rangeDays),
        to: new Date(),
    };

    // 1. Fetch event details for the header
    const { data: eventDetails, isLoading: isEventLoading, refetch: refetchEventDetails, isFetching: isFetchingEventDetails } = useQuery({
        queryKey: [role, "events", entityId, "all"],
        queryFn: async () => {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/${role}/events?${idParam}=${entityId}&status=all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return null;
            const { events } = await res.json();
            const rawEvent = events.find((e: any) => e.id === eventId);
            if (!rawEvent) return null;
            const mapped = mapEventForClient(rawEvent, rawEvent.id) as any;
            return {
                title: mapped.title || mapped.name || "Untitled Event",
                date: parseAsIST(mapped.startDate || mapped.date),
                status: mapped.lifecycle || mapped.status,
            };
        },
        enabled: !!entityId && !!user,
    });

    // 2. Fetch analytics strictly scoped to this event
    const { data: analyticsData, isLoading: isAnalyticsLoading, isError, refetch: refetchAnalytics, isFetching: isFetchingAnalytics } = useQuery({
        queryKey: [role, "analytics", "event", entityId, eventId, rangeDays],
        queryFn: async () => {
            const token = await user?.getIdToken();
            const headers: Record<string, string> = {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(entityId ? { "x-partner-id": entityId, "x-venue-id": entityId } : {}),
            };

            if (useEmbeddedEventAnalytics && eventId) {
                const res = await fetch(`/api/partners/venues/events/${eventId}/computed-analytics`, { headers });
                if (!res.ok) throw new Error("Failed to load event analytics");
                return res.json();
            }

            const url = `/api/${role}/analytics/overview?${idParam}=${entityId}&eventId=${eventId}`;
            const r = await fetch(url, { headers });
            if (!r.ok) throw new Error("Failed to load analytics");
            return r.json();
        },
        enabled: !!entityId && !!user,
    });

    const normalizedPayload =
        analyticsData && typeof analyticsData === "object" && "analytics" in analyticsData
            ? (analyticsData as { analytics?: Record<string, unknown> }).analytics ?? null
            : analyticsData;
    const data = normalizeAnalyticsV2(normalizedPayload as Record<string, unknown> | null | undefined);
    const isLoading = isEventLoading || isAnalyticsLoading;
    const isRefreshing = isFetchingEventDetails || isFetchingAnalytics;

    const handleRefresh = () => {
        void Promise.all([refetchEventDetails(), refetchAnalytics()]);
    };

    const rangePicker = (
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
                { id: 7, label: "7 Days" },
                { id: 30, label: "30 Days" },
                { id: 1000, label: "All Time" },
            ].map(r => {
                const active = rangeDays === r.id;
                return (
                    <button
                        key={r.id}
                        onClick={() => setRangeDays(r.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                            background: active ? "var(--v-orange)" : "transparent",
                            color: active ? "#FFF" : "var(--v-text-secondary)",
                            boxShadow: active ? "0 2px 12px rgba(244,74,34,0.4)" : "none",
                        }}
                    >
                        {r.label}
                    </button>
                );
            })}
        </div>
    );

    const header = (
        <div
            className={embedded ? "rounded-[28px] border border-border-default bg-[var(--v-card)] p-6" : "px-6 py-6 sticky top-0 z-30"}
            style={embedded ? undefined : {
                background: "rgba(10,10,11,0.92)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)",
            }}
        >
            <div className="max-w-7xl mx-auto">
                {!embedded && (
                    <Link
                        href={`/${role}/events`}
                        className="inline-flex items-center gap-1.5 mb-4 text-[12px] font-semibold hover:underline transition-colors"
                        style={{ color: "var(--v-text-tertiary)" }}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Events
                    </Link>
                )}

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: "linear-gradient(135deg, rgba(244,74,34,0.1) 0%, rgba(244,74,34,0.02) 100%)",
                                border: "1px solid rgba(244,74,34,0.2)",
                            }}
                        >
                            <BarChart3 className="w-5 h-5" style={{ color: "var(--v-orange)" }} />
                        </div>
                        <div>
                            <h1 className="text-[24px] font-black tracking-tight" style={{ color: "var(--v-text-primary)" }}>
                                {eventDetails?.title || (isEventLoading ? "Loading Event..." : "Event Analytics")}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                {eventDetails?.date && (
                                    <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--v-text-secondary)" }}>
                                        <Calendar className="w-3.5 h-3.5" />
                                        {format(eventDetails.date, "MMM d, yyyy")}
                                    </div>
                                )}
                                {eventDetails?.status && (
                                    <div className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold"
                                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--v-text-secondary)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                        {eventDetails.status}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {!useEmbeddedEventAnalytics ? rangePicker : null}
                </div>
            </div>
        </div>
    );

    const embeddedToolbar = embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-[24px] border border-border-default bg-[var(--v-card)] px-5 py-4">
            <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--v-text-secondary)" }}>
                    Event Analytics
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--v-text-muted)" }}>
                    Click refresh to pull the latest event metrics.
                </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold transition-all disabled:opacity-50"
                    style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "var(--v-text-primary)",
                    }}
                >
                    <RefreshCw className={`w-3.5 h-3.5${isRefreshing ? " animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>
        </div>
    ) : null;

    return (
        <div style={{ minHeight: embedded ? undefined : "100vh", background: embedded ? "transparent" : "var(--v-canvas, #111113)" }}>
            {!embedded && header}

            <main className={embedded ? "pt-0" : "px-6 py-8"}>
                <div className={embedded ? "space-y-4" : "max-w-7xl mx-auto space-y-4"}>
                    {embeddedToolbar}
                    {!embedded && !isLoading && !data.hasData && (
                        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border" style={{ background: "var(--v-elevated)", borderColor: "var(--v-border)" }}>
                            <Info className="w-4 h-4 shrink-0" style={{ color: "var(--v-text-muted)" }} />
                            <p className="text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                                No analytics recorded yet for this event — metrics will populate after tickets are sold or guests arrive.
                            </p>
                        </div>
                    )}

                    {!embedded && isError && (
                        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border" style={{ background: "var(--v-error-bg)", borderColor: "var(--v-error)" }}>
                            <RefreshCw className="w-4 h-4" style={{ color: "var(--v-error)" }} />
                            <p className="text-[13px]" style={{ color: "var(--v-error)" }}>
                                Could not load event analytics data. Showing last-known values.
                            </p>
                        </div>
                    )}

                    <SummarySection data={data} loading={isLoading} hideTitle={embedded} />
                    <FunnelSection data={data} loading={isLoading} />
                    <RevenueSection data={data} loading={isLoading} />
                    <CrowdSection data={data} loading={isLoading} />
                    <DoorSection data={data} loading={isLoading} />
                    <CompareSection data={data} loading={isLoading} />
                </div>
            </main>
        </div>
    );
}
