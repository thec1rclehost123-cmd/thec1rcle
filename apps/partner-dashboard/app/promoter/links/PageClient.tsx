"use client";

import { useEffect, useState, useMemo, memo, forwardRef } from "react";
import { VirtuosoGrid } from "react-virtuoso";
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

import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";

const GridContainer = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" />
));
GridContainer.displayName = "GridContainer";

const ItemContainer = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="h-full w-full" />
));
ItemContainer.displayName = "ItemContainer";

const MemoizedLinkCard = memo(({ campaign, index, promoterId, promoCode }: any) => {
    const promoLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/e/${campaign.slug || campaign.id}?p=${promoterId}`;

    return (
        <DashboardEventCard
            event={campaign}
            index={index}
            role="promoter"
            primaryAction={{
                label: "Promote Now",
                onClick: () => {
                    navigator.clipboard.writeText(promoLink);
                    alert("Tracking link copied!");
                },
                icon: <Copy size={16} />
            }}
            secondaryActions={[
                {
                    label: `Copy Code: ${promoCode}`,
                    icon: <Zap size={16} />,
                    onClick: () => {
                        navigator.clipboard.writeText(promoCode);
                        alert("Promo code copied!");
                    }
                },
                {
                    label: "View Event",
                    icon: <ExternalLink size={16} />,
                    href: `/event/${campaign.slug || campaign.id}`
                },
                {
                    label: "Download Assets",
                    icon: <Share2 size={16} />,
                    onClick: () => alert("Assets downloading...")
                }
            ]}
        />
    );
});
MemoizedLinkCard.displayName = "MemoizedLinkCard";

export default function PromoLinksPage() {
    const { profile } = useDashboardAuth();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (!promoterId) return;

        const fetchCampaigns = async () => {
            try {
                const res = await fetch(`/api/promoter/events?promoterId=${promoterId}&limit=20`);
                if (!res.ok) throw new Error("Failed to fetch campaigns");
                const data = await res.json();
                const fetched = (data.events || []).map((doc: any) => mapEventForClient(doc, doc.id));
                setCampaigns(fetched);
            } catch (e) {
                console.error("[Promoter Links] Error fetching campaigns:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchCampaigns();
    }, [promoterId]);

    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            if (!c.isPublic) return false;
            const name = c.name || c.title || "";
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [campaigns, searchQuery]);

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-default pb-10">
                <div className="max-w-2xl">
                    <h1 className="text-4xl font-extrabold text-text-primary tracking-tight">
                        Sales Arsenal
                    </h1>
                    <p className="text-text-tertiary text-lg font-medium mt-3 leading-relaxed">
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
                    <h2 className="text-2xl font-extrabold text-text-primary tracking-tight">Active Campaigns</h2>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary group-focus-within:text-text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Find specific event..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface-elevated border border-border-default rounded-2xl pl-12 pr-6 py-3 text-sm text-text-primary focus:outline-none focus:border-border-strong w-80 transition-all font-medium shadow-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => <div key={i} className="h-40 bg-surface-elevated rounded-3xl border border-border-subtle animate-pulse shadow-sm" />)}
                    </div>
                ) : filteredCampaigns.length === 0 ? (
                    <div className="py-24 flex flex-col items-center text-center bg-surface-elevated rounded-[3rem] border border-border-default border-dashed">
                        <div className="h-20 w-20 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-6">
                            <Ticket className="h-10 w-10 text-text-placeholder" />
                        </div>
                        <h3 className="text-xl font-bold text-text-primary mb-2">No Campaigns Ready</h3>
                        <p className="text-text-tertiary text-sm font-medium">You haven't been assigned to any live events yet.</p>
                    </div>
                ) : (
                    <VirtuosoGrid
                        useWindowScroll
                        data={filteredCampaigns}
                        components={{ List: GridContainer, Item: ItemContainer }}
                        itemContent={(index, campaign) => {
                            const promoCode = profile?.displayName?.split(' ')[0]?.toUpperCase() || 'PROMO';
                            return (
                                <MemoizedLinkCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    index={index}
                                    promoterId={promoterId}
                                    promoCode={promoCode}
                                />
                            );
                        }}
                    />
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
        <button className="flex items-center gap-5 p-6 bg-surface-elevated border border-border-default rounded-3xl hover:border-border-strong hover:shadow-lg hover:shadow-slate-50 transition-all text-left shadow-sm">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm ${colors[color]}`}>
                <Icon className="h-7 w-7" />
            </div>
            <div>
                <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">{info}</p>
                <p className="text-base font-extrabold text-text-primary mt-0.5">{label}</p>
            </div>
        </button>
    );
}

