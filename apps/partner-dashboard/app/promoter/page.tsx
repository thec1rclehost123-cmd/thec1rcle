"use client";

import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import {
    Wallet,
    Ticket,
    TrendingUp,
    ChevronRight,
    ArrowUpRight,
    CalendarDays
} from "lucide-react";
import Link from "next/link";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";
import { Link2, ExternalLink } from "lucide-react";

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
            where("lifecycle", "in", ["scheduled", "live"]),
            where("promoterVisibility", "==", true),
            limit(4)
        );

        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => mapEventForClient(doc.data(), doc.id));
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
                                {activeEvents.map((event, index) => (
                                    <DashboardEventCard
                                        key={event.id}
                                        event={event}
                                        index={index}
                                        role="promoter"
                                        primaryAction={{
                                            label: "Promote",
                                            href: `/promoter/links`
                                        }}
                                        secondaryActions={[
                                            {
                                                label: "Copy Tracking Link",
                                                icon: <Link2 size={16} />,
                                                onClick: () => {
                                                    const partnerId = profile?.activeMembership?.partnerId;
                                                    const url = `${window.location.origin}/e/${event.slug || event.id}?p=${partnerId}`;
                                                    navigator.clipboard.writeText(url);
                                                    alert("Tracking link copied!");
                                                }
                                            },
                                            {
                                                label: "View Event",
                                                icon: <ExternalLink size={16} />,
                                                href: `/event/${event.slug || event.id}`
                                            }
                                        ]}
                                    />
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
