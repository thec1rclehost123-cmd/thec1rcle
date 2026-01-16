"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Calendar,
    MapPin,
    Users,
    ChevronLeft,
    Edit,
    Share2,
    AlertCircle,
    CheckCircle2,
    Clock,
    ShieldAlert,
    TrendingUp,
    Download,
    ArrowUpRight,
    Loader2,
    Ticket,
    ChevronRight,
    Lock,
    History as HistoryIcon
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import AuditTrail from "@/components/shared/AuditTrail";
import SurgeMonitor from "@/components/events/SurgeMonitor";

export default function HostEventDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { profile } = useDashboardAuth();
    const [event, setEvent] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [finance, setFinance] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEventDetail = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const [eventRes, statsRes, financeRes] = await Promise.all([
                    fetch(`/api/events/${id}`),
                    fetch(`/api/events/${id}/guestlist`),
                    fetch(`/api/finance/breakdown?eventId=${id}`)
                ]);

                if (eventRes.ok) {
                    const eventData = await eventRes.json();
                    setEvent(eventData.event);
                }
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData.stats);
                }
                if (financeRes.ok) {
                    const financeData = await financeRes.json();
                    setFinance(financeData.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEventDetail();
    }, [id]);

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Records...</p>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="py-24 text-center">
                <h2 className="text-2xl font-bold">Event not found</h2>
                <Link href="/host/events" className="text-indigo-600 mt-4 inline-block">Back to Events</Link>
            </div>
        );
    }

    const isLocked = event.lifecycle === "submitted" || event.lifecycle === "scheduled" || event.lifecycle === "live" || event.lifecycle === "approved";
    const isRejected = event.lifecycle === "rejected" || event.lifecycle === "needs_changes" || event.lifecycle === "denied";

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Nav & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => router.back()}
                        className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <EventBadge lifecycle={event.lifecycle} />
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.date}</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">{event.title || event.name}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {!isLocked ? (
                        <Link
                            href={`/host/create?id=${id}`}
                            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-slate-800 transition-all"
                        >
                            <Edit className="h-5 w-5" />
                            Continue Setup
                        </Link>
                    ) : (
                        <div className="flex items-center gap-3 px-8 py-4 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl text-sm font-bold cursor-not-allowed">
                            <Lock className="h-5 w-5" />
                            Editing Locked
                        </div>
                    )}
                    <button className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
                        <Share2 className="h-5 w-5 text-slate-400" />
                    </button>
                    <a
                        href={`https://thec1rcle.in/e/${id}`}
                        target="_blank"
                        className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm text-slate-400"
                    >
                        <ArrowUpRight className="h-5 w-5" />
                    </a>
                </div>
            </div>

            {/* Rejection Alert */}
            {isRejected && (
                <div className="bg-rose-50 border border-rose-100 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="h-16 w-16 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-100">
                        <ShieldAlert className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-black text-rose-900 uppercase tracking-tight">Production Blocked</h3>
                        <p className="text-rose-600 text-sm font-medium mt-1 leading-relaxed">
                            {event.rejectionReason || "Minimal changes required to comply with venue standards. Review requirements and resubmit."}
                        </p>
                    </div>
                    <Link
                        href={`/host/create?id=${id}`}
                        className="px-8 py-4 bg-rose-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-rose-900/20"
                    >
                        Resolve & Resubmit
                    </Link>
                </div>
            )}

            {/* Surge Monitor */}
            <SurgeMonitor eventId={id} />

            {/* Status Panel */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm overflow-hidden relative">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                    <div className="flex-1 space-y-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Production Status</h3>
                            <p className="text-slate-500 text-sm font-medium">Tracking the lifecycle of your event from draft to performance.</p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-8">
                            <Metric value={stats?.total || 0} label="Tickets Authorized" icon={Ticket} color="indigo" />
                            <Metric value={stats?.checkedIn || 0} label="Turnout Verified" icon={Users} color="emerald" />
                            <Metric value={`₹${finance?.gross || 0}`} label="Gross Settlement" icon={TrendingUp} color="amber" />
                        </div>
                    </div>

                    <div className="w-full md:w-80 bg-slate-50 rounded-3xl p-8 border border-slate-100">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Logistics Snapshot
                        </h4>
                        <div className="space-y-6">
                            <LogItem label="Venue" value={event.venue || "TBD"} />
                            <LogItem label="City" value={event.city || "Pune, IN"} />
                            <LogItem label="Capacity" value={event.capacity || "500"} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Insights List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-white">
                <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight opacity-60 mb-6">Promoter Pulse</h3>
                        <p className="text-white/40 text-sm leading-relaxed mb-8 font-medium italic">
                            "Current demand is high among your connected promoter network. Expect peak scan velocity 2 hours into doors."
                        </p>
                    </div>
                    <Link href="/host/promoters" className="flex items-center justify-between text-xs font-black uppercase tracking-widest group">
                        Manage Affiliates <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="bg-indigo-600 rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-100 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight opacity-60 mb-6">Financial Audit</h3>
                        <p className="text-white/60 text-sm font-medium leading-relaxed mb-8">
                            Reports are synchronized with the primary ledger. Final settlement will trigger post-event audit.
                        </p>
                    </div>
                    <button className="flex items-center justify-between text-xs font-black uppercase tracking-widest group">
                        Download Manifest <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Audit Trail Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                        <HistoryIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Event Activity Log</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Chronological Immutable Audit Trail</p>
                    </div>
                </div>
                <AuditTrail entries={event.auditTrail} />
            </div>
        </div>
    );
}

function EventBadge({ lifecycle }: { lifecycle: string }) {
    const config: any = {
        live: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400" },
        scheduled: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-400" },
        approved: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-400" },
        submitted: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400" },
        draft: { bg: "bg-slate-50", text: "text-slate-400", dot: "bg-slate-200" },
        rejected: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-400" },
        needs_changes: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-400" }
    };

    const style = config[lifecycle] || config.draft;

    return (
        <span className={`px-4 py-1.5 rounded-full ${style.bg} ${style.text} text-[9px] font-black uppercase tracking-widest border border-current/10 flex items-center gap-2`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {lifecycle?.replace('_', ' ')}
        </span>
    );
}

function Metric({ value, label, icon: Icon, color }: any) {
    const colors: any = {
        indigo: "text-indigo-600 bg-indigo-50",
        emerald: "text-emerald-600 bg-emerald-50",
        amber: "text-amber-600 bg-amber-50"
    };

    return (
        <div className="flex-1 p-6 rounded-3xl border border-slate-50 hover:border-slate-100 transition-all group">
            <div className={`h-10 w-10 rounded-xl ${colors[color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        </div>
    );
}

function LogItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-xs font-bold text-slate-900 text-right truncate">{value}</p>
        </div>
    );
}

