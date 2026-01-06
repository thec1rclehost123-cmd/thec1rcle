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
    Building2,
    Loader2,
    ArrowRight,
    CheckCircle
} from "lucide-react";
import { doc, onSnapshot, collection, query, where, getDocs, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";

export default function ClubDashboardHome() {
    const { profile } = useDashboardAuth();
    const [liveData, setLiveData] = useState({
        occupancy: 0,
        capacity: 600,
        ticketsScanned: 0,
        activeTables: 0,
    });
    const [tonightEvent, setTonightEvent] = useState<any>(null);
    const [pendingCounts, setPendingCounts] = useState({
        hostRequests: 0,
        eventApprovals: 0
    });
    const [tonightStats, setTonightStats] = useState({
        expected: 0,
        guestlist: 0,
        promoters: 0,
        checkedIn: 0
    });
    const [isStatsLoading, setIsStatsLoading] = useState(false);

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

        const fetchTonightStats = async (eventId: string) => {
            setIsStatsLoading(true);
            try {
                const res = await fetch(`/api/club/overview/tonight?eventId=${eventId}`);
                if (res.ok) {
                    const stats = await res.json();
                    setTonightStats({
                        expected: stats.expected,
                        guestlist: stats.guestlistCount,
                        promoters: stats.promotersCount,
                        checkedIn: stats.checkedIn
                    });
                    setLiveData(prev => ({
                        ...prev,
                        ticketsScanned: stats.checkedIn
                    }));
                }
            } catch (err) {
                console.error("Stats fetch error:", err);
            } finally {
                setIsStatsLoading(false);
            }
        };

        const fetchEvent = async () => {
            const eventsRef = collection(db, "events");
            const q = query(
                eventsRef,
                where("venueId", "==", venueId),
                where("status", "in", ["live", "confirmed", "scheduled"]),
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const eventDoc = querySnapshot.docs[0];
                const eventData = mapEventForClient(eventDoc.data(), eventDoc.id);
                setTonightEvent(eventData);
                fetchTonightStats(eventDoc.id);
            }
        };

        fetchEvent();

        // Pending Host Requests Listener
        const partnershipsQuery = query(
            collection(db, "partnerships"),
            where("clubId", "==", venueId),
            where("status", "==", "pending")
        );
        const unsubscribePartnerships = onSnapshot(partnershipsQuery, (snapshot) => {
            setPendingCounts(prev => ({ ...prev, hostRequests: snapshot.size }));
        });

        // Pending Event Approvals (Submitted by Hosts)
        const eventsApprovalsQuery = query(
            collection(db, "events"),
            where("venueId", "==", venueId),
            where("lifecycle", "==", "submitted")
        );
        const unsubscribeEventApprovals = onSnapshot(eventsApprovalsQuery, (snapshot) => {
            setPendingCounts(prev => ({ ...prev, eventApprovals: snapshot.size }));
        });

        return () => {
            unsubscribeVenue();
            unsubscribePartnerships();
            unsubscribeEventApprovals();
        };
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
            {(liveData.occupancy > 0 || tonightEvent?.status === 'live') && (
                <div className="card-elevated p-6 border-l-4 border-[#34c759]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#34c759] animate-pulse" />
                            <span className="text-caption-upper font-bold text-[#34c759]">Live Operations</span>
                        </div>
                        <span className="text-body-sm font-semibold">{tonightEvent?.name || 'Open Night'}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="stat-value">{liveData.occupancy}</span>
                        <span className="text-[20px] font-medium text-[#86868b]">/ {liveData.capacity}</span>
                    </div>
                    <p className="stat-label">Current floor occupancy</p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Scanning"
                    value={liveData.ticketsScanned.toString()}
                    icon={Ticket}
                    subValue="checked in"
                    loading={isStatsLoading}
                />
                <StatCard
                    label="Expected"
                    value={tonightStats.expected.toString()}
                    icon={Users}
                    subValue="total turnout"
                    loading={isStatsLoading}
                />
                <StatCard
                    label="Guestlist"
                    value={tonightStats.guestlist.toString()}
                    icon={Activity}
                    subValue="claimed slots"
                    loading={isStatsLoading}
                />
                <StatCard
                    label="Promoters"
                    value={tonightStats.promoters.toString()}
                    icon={Building2}
                    subValue="active links"
                    loading={isStatsLoading}
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tonight's Event */}
                <div className="lg:col-span-2">
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-title font-bold">Tonight</h2>
                            <Link href="/club/events" className="btn btn-ghost text-[13px] font-bold">
                                All Events
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Link>
                        </div>

                        {tonightEvent ? (
                            <DashboardEventCard
                                event={tonightEvent}
                                role="club"
                                primaryAction={{
                                    label: "Manage Event",
                                    href: `/club/events/${tonightEvent.id}`,
                                    icon: <ArrowRight size={16} />
                                }}
                                status={tonightEvent.lifecycle || tonightEvent.status}
                                showStats={true}
                            />
                        ) : (
                            <div className="empty-state py-16">
                                <div className="empty-state-icon">
                                    <CalendarDays />
                                </div>
                                <h3 className="text-headline-sm mb-2">No event scheduled</h3>
                                <p className="text-body-sm mb-6 max-w-xs mx-auto">Take a night off or schedule a last-minute production.</p>
                                <Link href="/club/create" className="btn btn-primary px-8">
                                    Create Event
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* Pending Items */}
                    <div className="card p-6 bg-slate-900 text-white shadow-2xl shadow-slate-200">
                        <h3 className="text-headline-sm mb-6 text-white/60 uppercase tracking-widest text-[10px] font-black">Attention Needed</h3>
                        <div className="space-y-3">
                            <PendingItem
                                label="Promoter Requests"
                                count={pendingCounts.hostRequests}
                                href="/club/connections/requests"
                                theme="dark"
                            />
                            <PendingItem
                                label="Production Approvals"
                                count={pendingCounts.eventApprovals}
                                href="/club/events?status=submitted"
                                theme="dark"
                            />
                        </div>
                    </div>

                    {/* Quick Launch */}
                    <div className="card p-6">
                        <h3 className="text-headline-sm mb-4 font-bold">Quick Launch</h3>
                        <div className="space-y-1">
                            <QuickAction
                                label="Operational Logs"
                                href="/club/registers"
                                icon={Clock}
                            />
                            <QuickAction
                                label="Security Sync"
                                href="/club/security"
                                icon={Activity}
                            />
                            <QuickAction
                                label="Venue Calendar"
                                href="/club/calendar"
                                icon={CalendarDays}
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

function StatCard({ label, value, icon: Icon, subValue, loading }: any) {
    return (
        <div className="card p-5">
            <div className="icon-container icon-container-sm mb-4">
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-200" />
                ) : (
                    <p className="stat-value">{value}</p>
                )}
                {subValue && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{subValue}</span>}
            </div>
            <p className="stat-label">{label}</p>
        </div>
    );
}

function MetricBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="card-flat p-3 rounded-xl border border-slate-100">
            <p className="text-caption mb-1">{label}</p>
            <p className="text-headline-sm">{value}</p>
        </div>
    );
}

function QuickAction({ label, href, icon: Icon }: { label: string; href: string; icon?: any }) {
    return (
        <Link
            href={href}
            className="list-item-interactive flex items-center justify-between py-3 group"
        >
            <div className="flex items-center gap-3">
                {Icon && <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />}
                <span className="text-body-sm font-medium text-[#1d1d1f]">{label}</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#86868b] opacity-0 group-hover:opacity-100 transition-all" />
        </Link>
    );
}

function PendingItem({ label, count, href, theme = 'light' }: { label: string; count: number; href: string; theme?: 'light' | 'dark' }) {
    return (
        <Link
            href={href}
            className={`list-item-interactive flex items-center justify-between py-3 rounded-xl px-2 transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-50'
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-[#ff9500]/10'
                    }`}>
                    <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-white' : 'text-[#ff9500]'}`} />
                </div>
                <span className={`text-body-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{label}</span>
            </div>
            <span className={`badge ${theme === 'dark' ? 'bg-white text-slate-900' : 'badge-orange'}`}>{count}</span>
        </Link>
    );
}
