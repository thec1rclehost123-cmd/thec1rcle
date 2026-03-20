"use client";

import { useState, useEffect } from "react";
import { Calendar, ArrowUpRight, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function UpcomingScheduleModule() {
    const { user, profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!venueId || !user) return;
        user.getIdToken().then(token =>
            fetch(`/api/venue/events?venueId=${venueId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        )
            .then(res => res.json())
            .then(data => setEvents(data.events || []))
            .catch(console.error);
    }, [venueId, user]);

    return (
        <div className="rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-5">
                <h2 className="dash-title-card text-[var(--text-primary)]">Upcoming Schedule</h2>
                <Link
                    href="/venue/calendar"
                    className="dash-body-sm text-[var(--accent)] hover:opacity-80 flex items-center gap-1"
                >
                    View Calendar
                    <ArrowUpRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {events.slice(0, 4).map((event, i) => (
                    <div
                        key={event.id || i}
                        className="rounded-[var(--r-lg)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)] transition-all cursor-pointer group overflow-hidden flex flex-col"
                    >
                        {/* Event Poster */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-[var(--bg-secondary)]">
                            {event.poster ? (
                                <img
                                    src={event.poster}
                                    alt={event.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-[var(--text-quaternary)]" />
                                </div>
                            )}
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                                <p className="text-label-sm text-[var(--text-tertiary)] mb-2">
                                    {event.startDate ? new Date(event.startDate).toLocaleDateString('en-IN', {
                                        weekday: 'short', day: 'numeric', month: 'short'
                                    }) : 'No Date'}
                                </p>
                                <h4 className="text-title-sm text-[var(--text-primary)] line-clamp-1 mb-3 group-hover:text-accent-primary transition-colors uppercase">
                                    {event.title}
                                </h4>
                            </div>
                            <div className="flex items-center gap-2 mt-auto">
                                <span className={`status-dot ${(event.lifecycle === 'scheduled' || event.lifecycle === 'live') ? 'status-dot-success' : 'status-dot-neutral'}`} />
                                <span className="text-caption capitalize font-medium">{event.lifecycle}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {events.length === 0 && (
                <div className="py-12 text-center">
                    <Calendar className="mx-auto mb-3 text-[var(--text-quaternary)]" size={32} />
                    <p className="text-body-sm text-[var(--text-tertiary)]">No upcoming events scheduled</p>
                </div>
            )}
        </div>
    );
}
