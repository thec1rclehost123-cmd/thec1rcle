import { notFound } from "next/navigation";
import Link from "next/link";
import { getPromoterByUsername } from "../../../lib/server/promoterStore";
import { getEvent } from "../../../lib/server/eventStore";
import { PUBLIC_LIFECYCLE_STATES } from "@c1rcle/core/events";
import EventGlow from "./EventGlow";

export async function generateMetadata({ params }) {
    const handle = decodeURIComponent(params.handle).toLowerCase();
    const slug = decodeURIComponent(params.eventSlug);

    const [promoter, event] = await Promise.all([
        getPromoterByUsername(handle),
        getEvent(slug)
    ]);

    if (!event || !PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        return { title: "Event Not Found | THE C1RCLE" };
    }

    const eventTitle = (event.title || event.name || "Event").toUpperCase();
    const description = event.summary || event.description || "Get your tickets now.";
    const image = event.image || event.poster || event.coverImage || "/logo-circle.jpg";
    const promoterName = promoter?.displayName || promoter?.name || handle;

    return {
        title: `${eventTitle} | THE C1RCLE`,
        description,
        openGraph: {
            title: `THE.C1RCLE | ${eventTitle}`,
            description: promoter
                ? `via @${handle} — ${description}`
                : description,
            images: [image],
            siteName: "THE.C1RCLE",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title: `THE.C1RCLE | ${eventTitle}`,
            description,
            images: [image],
        },
    };
}

export const revalidate = 120;

