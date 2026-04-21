import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchPublicVenue } from "../../../lib/server/publicDiscoveryBridge.js";
import VenuePageClient from "../../../components/venue/VenuePageClient";

export const revalidate = 120;

const getVenuePublicProfile = cache(fetchPublicVenue);

function normalizeEventCard(event) {
    return {
        ...event,
        name: event.name || event.title,
        coverImage: event.coverImage || event.image || event.posterUrl,
        startDate: event.startDate || event.startAt,
    };
}

/**
 * Venue Public Page - Fully Dynamic
 * All data fetched using venue_id from the slug
 * No hardcoded content - sections hide if no data
 */

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const data = await getVenuePublicProfile(slug);
    const venue = data?.venue;
    if (!venue) return { title: "Venue Not Found" };

    return {
        title: `${venue.name} | THE C1RCLE`,
        description: venue.bio || venue.description || `Discover events at ${venue.name} on THE C1RCLE`,
        openGraph: {
            title: `${venue.name} | THE C1RCLE`,
            description: venue.bio || venue.description,
            images: [venue.coverURL || venue.image || "/og-default.jpg"],
        },
    };
}

export default async function VenuePublicPage({ params }) {
    const { slug } = await params;

    const data = await getVenuePublicProfile(slug);
    const venue = data?.venue;
    if (!venue) notFound();

    const highlights = data.highlights || [];
    const stats = data.stats || null;
    const upcomingEvents = (data.upcomingEvents || []).map(normalizeEventCard);
    const pastEvents = (data.pastEvents || []).map(normalizeEventCard).slice(0, 20);
    const similarVenues = data.similarVenues || [];

    return (
        <main className="min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white selection:bg-[#F44A22]/40 selection:text-white font-body overflow-x-hidden transition-colors duration-300">
            {/* 
                VenuePageClient handles all dynamic sections:
                1. Hero Section (Poster with Cover, Logo, Name, Category, Follow Button)
                2. Quick Action Buttons (Follow, Call, Directions, WhatsApp, Share)
                3. Highlights Section (Instagram-style stories)
                4. Action Cards (Upcoming Events & Food Menu)
                5. Facilities & Amenities
                6. Venue Gallery (3x3 Grid)
                7. Past Events
                8. Complete Venue Details
                9. Sticky CTA Bar
                
                Each section only renders if it has data.
            */}
            <VenuePageClient
                venue={venue}
                upcomingEvents={upcomingEvents}
                pastEvents={pastEvents}
                stats={stats}
                highlights={highlights}
                similarVenues={similarVenues}
            />
        </main>
    );
}
