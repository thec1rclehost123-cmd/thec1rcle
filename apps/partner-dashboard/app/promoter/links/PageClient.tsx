"use client";

import { useEffect, useState, useMemo, memo, forwardRef, useCallback } from "react";
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
    Wallet,
    X,
    Download,
    Instagram,
    MessageCircle,
    Twitter,
    Facebook,
    Mail,
    Globe
} from "lucide-react";

import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";

const CHANNELS = [
    { key: "wa", label: "WhatsApp", icon: MessageCircle, color: "bg-green-500" },
    { key: "ig", label: "Instagram", icon: Instagram, color: "bg-pink-500" },
    { key: "tw", label: "Twitter/X", icon: Twitter, color: "bg-slate-800" },
    { key: "fb", label: "Facebook", icon: Facebook, color: "bg-blue-600" },
    { key: "em", label: "Email", icon: Mail, color: "bg-amber-500" },
    { key: "ot", label: "Other", icon: Globe, color: "bg-gray-400" },
];

const GridContainer = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" />
));
GridContainer.displayName = "GridContainer";

const ItemContainer = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="h-full w-full" />
));
ItemContainer.displayName = "ItemContainer";

const MemoizedLinkCard = memo(({ campaign, index, promoterId, promoterUsername, links }: any) => {
    const [showChannels, setShowChannels] = useState(false);
    const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

    // Find existing link for this event
    const existingLink = links?.find((l: any) => l.eventId === campaign.id);
    const promoCode = existingLink?.code || null;

    const eventSlug = campaign.slug || campaign.id;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://c1rcle.app';

    const buildLink = (source?: string) => {
        // Use vanity URL if username is set, otherwise fall back to /e/ short URL
        const base = promoterUsername
            ? `${origin}/${promoterUsername}/${eventSlug}`
            : `${origin}/e/${eventSlug}?p=${promoterId}`;
        return source ? `${base}${promoterUsername ? '?' : '&'}s=${source}` : base;
    };

    const copyChannelLink = (channel: string) => {
        const link = buildLink(channel);
        navigator.clipboard.writeText(link);
        setCopiedChannel(channel);
        setTimeout(() => setCopiedChannel(null), 1500);
    };

    return (
        <div className="relative">
            <DashboardEventCard
                event={campaign}
                index={index}
                role="promoter"
                primaryAction={{
                    label: "Promote Now",
                    onClick: () => setShowChannels(true),
                    icon: <Share2 size={16} />
                }}
                secondaryActions={[
                    ...(promoCode ? [{
                        label: `Code: ${promoCode}`,
                        icon: <Zap size={16} />,
                        onClick: () => {
                            navigator.clipboard.writeText(promoCode);
                        }
                    }] : []),
                    {
                        label: promoterUsername
                            ? `c1rcle.app/${promoterUsername}/…`
                            : "Copy Direct Link",
                        icon: <Copy size={16} />,
                        onClick: () => {
                            navigator.clipboard.writeText(buildLink());
                        }
                    },
                    {
                        label: "View Event",
                        icon: <ExternalLink size={16} />,
                        href: `/event/${campaign.slug || campaign.id}`
                    }
                ]}
            />

            {/* Multi-Channel Popup */}
            {showChannels && (
                <div className="absolute inset-0 z-10 bg-surface-elevated/95 backdrop-blur-xl rounded-3xl border border-border-strong shadow-2xl flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-text-primary">Choose Channel</h4>
                        <button
                            onClick={() => setShowChannels(false)}
                            className="p-1.5 rounded-lg hover:bg-surface-secondary transition-all"
                        >
                            <X className="w-4 h-4 text-text-tertiary" />
                        </button>
                    </div>
                    <p className="text-[11px] text-text-tertiary mb-4">
                        Each channel generates a unique tracking link so you can see which platform drives the most sales.
                    </p>
                    <div className="grid grid-cols-2 gap-2 flex-1">
                        {CHANNELS.map(ch => (
                            <button
                                key={ch.key}
                                onClick={() => copyChannelLink(ch.key)}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${copiedChannel === ch.key
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-surface-secondary border-border-subtle hover:border-border-strong"
                                    }`}
                            >
                                <div className={`w-7 h-7 rounded-lg ${ch.color} flex items-center justify-center`}>
                                    <ch.icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">
                                        {copiedChannel === ch.key ? "Copied!" : ch.label}
                                    </p>
                                </div>
                                {copiedChannel === ch.key && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(buildLink());
                            setCopiedChannel("generic");
                            setTimeout(() => {
                                setCopiedChannel(null);
                                setShowChannels(false);
                            }, 1000);
                        }}
                        className="mt-3 w-full py-2.5 rounded-xl bg-surface-secondary text-xs font-bold text-text-secondary hover:bg-surface-tertiary transition-all"
                    >
                        {copiedChannel === "generic" ? "✓ Copied!" : "Copy without channel tracking"}
                    </button>
                </div>
            )}
        </div>
    );
});
MemoizedLinkCard.displayName = "MemoizedLinkCard";

export default function PromoLinksPage() {
    const { profile, user } = useDashboardAuth();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [links, setLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [promoterUsername, setPromoterUsername] = useState<string | null>(null);

    const promoterId = profile?.activeMembership?.partnerId;

    const fetchData = useCallback(async () => {
        if (!promoterId) return;
        try {
            const token = await user?.getIdToken();
            const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

            const [eventsRes, linksRes, profileRes] = await Promise.all([
                fetch(`/api/promoter/events?promoterId=${promoterId}&limit=20`),
                fetch(`/api/promoter/links?promoterId=${promoterId}&isActive=true`, { headers }),
                fetch(`/api/profile?profileId=${promoterId}&type=promoter`)
            ]);

            if (eventsRes.ok) {
                const data = await eventsRes.json();
                const fetched = (data.events || []).map((doc: any) => mapEventForClient(doc, doc.id));
                setCampaigns(fetched);
            }

            if (linksRes.ok) {
                const linkData = await linksRes.json();
                setLinks(linkData.links || linkData || []);
            }

            if (profileRes.ok) {
                const { profile: pData } = await profileRes.json();
                if (pData?.username) setPromoterUsername(pData.username);
            }
        } catch (e) {
            console.error("[Promoter Links] Error:", e);
        } finally {
            setLoading(false);
        }
    }, [promoterId, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            if (!c.isPublic) return false;
            const name = c.name || c.title || "";
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [campaigns, searchQuery]);

    // Calculate channel stats from links
    const channelStats = useMemo(() => {
        const stats: Record<string, number> = {};
        links.forEach((l: any) => {
            if (l.sourceStats) {
                Object.entries(l.sourceStats).forEach(([key, val]) => {
                    stats[key] = (stats[key] || 0) + (val as number);
                });
            }
        });
        return stats;
    }, [links]);

    return (
        <VenuePageShell
            title="MyLinks"
            subtitle="Generate channel-specific tracking links to measure conversions"
        >

            {/* Core Tools */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Link href="/promoter/guests">
                    <QuickToolItem label="Guest Stream" icon={Zap} info="Live Feed" color="emerald" />
                </Link>
                <Link href="/promoter/payouts">
                    <QuickToolItem label="Earnings" icon={Wallet} info="Check Payouts" color="indigo" />
                </Link>
                <Link href="/promoter/analytics/overview">
                    <QuickToolItem label="Analytics" icon={ArrowUpRight} info="Performance" color="amber" />
                </Link>
                <Link href="/promoter/partnerships">
                    <QuickToolItem label="Network" icon={Share2} info="Partnerships" color="rose" />
                </Link>
            </div>

            {/* Channel Performance Mini-Bar (only if data) */}
            {Object.keys(channelStats).length > 0 && (
                <div className="p-6 bg-surface-elevated rounded-[2rem] border border-border-default">
                    <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-4">Channel Performance</h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        {CHANNELS.map(ch => (
                            <div key={ch.key} className="flex items-center gap-2 p-3 rounded-xl bg-surface-secondary">
                                <div className={`w-6 h-6 rounded-md ${ch.color} flex items-center justify-center`}>
                                    <ch.icon className="w-3 h-3 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-text-primary">{channelStats[ch.key] || 0}</p>
                                    <p className="text-[9px] text-text-placeholder">{ch.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                            return (
                                <MemoizedLinkCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    index={index}
                                    promoterId={promoterId}
                                    promoterUsername={promoterUsername}
                                    links={links}
                                />
                            );
                        }}
                    />
                )}
            </div>
        </VenuePageShell>
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
        <div className="flex items-center gap-5 p-6 bg-surface-elevated border border-border-default rounded-3xl hover:border-border-strong hover:shadow-lg hover:shadow-slate-50 transition-all text-left shadow-sm cursor-pointer">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm ${colors[color]}`}>
                <Icon className="h-7 w-7" />
            </div>
            <div>
                <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">{info}</p>
                <p className="text-base font-extrabold text-text-primary mt-0.5">{label}</p>
            </div>
        </div>
    );
}
