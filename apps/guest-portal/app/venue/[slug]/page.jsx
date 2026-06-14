import { notFound } from "next/navigation";
import { getVenueBySlug, listVenues } from "../../../lib/server/venueStore";
import {
  getProfilePosts,
  getProfileHighlights,
  getProfileStats,
} from "../../../lib/server/partnerProfileStore";
import { listEvents } from "../../../lib/server/eventStore";
import VenuePageClient from "../../../components/venue/VenuePageClient";

export const revalidate = 0; // Disable caching for real-time updates during debugging

/**
 * Venue Public Page - Fully Dynamic
 * All data fetched using venue_id from the slug
 * No hardcoded content - sections hide if no data
 */

export async function generateMetadata({ params }) {
  const { slug } = params;
  const venue = await getVenueBySlug(slug);
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
  const { slug } = params;

  // Fetch venue details using slug (which contains venue_id)
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();

  // Fetch all related data in parallel using venue.id
  const [highlights, stats, allEvents, allVenues] = await Promise.all([
    getProfileHighlights(venue.id, "venue").catch(() => []),
    getProfileStats(venue.id, "venue").catch(() => null),
    listEvents({ limit: 100 }).catch(() => []),
    listVenues({}).catch(() => []),
  ]);

  // Filter events for this venue
  const venueEvents = allEvents.filter((e) => {
    // Match by venueId directly
    if (e.venueId && e.venueId === venue.id) return true;
    // Match by venue name as fallback
    if (e.venue && venue.name && e.venue.toLowerCase() === venue.name.toLowerCase()) return true;
    return false;
  });

  const now = new Date();

  // Upcoming events: future dates only, sorted chronologically
  const upcomingEvents = venueEvents
    .filter((e) => new Date(e.startDate || e.startAt) > now)
    .sort((a, b) => new Date(a.startDate || a.startAt) - new Date(b.startDate || b.startAt));

  // Past events: already happened, sorted most recent first
  const pastEvents = venueEvents
    .filter((e) => new Date(e.startDate || e.startAt) <= now)
    .sort((a, b) => new Date(b.startDate || b.startAt) - new Date(a.startDate || a.startAt))
    .slice(0, 20);

  // Get similar venues (same area or city)
  const similarVenues = allVenues
    .filter((v) => v.id !== venue.id && (v.area === venue.area || v.city === venue.city))
    .slice(0, 6);

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