export default async function VanityEventPage({ params }) {
    const handle = decodeURIComponent(params.handle).toLowerCase();
    const slug = decodeURIComponent(params.eventSlug);

    const [promoter, event] = await Promise.all([
        getPromoterByUsername(handle),
        getEvent(slug)
    ]);

    if (!event || !PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        notFound();
    }

    const promoterName = promoter?.displayName || promoter?.name || handle;
    const promoterId = promoter?.id || null;

    const title = event.title || event.name || "Untitled Event";
    const poster = event.image || event.poster || event.coverImage || null;
    const venue = event.venueName || event.venue?.name || event.location || null;
    const description = event.summary || event.description || null;
    const tiers = (event.tickets || event.tiers || event.ticketTiers || []).filter(t => t && (t.price || t.amount));
    const date = formatEventDate(event.startDate);
    const time = formatEventTime(event.startDate);

    // Checkout base URL — passes promoter attribution via ?p=
    const checkoutBase = promoterId
        ? `/checkout/${event.id}?p=${promoterId}`
        : `/checkout/${event.id}`;

    return (
        <div className="min-h-screen text-white relative" style={{ background: "#050508" }}>

            {/* Poster-tinted atmospheric glow — client component, fixed behind everything */}
            <EventGlow posterUrl={poster} />

            {/* Hero — full bleed poster */}
            <div className="relative z-10 w-full" style={{ minHeight: "70vh" }}>
                {poster ? (
                    <>
                        <img
                            src={poster}
                            alt={title}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Gradient overlay — heavy at bottom to dissolve into glow, light at top so poster shows */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/50 to-transparent" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-indigo-950 to-[#050508]" />
                )}

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
                    <Link
                        href={`/${handle}`}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-[11px] font-bold uppercase tracking-widest">@{handle}</span>
                    </Link>

                    {promoter && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-sm border border-white/[0.1]">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[8px] font-black">
                                {promoterName[0]?.toUpperCase()}
                            </div>
                            <span className="text-[10px] font-bold text-white/70">via @{handle}</span>
                        </div>
                    )}
                </div>

                {/* Event identity — positioned at bottom of hero */}
                <div className="relative z-10 px-5 pb-8 pt-[35vh]">
                    <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight leading-[1.05] mb-3">
                        {title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        {date && (
                            <span className="text-[12px] font-bold text-white/60 uppercase tracking-widest">
                                {date}
                            </span>
                        )}
                        {time && (
                            <>
                                <span className="text-white/20">·</span>
                                <span className="text-[12px] font-bold text-white/60 uppercase tracking-widest">
                                    {time}
                                </span>
                            </>
                        )}
                        {venue && (
                            <>
                                <span className="text-white/20">·</span>
                                <span className="text-[12px] font-bold text-white/60">{venue}</span>
                            </>
                        )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {[event.category, event.genre, event.ageLimit && `${event.ageLimit}+`]
                            .filter(Boolean)
                            .map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-bold uppercase tracking-widest text-white/50">
                                    {tag}
                                </span>
                            ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-lg mx-auto px-5 pb-24 space-y-10">

                {/* Tickets */}
                {tiers.length > 0 && (
                    <div>
                        <SectionLabel>Tickets</SectionLabel>
                        <div className="space-y-3">
                            {tiers.map((tier, i) => {
                                const tierId = tier.id || `tier-${i}`;
                                const tierName = tier.name || tier.label || `Tier ${i + 1}`;
                                const price = Number(tier.price || tier.amount || 0);
                                const available = tier.available !== false && (tier.quantity == null || tier.quantity > 0);

                                return (
                                    <div
                                        key={tierId}
                                        className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-violet-500/30 transition-all"
                                        style={{ boxShadow: "0 0 0 0px transparent, 0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-white">{tierName}</p>
                                            {tier.description && (
                                                <p className="text-[11px] text-white/40 mt-0.5">{tier.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-base font-black text-white">
                                                {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free"}
                                            </span>
                                            {available ? (
                                                <Link
                                                    href={`${checkoutBase}&tier=${tierId}`}
                                                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest transition-colors whitespace-nowrap"
                                                >
                                                    Book
                                                </Link>
                                            ) : (
                                                <span className="px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/30 text-[11px] font-black uppercase tracking-widest">
                                                    Sold Out
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Primary CTA if no tiers selected */}
                        <Link
                            href={checkoutBase}
                            className="mt-4 flex items-center justify-center w-full py-4 rounded-2xl bg-white text-black text-[12px] font-black uppercase tracking-[0.2em] hover:bg-white/90 transition-all"
                                style={{ boxShadow: "0 0 40px rgba(139,92,246,0.25), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9)" }}
                        >
                            Get Tickets
                        </Link>
                    </div>
                )}

                {tiers.length === 0 && (
                    <Link
                        href={checkoutBase}
                        className="flex items-center justify-center w-full py-5 rounded-2xl bg-white text-black text-[12px] font-black uppercase tracking-[0.2em] hover:bg-white/90 transition-all"
                    style={{ boxShadow: "0 0 40px rgba(139,92,246,0.25), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9)" }}
                    >
                        Get Tickets
                    </Link>
                )}

                {/* About */}
                {description && (
                    <div>
                        <SectionLabel>About</SectionLabel>
                        <p className="text-[14px] text-white/50 leading-relaxed">{description}</p>
                    </div>
                )}

                {/* Promoted by */}
                {promoter && (
                    <div>
                        <SectionLabel>Promoted by</SectionLabel>
                        <Link href={`/${handle}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-violet-500/30 transition-all" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-base font-black text-white flex-shrink-0">
                                {promoterName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">{promoterName}</p>
                                <p className="text-[11px] text-violet-400 font-semibold">@{handle} · {promoter.city || "India"}</p>
                                {promoter.bio && (
                                    <p className="text-[11px] text-white/30 mt-0.5 truncate">{promoter.bio}</p>
                                )}
                            </div>
                            <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center pt-4">
                    <Link href="/explore" className="text-[10px] font-black uppercase tracking-[0.25em] text-white/15 hover:text-white/30 transition-colors">
                        Powered by THE C1RCLE
                    </Link>
                </div>
            </div>
        </div>
    );
}

function SectionLabel({ children }) {
    return (
        <div className="flex items-center gap-4 mb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25">{children}</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
    );
}

function formatEventDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase();
    } catch {
        return null;
    }
}

function formatEventTime(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
    } catch {
        return null;
    }
}
