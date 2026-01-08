import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getVenueBySlug } from "../../../lib/server/venueStore";
import { getProfilePosts, getProfileHighlights, getProfileStats } from "../../../lib/server/partnerProfileStore";
import { listEvents } from "../../../lib/server/eventStore";
import EventGrid from "../../../components/EventGrid";
import { CheckCircle2, MapPin, Calendar, Heart, Eye, Instagram, Mail, Globe, Clock, Music } from "lucide-react";
import ProfileClient from "./ProfileClient";

export const revalidate = 60; // Revalidate every minute

export default async function VenuePublicPage({ params }) {
    const { slug } = params;

    // Fetch venue details
    const venue = await getVenueBySlug(slug);
    if (!venue) notFound();

    // Fetch posts, highlights, and stats
    const [posts, highlights, stats, allEvents] = await Promise.all([
        getProfilePosts(venue.id, "venue"),
        getProfileHighlights(venue.id, "venue"),
        getProfileStats(venue.id, "venue"),
        listEvents({ limit: 100 })
    ]);

    // PRODUCTION HARDENING: Robust event filtering
    const venueEvents = allEvents.filter(e => {
        // Priority 1: Match by venueId (canonical)
        if (e.venueId && e.venueId === venue.id) return true;

        // Priority 2: Match by venue name (fallback for legacy or partner events)
        if (e.venue && venue.name && e.venue.toLowerCase() === venue.name.toLowerCase()) return true;

        return false;
    });

    const now = new Date();
    const upcomingEvents = venueEvents.filter(e => new Date(e.startDate || e.startAt) > now)
        .sort((a, b) => new Date(a.startDate || a.startAt) - new Date(b.startDate || b.startAt));

    return (
        <main className="min-h-screen bg-[var(--bg-color)] text-[var(--text-primary)]">
            {/* Header / Identity Layer - Apple Editorial Style */}
            <div className="relative h-[50vh] min-h-[500px] w-full overflow-hidden bg-[var(--surface-2)]">
                <Image
                    src={venue.coverURL || venue.image || "/events/neon-nights.jpg"}
                    alt={venue.name}
                    fill
                    className="object-cover opacity-80"
                    priority
                />
                {/* Subtle overlay for legibility */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-color)]/90" />

                <div className="absolute bottom-0 left-0 w-full px-6 pb-20 sm:px-12 lg:px-24">
                    <div className="flex flex-col md:flex-row md:items-end gap-10 max-w-7xl mx-auto">
                        {/* Profile Image - Precision Radius */}
                        <div className="relative h-32 w-32 md:h-44 md:w-44 rounded-[2rem] overflow-hidden border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl flex-shrink-0">
                            <Image
                                src={venue.photoURL || venue.image || "/events/holi-edit.svg"}
                                alt={venue.name}
                                fill
                                className="object-cover"
                            />
                        </div>

                        {/* Info - Typography Driven */}
                        <div className="flex-1 space-y-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-[var(--text-primary)]">
                                        {venue.name}
                                    </h1>
                                    {venue.isVerified && (
                                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-[var(--text-secondary)] text-[13px] font-bold uppercase tracking-[0.15em]">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {venue.area}, {venue.city || "Pune"}
                                    </div>
                                </div>
                            </div>

                            <p className="max-w-2xl text-[var(--text-secondary)] text-[16px] leading-relaxed font-medium opacity-90">
                                {venue.bio || venue.description || "The premier destination for nightlife and culture."}
                            </p>

                            <div className="flex gap-10 pt-4 border-t border-[var(--border-secondary)] w-fit">
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold tabular-nums tracking-tight">{(stats.followersCount || 0).toLocaleString('en-IN')}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Followers</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold tabular-nums tracking-tight">{upcomingEvents.length}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Live Events</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold tabular-nums tracking-tight">{(stats.totalLikes || 0).toLocaleString('en-IN')}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Endorsements</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pb-2 pt-6 md:pt-0">
                            <button className="px-12 py-4 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-lg active:scale-95">
                                Follow
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <ProfileClient
                upcomingEvents={upcomingEvents}
                posts={posts}
                highlights={highlights}
                venue={venue}
            />
        </main>
    );
}
