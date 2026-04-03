import { notFound } from "next/navigation";
import Link from "next/link";
import { getPromoterByUsername, getPromoterActiveEvents } from "../../lib/server/promoterStore";

// Handles that map to real static routes — never treat as a promoter username
const RESERVED_HANDLES = new Set([
    "about", "api", "app", "auth", "checkout", "confirmation",
    "e", "event", "explore", "forgot-password", "host", "hosts",
    "interviews", "login", "privacy", "profile", "terms",
    "tickets", "venue", "search", "sitemap", "robots"
]);

export async function generateMetadata({ params }) {
    const handle = decodeURIComponent(params.handle).toLowerCase();
    if (RESERVED_HANDLES.has(handle)) return { title: "Not Found" };

    const promoter = await getPromoterByUsername(handle);
    if (!promoter) return { title: "Promoter Not Found | THE C1RCLE" };

    const name = promoter.displayName || promoter.name || handle;
    const city = promoter.city || "India";
    const bio = promoter.bio || promoter.summary || `Nightlife promoter in ${city}`;

    return {
        title: `${name} (@${handle}) | THE C1RCLE`,
        description: bio,
        openGraph: {
            title: `${name} on THE C1RCLE`,
            description: bio,
            siteName: "THE.C1RCLE",
            type: "profile",
        },
    };
}

export const revalidate = 60;

export default async function PromoterHandlePage({ params }) {
    const handle = decodeURIComponent(params.handle).toLowerCase();

    if (RESERVED_HANDLES.has(handle)) notFound();

    const promoter = await getPromoterByUsername(handle);
    if (!promoter) notFound();

    const events = await getPromoterActiveEvents(promoter.id);

    const name = promoter.displayName || promoter.name || handle;
    const city = promoter.city || "India";
    const bio = promoter.bio || promoter.summary || null;
    const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const tonightEvents = events.filter(e => {
        const start = new Date(e.startDate || 0);
        return start >= now && start <= todayEnd;
    });
    const upcomingEvents = events.filter(e => {
        const start = new Date(e.startDate || 0);
        return start > todayEnd;
    });

    return (
        <div className="min-h-screen bg-[#050508] text-white">
            {/* Ambient glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 blur-[140px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-5 pt-16 pb-24">
                {/* Hero */}
                <div className="flex flex-col items-center text-center mb-14">
                    {/* Avatar */}
                    <div className="relative mb-6">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-violet-900/50">
                            {initials}
                        </div>
                        <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-[#050508]">
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-4xl font-black tracking-tight mb-1">{name}</h1>
                    <p className="text-[13px] font-semibold text-violet-400 tracking-widest uppercase mb-2">
                        @{handle} · {city}
                    </p>
                    {bio && (
                        <p className="text-[14px] text-white/50 max-w-sm leading-relaxed mt-1">{bio}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-8 mt-8 pt-8 border-t border-white/[0.06] w-full justify-center">
                        <StatPill label="Events" value={promoter.eventsCount || events.length || "—"} />
                        <div className="w-px h-8 bg-white/10" />
                        <StatPill label="Guests Brought" value={formatNum(promoter.totalGuests || promoter.guestsCount)} />
                        <div className="w-px h-8 bg-white/10" />
                        <StatPill label="City" value={city} />
                    </div>
                </div>

                {/* Tonight */}
                {tonightEvents.length > 0 && (
                    <Section label="Tonight">
                        {tonightEvents.map(event => (
                            <EventCard key={event.id} event={event} handle={handle} highlight />
                        ))}
                    </Section>
                )}

                {/* Upcoming */}
                {upcomingEvents.length > 0 && (
                    <Section label={tonightEvents.length > 0 ? "Upcoming" : "Events"}>
                        {upcomingEvents.map(event => (
                            <EventCard key={event.id} event={event} handle={handle} />
                        ))}
                    </Section>
                )}

                {events.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-white/20 text-sm font-semibold uppercase tracking-widest">No active events</p>
                        <p className="text-white/10 text-xs mt-2">Check back soon</p>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-20 text-center">
                    <Link href="/explore" className="text-[10px] font-black uppercase tracking-[0.25em] text-white/20 hover:text-white/40 transition-colors">
                        Powered by THE C1RCLE
                    </Link>
                </div>
            </div>
        </div>
    );
}

function StatPill({ label, value }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-xl font-black text-white">{value}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</span>
        </div>
    );
}

function Section({ label, children }) {
    return (
        <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">{label}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

function EventCard({ event, handle, highlight = false }) {
    const title = event.title || event.name || "Untitled Event";
    const slug = event.slug || event.id;
    const venue = event.venueName || event.venue?.name || event.location || null;
    const date = formatEventDate(event.startDate);
    const minPrice = getMinPrice(event);
    const poster = event.image || event.poster || event.coverImage || null;
    const href = event.promoterLinkUrl || (event.promoterLinkCode ? `/${handle}/${slug}?ref=${encodeURIComponent(event.promoterLinkCode)}` : `/${handle}/${slug}`);

    return (
        <Link href={href} className="group block">
            <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${highlight
                ? "border-violet-500/30 bg-violet-950/30 hover:border-violet-400/50"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                }`}>
                <div className="flex gap-0">
                    {/* Poster thumbnail */}
                    {poster && (
                        <div className="w-28 flex-shrink-0">
                            <img
                                src={poster}
                                alt={title}
                                className="w-full h-full object-cover min-h-[96px]"
                            />
                        </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 p-4 flex flex-col justify-between min-h-[96px]">
                        <div>
                            {highlight && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[9px] font-black uppercase tracking-widest mb-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                    Tonight
                                </span>
                            )}
                            <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{title}</h3>
                            {venue && (
                                <p className="text-[11px] text-white/40 font-medium mt-0.5 truncate">{venue}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-3">
                            <span className="text-[11px] font-semibold text-white/40">{date}</span>
                            <div className="flex items-center gap-2">
                                {minPrice && (
                                    <span className="text-[11px] font-bold text-white/60">
                                        {minPrice}
                                    </span>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 group-hover:text-violet-300 transition-colors">
                                    Get In →
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}

function formatEventDate(dateStr) {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
    } catch {
        return "";
    }
}

function getMinPrice(event) {
    const tiers = event.tickets || event.tiers || event.ticketTiers || [];
    if (!Array.isArray(tiers) || tiers.length === 0) return null;
    const prices = tiers.map(t => Number(t.price || t.amount || 0)).filter(p => p > 0);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    return `₹${min.toLocaleString("en-IN")}`;
}

function formatNum(n) {
    if (!n) return "—";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}
