"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users,
    Ticket,
    CalendarDays,
    Activity,
    ChevronRight,
    ArrowUpRight,
    Plus,
    Clock,
    Building2
} from "lucide-react";
import { doc, onSnapshot, collection, query, where, getDocs, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export default function ClubDashboardHome() {
    const { profile } = useDashboardAuth();
    const [liveData, setLiveData] = useState({
        occupancy: 0,
        capacity: 600,
        ticketsScanned: 0,
        activeTables: 0,
    });
    const [tonightEvent, setTonightEvent] = useState<any>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const db = getFirebaseDb();
        const venueId = profile.activeMembership.partnerId;

        const unsubscribeVenue = onSnapshot(doc(db, "venues", venueId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setLiveData(prev => ({
                    ...prev,
                    occupancy: data.live_occupancy || 0,
                    capacity: data.capacity || 600,
                    activeTables: data.active_tables || 0,
                }));
            }
        });

        const fetchEvent = async () => {
            const eventsRef = collection(db, "events");
            const q = query(
                eventsRef,
                where("venue_id", "==", venueId),
                where("status", "in", ["live", "confirmed"]),
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setTonightEvent(querySnapshot.docs[0].data());
            }
        };

        fetchEvent();
        return () => unsubscribeVenue();
    }, [profile]);

    const venueName = profile?.activeMembership?.partnerName || 'Your Venue';
    const firstName = profile?.displayName?.split(' ')[0] || 'Manager';

    return (
        <div className="space-y-10 stagger-children">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-caption mb-1">{venueName}</p>
                    <h1 className="text-headline">Good {getTimeOfDay()}, {firstName}</h1>
                </div>
                <Link href="/club/create" className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    Create Event
                </Link>
            </div>

            {/* Live Status Card */}
            {liveData.occupancy > 0 && (
                <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
                            <span className="text-caption-upper">Live Now</span>
                        </div>
                        <span className="text-body-sm">{tonightEvent?.name || 'Open Night'}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="stat-value">{liveData.occupancy}</span>
                        <span className="text-[20px] text-[#86868b]">/ {liveData.capacity}</span>
                    </div>
                    <p className="stat-label">Current occupancy</p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Occupancy"
                    value={liveData.occupancy.toString()}
                    icon={Users}
                />
                <StatCard
                    label="Scanned"
                    value={liveData.ticketsScanned.toString()}
                    icon={Ticket}
                />
                <StatCard
                    label="Tables"
                    value={liveData.activeTables.toString()}
                    icon={Activity}
                />
                <StatCard
                    label="Capacity"
                    value={liveData.capacity.toString()}
                    icon={Building2}
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tonight's Event */}
                <div className="lg:col-span-2">
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-title">Tonight</h2>
                            <Link href="/club/events" className="btn btn-ghost text-[13px]">
                                All Events
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {tonightEvent ? (
                            <div className="flex gap-6">
                                <div className="w-32 h-32 rounded-2xl bg-[#f5f5f7] overflow-hidden flex-shrink-0">
                                    {tonightEvent.poster_url ? (
                                        <img src={tonightEvent.poster_url} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <CalendarDays className="w-8 h-8 text-[#86868b]" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-title mb-2">{tonightEvent.name}</h3>
                                    <p className="text-body-sm mb-4">
                                        Managed by <span className="text-accent">{tonightEvent.host_name || 'Internal'}</span>
                                    </p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <MetricBox label="Expected" value="520" />
                                        <MetricBox label="Guestlist" value="82" />
                                        <MetricBox label="Promoters" value="14" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state py-12">
                                <div className="empty-state-icon">
                                    <CalendarDays />
                                </div>
                                <h3 className="text-headline-sm mb-2">No event tonight</h3>
                                <p className="text-body-sm mb-6">Schedule an event or open for walk-ins.</p>
                                <Link href="/club/create" className="btn btn-primary">
                                    Create Event
                                </Link>
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
                                label="Event Requests"
                                href="/club/events/requests"
                            />
                            <QuickAction
                                label="Manage Guestlist"
                                href="/club/registers"
                            />
                            <QuickAction
                                label="Staff Assignments"
                                href="/club/security"
                            />
                            <QuickAction
                                label="View Calendar"
                                href="/club/calendar"
                            />
                        </div>
                    </div>

                    {/* Pending Items */}
                    <div className="card p-6">
                        <h3 className="text-headline-sm mb-4">Pending</h3>
                        <div className="space-y-3">
                            <PendingItem
                                label="Host Requests"
                                count={3}
                                href="/club/connections/requests"
                            />
                            <PendingItem
                                label="Event Approvals"
                                count={1}
                                href="/club/events"
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

function StatCard({ label, value, icon: Icon }: any) {
    return (
        <div className="card p-5">
            <div className="icon-container icon-container-sm mb-4">
                <Icon className="w-4 h-4" />
            </div>
            <p className="stat-value">{value}</p>
            <p className="stat-label">{label}</p>
        </div>
    );
}

function MetricBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="card-flat p-3 rounded-xl">
            <p className="text-caption mb-1">{label}</p>
            <p className="text-headline-sm">{value}</p>
        </div>
    );
}

function QuickAction({ label, href }: { label: string; href: string }) {
    return (
        <Link
            href={href}
            className="list-item-interactive flex items-center justify-between py-3"
        >
            <span className="text-body-sm font-medium text-[#1d1d1f]">{label}</span>
            <ArrowUpRight className="w-4 h-4 text-[#86868b]" />
        </Link>
    );
}

function PendingItem({ label, count, href }: { label: string; count: number; href: string }) {
    return (
        <Link
            href={href}
            className="list-item-interactive flex items-center justify-between py-3"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ff9500]/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#ff9500]" />
                </div>
                <span className="text-body-sm">{label}</span>
            </div>
            <span className="badge badge-orange">{count}</span>
        </Link>
    );
}
