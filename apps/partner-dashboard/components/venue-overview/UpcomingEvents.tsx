"use client";

import { memo } from "react";
import Link from "next/link";
import { Calendar, Plus, ArrowRight } from "lucide-react";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import type { UpcomingEvent } from "@/lib/types/venueOverview";

// ── Lifecycle config ──────────────────────────────────────────────────────────

const LIFECYCLE_CONFIG: Record<
    string,
    { label: string; color: string; bg: string }
> = {
    published: {
        label: "Live",
        color: "var(--v-success)",
        bg: "var(--v-success-bg)",
    },
    live: {
        label: "Live",
        color: "var(--v-success)",
        bg: "var(--v-success-bg)",
    },
    pending: {
        label: "Pending",
        color: "var(--v-warning)",
        bg: "var(--v-warning-bg)",
    },
    draft: {
        label: "Draft",
        color: "var(--v-text-tertiary)",
        bg: "rgba(255,255,255,0.06)",
    },
    completed: {
        label: "Done",
        color: "var(--v-text-secondary)",
        bg: "rgba(255,255,255,0.06)",
    },
    cancelled: {
        label: "Cancelled",
        color: "var(--v-error)",
        bg: "var(--v-error-bg)",
    },
    scheduled: {
        label: "Scheduled",
        color: "var(--v-info)",
        bg: "var(--v-info-bg)",
    },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string | undefined): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Tonight";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: UpcomingEvent }) {
    const lifecycle = event.lifecycle || event.status || "draft";
    const cfg = LIFECYCLE_CONFIG[lifecycle] ?? LIFECYCLE_CONFIG.draft;
    const dateStr = event.startDate || event.date || "";

    return (
        <Link
            href={`/venue/events/${event.id}`}
            className="group p-4 rounded-2xl flex flex-col gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: "var(--v-elevated)" }}
        >
            <p
                className="text-[11px] font-medium"
                style={{ color: "var(--v-text-tertiary)" }}
            >
                {formatEventDate(dateStr)}
            </p>
            <p
                className="text-[13px] font-semibold line-clamp-2 leading-tight"
                style={{ color: "var(--v-text-primary)" }}
            >
                {event.title}
            </p>
            <span
                className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ color: cfg.color, background: cfg.bg }}
            >
                {cfg.label}
            </span>
        </Link>
    );
}

// ── UpcomingEvents ────────────────────────────────────────────────────────────

interface UpcomingEventsProps {
    events: UpcomingEvent[];
    loading: boolean;
}

/**
 * UpcomingEvents
 *
 * Shows the next 6 scheduled events as cards.
 * Renders skeleton placeholders while loading.
 * Empty state prompts to create the first event.
 */
export const UpcomingEvents = memo(function UpcomingEvents({
    events,
    loading,
}: UpcomingEventsProps) {
    return (
        <div
            className="rounded-[32px] p-5 sm:p-6"
            style={{ background: "var(--v-card)" }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2
                    className="v-text-section"
                    style={{ color: "var(--v-text-primary)" }}
                >
                    Upcoming Schedule
                </h2>
                <Link
                    href="/venue/calendar"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                    style={{ color: "var(--v-orange)" }}
                >
                    View Calendar <ArrowRight className="w-3 h-3" />
                </Link>
            </div>

            {/* Loading skeletons */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="v-skeleton rounded-2xl h-[88px]"
                        />
                    ))}
                </div>
            ) : events.length === 0 ? (
                /* Empty state */
                <div className="py-14 flex flex-col items-center text-center gap-3">
                    <Calendar
                        className="w-8 h-8"
                        style={{ color: "var(--v-text-muted)" }}
                    />
                    <p
                        className="text-[13px]"
                        style={{ color: "var(--v-text-tertiary)" }}
                    >
                        No upcoming events scheduled
                    </p>
                    <Link href="/venue/create">
                        <VenueActionButton variant="secondary">
                            <Plus className="w-3.5 h-3.5" />
                            Create your first event
                        </VenueActionButton>
                    </Link>
                </div>
            ) : (
                /* Event grid */
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {events.slice(0, 6).map((event, i) => (
                        <EventCard key={event.id || i} event={event} />
                    ))}
                </div>
            )}
        </div>
    );
});
