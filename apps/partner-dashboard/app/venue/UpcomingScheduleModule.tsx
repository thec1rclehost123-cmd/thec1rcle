"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion } from "framer-motion";

export default function UpcomingScheduleModule() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!venueId) return;
        fetch(`/api/venue/events?venueId=${venueId}`)
            .then(res => res.json())
            .then(data => setEvents(data.events || []))
            .catch(console.error);
    }, [venueId]);

    return (
        <div className="card p-8 min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline-sm text-[var(--text-primary)]">Upcoming Schedule</h2>
                <Link
                    href="/venue/calendar"
                    className="text-label text-[var(--c1rcle-orange)] hover:underline flex items-center gap-1"
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
                        className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all cursor-pointer group"
                    >
                        <p className="text-label-sm text-[var(--text-tertiary)] mb-2">
                            {event.startDate ? new Date(event.startDate).toLocaleDateString('en-IN', {
                                weekday: 'short', day: 'numeric', month: 'short'
                            }) : 'No Date'}
                        </p>
                        <h4 className="text-title-sm text-[var(--text-primary)] line-clamp-1 mb-3 group-hover:text-[var(--c1rcle-orange)] transition-colors">
                            {event.title}
                        </h4>
                        <div className="flex items-center gap-2">
                            <span className={`status-dot ${event.lifecycle === 'published' ? 'status-dot-success' : 'status-dot-neutral'}`} />
                            <span className="text-caption capitalize">{event.lifecycle}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {events.length === 0 && (
                <div className="py-12 text-center">
                    <Calendar className="mx-auto mb-3 text-[var(--text-placeholder)]" size={32} />
                    <p className="text-body-sm text-[var(--text-tertiary)]">No upcoming events scheduled</p>
                </div>
            )}
        </div>
    );
}
