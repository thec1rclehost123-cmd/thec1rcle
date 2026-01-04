"use client";

import { useEffect, useState } from "react";
import {
    Link as LinkIcon,
    Copy,
    QrCode,
    ExternalLink,
    Search,
    Filter,
    CheckCircle2,
    Ticket,
    Zap,
    Share2,
    Calendar,
    ArrowUpRight,
    ChevronRight,
    Wallet
} from "lucide-react";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";

export default function PromoLinksPage() {
    const { profile } = useDashboardAuth();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (!promoterId) return;

        const db = getFirebaseDb();
        const q = query(
            collection(db, "events"),
            where("status", "==", "live"),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCampaigns(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [promoterId]);

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div className="max-w-2xl">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                        Sales Arsenal
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3 leading-relaxed">
                        Access your unique tracking links and promo codes. Every sale generated through these tools is automatically credited to your account.
                    </p>
                </div>
            </div>

            {/* Core Tools */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <QuickToolItem label="My Tracker" icon={LinkIcon} info="Unique Links" color="emerald" />
                <QuickToolItem label="Sales Log" icon={Zap} info="Check Earnings" color="indigo" />
                <QuickToolItem label="Brand Assets" icon={Share2} info="Event Media" color="amber" />
                <QuickToolItem label="Support" icon={Ticket} info="Help Center" color="rose" />
            </div>

            {/* Campaign Management */}
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Active Campaigns</h2>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find specific event..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400 w-80 transition-all font-medium shadow-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-3xl border border-slate-100 animate-pulse shadow-sm" />)}
                    </div>
                ) : filteredCampaigns.length === 0 ? (
                    <div className="py-24 flex flex-col items-center text-center bg-white rounded-[3rem] border border-slate-200 border-dashed">
                        <div className="h-20 w-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                            <Ticket className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No Campaigns Ready</h3>
                        <p className="text-slate-500 text-sm font-medium">You haven't been assigned to any live events yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredCampaigns.map((campaign) => (
                            <ArsenalCard key={campaign.id} campaign={campaign} promoterId={promoterId} profile={profile} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function QuickToolItem({ label, icon: Icon, info, color }: any) {
    const colors: any = {
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100"
    };
    return (
        <button className="flex items-center gap-5 p-6 bg-white border border-slate-200 rounded-3xl hover:border-slate-400 hover:shadow-lg hover:shadow-slate-50 transition-all text-left shadow-sm">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm ${colors[color]}`}>
                <Icon className="h-7 w-7" />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{info}</p>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">{label}</p>
            </div>
        </button>
    );
}

function ArsenalCard({ campaign, promoterId, profile }: any) {
    const promoLink = `https://posh.india/e/${campaign.slug || campaign.id}?p=${promoterId}`;
    const promoCode = profile?.displayName?.split(' ')[0]?.toUpperCase() || 'PROMO';
    const [copied, setCopied] = useState(false);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 group hover:border-slate-400 hover:shadow-xl hover:shadow-slate-100 transition-all shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-8">
                    <div className="h-24 w-24 bg-slate-50 rounded- [2rem] overflow-hidden border border-slate-100 shadow-sm flex-shrink-0">
                        {campaign.poster_url ? (
                            <img src={campaign.poster_url} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center">
                                <Calendar className="h-10 w-10 text-slate-200" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">{campaign.name}</h3>
                        <div className="flex items-center gap-6">
                            <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                <Calendar className="h-4 w-4 text-emerald-600" /> {campaign.date}
                            </span>
                            <span className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                                <Zap className="h-4 w-4" /> {campaign.commission_rate || '15'}% Earnings
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tracking Link</p>
                        <div className="flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
                            <span className="text-sm font-mono text-slate-500 pl-4 w-44 truncate">{promoLink}</span>
                            <button
                                onClick={() => handleCopy(promoLink)}
                                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs shadow-sm"
                            >
                                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Copied" : "Copy Link"}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Universal Code</p>
                        <button
                            onClick={() => handleCopy(promoCode)}
                            className="h-[60px] px-8 bg-emerald-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                        >
                            {promoCode}
                        </button>
                    </div>

                    <div className="flex items-center gap-3 pl-6 border-l border-slate-100 h-10">
                        <button className="p-4 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                            <QrCode className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
