"use client";

import { useState, useEffect } from "react";
import { Calendar, ArrowUpRight, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion } from "framer-motion";

export default function UpcomingScheduleModule() {
    const { user, profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!venueId || !user) return;
        user.getIdToken().then(token =>
            fetch(`/api/partners/venues/events?venueId=${venueId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        )
            .then(res => res.json())
            .then(data => setEvents(data.events || []))
            .catch(console.error);
    }, [venueId, user]);

    return (
        <div className="card p-8 min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline-sm text-text-primary">Upcoming Schedule</h2>
                <Link
                    href="/venue/calendar"
                    className="text-label text-accent-primary hover:underline flex items-center gap-1"
                >
                    View Calendar
                    <ArrowUpRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {events.slice(0, 4).map((event, i) => (
                    <motion.div
                        key={event.id || i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-2xl bg-surface-secondary border border-border-subtle hover:border-border-default transition-all cursor-pointer group overflow-hidden flex flex-col"
                    >
                        {/* Event Poster */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-surface-tertiary">
                            {event.poster ? (
                                <img
                                    src={event.poster}
                                    alt={event.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-text-placeholder" />
                                </div>
                            )}
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                                <p className="text-label-sm text-text-tertiary mb-2">
                                    {event.startDate ? new Date(event.startDate).toLocaleDateString('en-IN', {
                                        weekday: 'short', day: 'numeric', month: 'short'
                                    }) : 'No Date'}
                                </p>
                                <h4 className="text-title-sm text-text-primary line-clamp-1 mb-3 group-hover:text-accent-primary transition-colors uppercase">
                                    {event.title}
                                </h4>
                            </div>
                            <div className="flex items-center gap-2 mt-auto">
                                <span className={`status-dot ${(event.lifecycle === 'scheduled' || event.lifecycle === 'live') ? 'status-dot-success' : 'status-dot-neutral'}`} />
                                <span className="text-caption capitalize font-medium">{event.lifecycle}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {events.length === 0 && (
                <div className="py-12 text-center">
                    <Calendar className="mx-auto mb-3 text-text-placeholder" size={32} />
                    <p className="text-body-sm text-text-tertiary">No upcoming events scheduled</p>
                </div>
            )}
        </div>
    );
}
