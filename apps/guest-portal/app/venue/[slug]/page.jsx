import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getVenueBySlug } from "../../../lib/server/venueStore";
import { getProfilePosts, getProfileHighlights, getProfileStats } from "../../../lib/server/partnerProfileStore";
import { listEvents } from "../../../lib/server/eventStore";
import { CheckCircle2, MapPin, Calendar, Heart, Eye, Instagram, Mail, Globe, Clock, Music, Phone, Play, ChevronRight, Users, Car, Wifi, UtensilsCrossed, Award, Building2 } from "lucide-react";
import ProfileClient from "./ProfileClient";

export const revalidate = 60;

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

// Amenity icon mapping
const AMENITY_ICONS = {
    parking: Car,
    wifi: Wifi,
    food: UtensilsCrossed,
    vip: Award,
    outdoor: Building2,
    smoking: Clock
};

const AMENITY_LABELS = {
    parking: "Valet Parking",
    wifi: "Free WiFi",
    food: "Food Service",
    vip: "VIP Areas",
    outdoor: "Outdoor Space",
    smoking: "Smoking Area"
};

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
        if (e.venueId && e.venueId === venue.id) return true;
        if (e.venue && venue.name && e.venue.toLowerCase() === venue.name.toLowerCase()) return true;
        return false;
    });

    const now = new Date();
    const upcomingEvents = venueEvents.filter(e => new Date(e.startDate || e.startAt) > now)
        .sort((a, b) => new Date(a.startDate || a.startAt) - new Date(b.startDate || b.startAt));
    const pastEvents = venueEvents.filter(e => new Date(e.startDate || e.startAt) <= now).slice(0, 6);

    return (
        <main className="min-h-screen bg-[#0A0A0A] text-white selection:bg-white selection:text-black">
            {/* Hero Section - Premium Identity Layer */}
            <div className="relative min-h-[70vh] w-full overflow-hidden">
                {/* Background Image with Parallax Effect */}
                <div className="absolute inset-0">
                    <Image
                        src={venue.coverURL || venue.image || "/events/neon-nights.jpg"}
                        alt={venue.name}
                        fill
                        priority
                        className="object-cover opacity-50 scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-[#0A0A0A]/60 to-[#0A0A0A]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 via-transparent to-[#0A0A0A]/80" />
                </div>

                {/* Noise Texture */}
                <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")`
                }} />

                {/* Content */}
                <div className="relative z-10 h-full flex items-end pb-16 pt-32">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 w-full">
                        <div className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-12">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                <div className="w-36 h-36 lg:w-48 lg:h-48 rounded-3xl overflow-hidden border-2 border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl">
                                    <Image
                                        src={venue.photoURL || venue.image || "/events/holi-edit.svg"}
                                        alt={venue.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                {venue.isVerified && (
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                                        <CheckCircle2 className="h-6 w-6 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 space-y-6">
                                {/* Type Badge & Genres */}
                                <div className="flex flex-wrap items-center gap-3">
                                    {venue.venueType && (
                                        <span className="px-4 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                                            {venue.venueType}
                                        </span>
                                    )}
                                    {venue.genres?.slice(0, 3).map((genre, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/70">
                                            {genre}
                                        </span>
                                    ))}
                                </div>

                                {/* Name */}
                                <div className="space-y-3">
                                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9]">
                                        {venue.name}
                                    </h1>

                                    {/* Location */}
                                    <div className="flex items-center gap-6 text-white/50 text-sm font-bold uppercase tracking-widest">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            {venue.address || `${venue.area}, ${venue.city || "India"}`}
                                        </div>
                                        {venue.openingHours && (
                                            <>
                                                <span className="h-1 w-1 rounded-full bg-white/20" />
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4" />
                                                    {venue.openingHours}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="flex gap-10 pt-4">
                                    <div className="text-center">
                                        <p className="text-3xl md:text-4xl font-black">{(stats.followersCount || 0).toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">Followers</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl md:text-4xl font-black">{upcomingEvents.length}</p>
                                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">Upcoming</p>
                                    </div>
                                    {venue.capacity && (
                                        <div className="text-center">
                                            <p className="text-3xl md:text-4xl font-black">{venue.capacity}</p>
                                            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">Capacity</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3 lg:pb-4">
                                <button className="px-10 py-4 bg-white text-black rounded-full text-xs font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                                    Follow
                                </button>
                                {venue.socialLinks?.instagram && (
                                    <a
                                        href={`https://instagram.com/${venue.socialLinks.instagram}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-10 py-4 bg-white/10 backdrop-blur-md text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10"
                                    >
                                        <Instagram className="w-4 h-4" />
                                        Instagram
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bio Section */}
            {(venue.bio || venue.description) && (
                <section className="py-16 border-t border-white/5">
                    <div className="max-w-4xl mx-auto px-6 sm:px-12 lg:px-24">
                        <p className="text-lg md:text-xl leading-relaxed text-white/70 font-medium">
                            {venue.bio || venue.description}
                        </p>
                    </div>
                </section>
            )}

            {/* Amenities */}
            {venue.amenities?.length > 0 && (
                <section className="pb-12">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="flex flex-wrap gap-3">
                            {venue.amenities.map((amenityId) => {
                                const Icon = AMENITY_ICONS[amenityId] || Award;
                                const label = AMENITY_LABELS[amenityId] || amenityId;
                                return (
                                    <div key={amenityId} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60">
                                        <Icon className="w-4 h-4" />
                                        {label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
                <section className="py-16 border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Upcoming Events</h2>
                                <p className="text-white/40 text-sm font-medium mt-2">What's happening next</p>
                            </div>
                            <Link href="/explore" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                                View All <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {upcomingEvents.slice(0, 6).map((event) => (
                                <Link key={event.id} href={`/event/${event.id}`} className="group">
                                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                        <Image
                                            src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                            alt={event.name}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                        <div className="absolute inset-x-0 bottom-0 p-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="px-3 py-1 bg-emerald-500 rounded-full text-[10px] font-black uppercase tracking-wider text-white">
                                                    {new Date(event.startDate || event.startAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-1 line-clamp-2">{event.name}</h3>
                                            <p className="text-white/50 text-sm font-medium">{event.hostName || event.host || "Host TBA"}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Videos Section */}
            {venue.videos?.length > 0 && (
                <section className="py-16 border-t border-white/5 bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Videos & Tours</h2>
                                <p className="text-white/40 text-sm font-medium mt-2">Experience the venue</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {venue.videos.map((video, idx) => (
                                <a key={idx} href={video.url} target="_blank" rel="noopener noreferrer" className="group">
                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-purple-600/20 flex items-center justify-center">
                                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            </div>
                                        </div>
                                        <span className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest text-white/80">
                                            {video.type}
                                        </span>
                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                                            <h4 className="text-sm font-bold text-white">{video.title}</h4>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Posts & Highlights - Using Shared ProfileClient */}
            <ProfileClient
                upcomingEvents={upcomingEvents}
                posts={posts}
                highlights={highlights}
                venue={venue}
            />

            {/* Photo Gallery */}
            {venue.photos?.length > 0 && (
                <section className="py-16 border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="mb-10">
                            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Gallery</h2>
                            <p className="text-white/40 text-sm font-medium mt-2">The atmosphere inside</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {venue.photos.slice(0, 8).map((photo, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 group">
                                    <Image
                                        src={photo}
                                        alt={`${venue.name} gallery`}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Contact Footer */}
            <section className="py-16 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {venue.phone && (
                            <a
                                href={`tel:${venue.phone}`}
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Phone className="w-4 h-4" /> {venue.phone}
                            </a>
                        )}
                        {venue.email && (
                            <a
                                href={`mailto:${venue.email}`}
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Mail className="w-4 h-4" /> Reservations
                            </a>
                        )}
                        {venue.socialLinks?.instagram && (
                            <a
                                href={`https://instagram.com/${venue.socialLinks.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Instagram className="w-4 h-4" /> Instagram
                            </a>
                        )}
                        {venue.website && (
                            <a
                                href={venue.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Globe className="w-4 h-4" /> Website
                            </a>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
