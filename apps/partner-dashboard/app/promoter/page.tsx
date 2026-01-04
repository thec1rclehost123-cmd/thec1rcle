"use client";

import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import {
    Wallet,
    Ticket,
    TrendingUp,
    Link2,
    Copy,
    Share2,
    Users,
    ChevronRight,
    ArrowUpRight,
    CalendarDays
} from "lucide-react";
import Link from "next/link";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export default function PromoterDashboardHome() {
    const { profile } = useDashboardAuth();
    const [earnings, setEarnings] = useState({
        today: 0,
        week: 0,
        month: 0,
        pending: 0
    });
    const [recentCommissions, setRecentCommissions] = useState<any[]>([]);
    const [activeEvents, setActiveEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const partnerId = profile.activeMembership.partnerId;
        const db = getFirebaseDb();

        const eventsQuery = query(
            collection(db, "events"),
            where("status", "in", ["live", "active"]),
            limit(4)
        );

        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActiveEvents(events);
        });

        // Fetch Stats
        fetch(`/api/promoter/stats?promoterId=${partnerId}`)
            .then(res => res.json())
            .then(data => {
                if (data.stats) {
                    setEarnings(prev => ({
                        ...prev,
                        pending: data.stats.pendingCommission || 0,
                        month: data.stats.totalCommission || 0,
                        week: data.stats.totalCommission || 0 // Mocking weekly/today for now from total if missing
                    }));
                }
            });

        // Fetch Recent Commissions
        fetch(`/api/promoter/commissions?promoterId=${partnerId}&limit=5`)
            .then(res => res.json())
            .then(data => {
                if (data.commissions) {
                    setRecentCommissions(data.commissions);
                }
            });

        return () => unsubscribeEvents();
    }, [profile]);

    const firstName = profile?.displayName?.split(' ')[0] || 'there';

    return (
        <div className="space-y-10 stagger-children">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-caption mb-1">Promoter Dashboard</p>
                    <h1 className="text-headline">Hi, {firstName}</h1>
                </div>
                <div className="card p-4 flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-caption">Available</p>
                        <p className="text-title">₹{earnings.pending.toLocaleString()}</p>
                    </div>
                    <Link href="/promoter/payouts" className="btn btn-primary btn-sm">
                        <Wallet className="w-4 h-4" />
                        Withdraw
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                <StatCard
                    label="Today"
                    value={`₹${earnings.today}`}
                    icon={TrendingUp}
                />
                <StatCard
                    label="This Week"
                    value={`₹${earnings.week}`}
                    icon={CalendarDays}
                />
                <StatCard
                    label="This Month"
                    value={`₹${earnings.month}`}
                    icon={Wallet}
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Events */}
                <div className="lg:col-span-2">
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-title">Active Events</h2>
                            <Link href="/promoter/links" className="btn btn-ghost text-[13px]">
                                All Links
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {activeEvents.length === 0 ? (
                            <div className="empty-state py-12">
                                <div className="empty-state-icon">
                                    <Ticket />
                                </div>
                                <h3 className="text-headline-sm mb-2">No active events</h3>
                                <p className="text-body-sm mb-6 max-w-xs">
                                    You haven't been assigned to any live events yet. Contact a host to start selling.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeEvents.map((event) => (
                                    <EventCard key={event.id} event={event} />
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
                                label="My Links"
                                href="/promoter/links"
                            />
                            <QuickAction
                                label="View Buyers"
                                href="/promoter/guests"
                            />
                            <QuickAction
                                label="Stats"
                                href="/promoter/stats"
                            />
                        </div>
                    </div>

                    <div className="card p-6">
                        <h3 className="text-headline-sm mb-4">Recent Earnings</h3>
                        <div className="space-y-3">
                            {recentCommissions.length === 0 ? (
                                <p className="text-caption py-4 text-center">No recent earnings yet.</p>
                            ) : (
                                recentCommissions.map((comm, i) => (
                                    <div key={comm.id || i} className="list-item py-3 first:pt-0">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="h-8 w-8 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-bold">
                                                {comm.eventTitle?.charAt(0) || "E"}
                                            </div>
                                            <div>
                                                <p className="text-body-sm font-medium text-[#1d1d1f] truncate max-w-[120px]">
                                                    {comm.eventTitle || "Event Sale"}
                                                </p>
                                                <p className="text-caption">
                                                    {new Date(comm.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-body-sm font-medium text-[#34c759]">+₹{comm.commissionAmount}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <Link href="/promoter/links" className="btn btn-secondary w-full mt-4 text-[13px]">
                            View All Links
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
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

function EventCard({ event }: { event: any }) {
    return (
        <div className="card-flat p-5 rounded-2xl">
            <div className="flex items-start justify-between mb-4">
                <div className="icon-container icon-container-md">
                    <Ticket className="w-5 h-5" />
                </div>
                <div className="flex gap-2">
                    <button className="p-2 rounded-lg bg-white hover:bg-black/[0.02] transition-colors">
                        <Copy className="h-4 w-4 text-[#86868b]" />
                    </button>
                    <button className="p-2 rounded-lg bg-[#007aff] text-white">
                        <Share2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <h4 className="text-headline-sm mb-1">{event.name}</h4>
            <p className="text-caption mb-4">{event.date}</p>
            <div className="divider mb-4" />
            <div className="flex items-center justify-between">
                <span className="badge badge-green">{event.commission_rate || '15'}%</span>
                <span className="text-caption">{event.tickets_sold || 0} sold</span>
            </div>
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
