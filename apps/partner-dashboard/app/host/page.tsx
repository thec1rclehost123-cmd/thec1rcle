"use client";

import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import {
    Plus,
    CalendarDays,
    TrendingUp,
    Ticket,
    Users,
    Clock,
    ChevronRight,
    ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export default function HostDashboardHome() {
    const { profile } = useDashboardAuth();
    const [stats, setStats] = useState({
        revenue: 0,
        ticketsSold: 0,
        activePromoters: 0,
        pendingItems: 0
    });
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const db = getFirebaseDb();
        const hostId = profile.activeMembership.partnerId;

        const eventsQuery = query(
            collection(db, "events"),
            where("host_id", "==", hostId),
            orderBy("date", "asc"),
            limit(5)
        );

        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUpcomingEvents(events);
            setStats(prev => ({
                ...prev,
                ticketsSold: events.reduce((acc, current: any) => acc + (current.tickets_sold || 0), 0),
                pendingItems: events.filter((e: any) => e.status === 'pending_approval').length
            }));
        });

        return () => unsubscribeEvents();
    }, [profile]);

    const firstName = profile?.displayName?.split(' ')[0] || 'there';

    return (
        <div className="space-y-10 stagger-children">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-caption mb-1">Good {getTimeOfDay()}</p>
                    <h1 className="text-headline">Welcome back, {firstName}</h1>
                </div>
                <Link href="/host/create" className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    New Event
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Revenue"
                    value={`₹${stats.revenue.toLocaleString()}`}
                    icon={TrendingUp}
                />
                <StatCard
                    label="Tickets Sold"
                    value={stats.ticketsSold.toString()}
                    icon={Ticket}
                />
                <StatCard
                    label="Promoters"
                    value={stats.activePromoters.toString()}
                    icon={Users}
                />
                <StatCard
                    label="Pending"
                    value={stats.pendingItems.toString()}
                    icon={Clock}
                    accent={stats.pendingItems > 0}
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Events List */}
                <div className="lg:col-span-2">
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-title">Upcoming Events</h2>
                            <Link href="/host/events" className="btn btn-ghost text-[13px]">
                                View All
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {upcomingEvents.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <CalendarDays />
                                </div>
                                <h3 className="text-headline-sm mb-2">No events yet</h3>
                                <p className="text-body-sm mb-6 max-w-xs">
                                    Create your first event to start selling tickets and building your audience.
                                </p>
                                <Link href="/host/create" className="btn btn-primary">
                                    Create Event
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {upcomingEvents.map((event) => (
                                    <EventRow key={event.id} event={event} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="card p-6">
                        <h3 className="text-headline-sm mb-4">Quick Actions</h3>
                        <div className="space-y-2">
                            <QuickAction
                                label="Browse Venues"
                                href="/host/partnerships"
                                description="Find a venue for your next event"
                            />
                            <QuickAction
                                label="Invite Promoters"
                                href="/host/promoters"
                                description="Expand your sales network"
                            />
                            <QuickAction
                                label="View Analytics"
                                href="/host/analytics"
                                description="Track your performance"
                            />
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="card p-6">
                        <h3 className="text-headline-sm mb-4">Recent Activity</h3>
                        <div className="space-y-4">
                            <ActivityItem
                                title="Session started"
                                time="Just now"
                            />
                            <ActivityItem
                                title="Profile updated"
                                time="2 hours ago"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

function StatCard({ label, value, icon: Icon, accent = false }: any) {
    return (
        <div className="card p-5">
            <div className={`icon-container icon-container-sm mb-4 ${accent ? 'icon-container-accent' : ''}`}>
                <Icon className="w-4 h-4" />
            </div>
            <p className="stat-value">{value}</p>
            <p className="stat-label">{label}</p>
        </div>
    );
}

function EventRow({ event }: { event: any }) {
    const statusStyles: Record<string, string> = {
        live: 'badge-green',
        pending_approval: 'badge-orange',
        draft: '',
        scheduled: 'badge-blue'
    };

    return (
        <Link
            href={`/host/events/${event.id}`}
            className="list-item-interactive flex items-center justify-between"
        >
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] overflow-hidden flex-shrink-0">
                    {event.poster_url ? (
                        <img src={event.poster_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <CalendarDays className="w-5 h-5 text-[#86868b]" />
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="text-headline-sm">{event.name}</h4>
                    <p className="text-caption">{event.date} • {event.venue_name || 'Venue TBD'}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`badge ${statusStyles[event.status] || ''}`}>
                    {event.status?.replace('_', ' ')}
                </span>
                <ChevronRight className="w-4 h-4 text-[#86868b]" />
            </div>
        </Link>
    );
}

function QuickAction({ label, href, description }: { label: string; href: string; description: string }) {
    return (
        <Link
            href={href}
            className="list-item-interactive flex items-center justify-between py-3"
        >
            <div>
                <p className="text-body-sm font-medium text-[#1d1d1f]">{label}</p>
                <p className="text-caption">{description}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#86868b]" />
        </Link>
    );
}

function ActivityItem({ title, time }: { title: string; time: string }) {
    return (
        <div className="flex items-center justify-between py-2">
            <p className="text-body-sm">{title}</p>
            <p className="text-caption">{time}</p>
        </div>
    );
}
