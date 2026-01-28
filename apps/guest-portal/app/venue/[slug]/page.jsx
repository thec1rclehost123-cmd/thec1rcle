import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getVenueBySlug } from "../../../lib/server/venueStore";
import { getProfilePosts, getProfileHighlights, getProfileStats } from "../../../lib/server/partnerProfileStore";
import { listEvents } from "../../../lib/server/eventStore";
import { CheckCircle2, MapPin, Calendar, Heart, Eye, Instagram, Mail, Globe, Clock, Music, Phone, Play, ChevronRight, ChevronLeft, Users, Car, Wifi, UtensilsCrossed, Award, Building2, ShieldCheck, Star, Sparkles, Zap, Wine, Coffee, Utensils, Camera, X } from "lucide-react";
import ProfileClient from "./ProfileClient";
import CtaLayer from "../../../components/profile/CtaLayer";
import BookTableAction from "../../../components/venue/BookTableAction";

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

// Default offers for venues without specific offers
const DEFAULT_OFFERS = [
    {
        title: "Happy Hours",
        time: "5PM - 8PM DAILY",
        tag: "DRINKS",
        gradient: "from-[#F44A22] to-[#CC3311]"
    },
    {
        title: "Weekend Brunch",
        time: "SAT - SUN | 11AM - 3PM",
        tag: "FOOD & DRINKS",
        gradient: "from-[#FF6B4A] to-[#F44A22]"
    },
    {
        title: "Live Music Nights",
        time: "FRI - SAT | 9PM ONWARDS",
        tag: "ENTERTAINMENT",
        gradient: "from-[#F44A22] via-[#FF6B4A] to-[#CC3311]"
    }
];

// Default house rules
const DEFAULT_RULES = [
    "Valid ID required for entry",
    "Dress code strictly enforced",
    "Management reserves right of admission",
    "No outside food or beverages"
];

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

    // Robust event filtering
    const venueEvents = allEvents.filter(e => {
        if (e.venueId && e.venueId === venue.id) return true;
        if (e.venue && venue.name && e.venue.toLowerCase() === venue.name.toLowerCase()) return true;
        return false;
    });

    const now = new Date();
    const upcomingEvents = venueEvents.filter(e => new Date(e.startDate || e.startAt) > now)
        .sort((a, b) => new Date(a.startDate || a.startAt) - new Date(b.startDate || b.startAt));

    // Get venue offers or use defaults
    const offers = venue.offers?.length > 0 ? venue.offers : DEFAULT_OFFERS;
    const rules = venue.rules?.length > 0 ? venue.rules : DEFAULT_RULES;

    // Get venue video if available
    const venueVideo = venue.videoURL || venue.coverVideoURL || null;

    // Get gallery photos and videos with proper fallbacks
    const galleryPhotos = venue.photos?.filter(p => p && !p.includes('.svg')) || [];
    const galleryVideos = venue.videos || [];
    const hasGallery = galleryPhotos.length > 0 || galleryVideos.length > 0;

    return (
        <main className="min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white selection:bg-orange/40 selection:text-white font-body overflow-x-hidden transition-colors duration-300">
            {/* 1. HERO SECTION - Cinematic Full Screen with Video Support */}
            <section className="relative h-[100svh] w-full overflow-hidden">
                {/* Video or Image Background with Parallax */}
                <div className="absolute inset-0 z-0">
                    {venueVideo ? (
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover scale-110"
                        >
                            <source src={venueVideo} type="video/mp4" />
                        </video>
                    ) : (
                        <Image
                            src={venue.coverURL || venue.image || "/events/neon-nights.jpg"}
                            alt={venue.name}
                            fill
                            priority
                            className="object-cover scale-110 animate-slow-zoom"
                        />
                    )}
                    {/* Cinematic Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0A0A0A] via-white/30 dark:via-[#0A0A0A]/30 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-white/50 dark:from-[#0A0A0A]/50 via-transparent to-white/50 dark:to-[#0A0A0A]/50" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,white_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,#0A0A0A_100%)] opacity-70" />

                    {/* Animated Noise Texture */}
                    <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />
                </div>

                {/* Floating Gradient Orbs - Gen-Z Aesthetic */}
                <div className="absolute top-20 right-[10%] w-72 h-72 bg-[#F44A22]/20 rounded-full blur-[100px] animate-pulse opacity-60" />
                <div className="absolute bottom-32 left-[5%] w-96 h-96 bg-[#FF6B4A]/15 rounded-full blur-[120px] animate-pulse delay-1000 opacity-50" />
                <div className="absolute top-1/2 right-[20%] w-48 h-48 bg-[#F44A22]/10 rounded-full blur-[80px] animate-bounce-slow opacity-40" />

                {/* Inspiration Image 0: Diagonal "Tour" Bands */}
                <div className="absolute inset-0 z-1 pointer-events-none overflow-hidden flex items-center justify-center">
                    <div className="absolute h-16 w-[150%] bg-[#F44A22] transform -rotate-12 flex items-center justify-center opacity-80 shadow-2xl">
                        <div className="flex gap-16 whitespace-nowrap animate-marquee">
                            {[1, 2, 3, 4, 5].map(i => (
                                <span key={i} className="text-white text-xs font-black uppercase tracking-[0.5em]">{venue.name} TOUR • LIVE IN {venue.city || 'YOUR CITY'} • </span>
                            ))}
                        </div>
                    </div>
                    <div className="absolute h-16 w-[150%] bg-black transform rotate-12 flex items-center justify-center opacity-90 shadow-2xl translate-y-24">
                        <div className="flex gap-16 whitespace-nowrap animate-marquee-reverse">
                            {[1, 2, 3, 4, 5].map(i => (
                                <span key={i} className="text-white text-xs font-black uppercase tracking-[0.5em]">EXCLUSIVE EXPERIENCE • NO LIMITS • SECURE TICKETS • </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Navigation Header */}
                <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center">
                    <Link
                        href="/hosts"
                        className="w-12 h-12 bg-black/5 dark:bg-white/5 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 hover:scale-105 transition-all duration-300 group"
                    >
                        <ChevronLeft className="h-5 w-5 text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white transition-colors" />
                    </Link>

                    {venue.photoURL && (
                        <div className="absolute left-1/2 -translate-x-1/2 bg-black/5 dark:bg-white/5 backdrop-blur-2xl p-2 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl">
                            <Image src={venue.photoURL} width={48} height={48} alt="Logo" className="rounded-xl" />
                        </div>
                    )}

                    <BookTableAction venue={venue} />
                </div>

                {/* Hero Content */}
                <div className="relative z-10 h-full flex flex-col justify-end pb-24 md:pb-32 px-6 sm:px-12 lg:px-24">
                    {/* Venue Category & Social Proof Badges */}
                    <div className="flex flex-wrap items-center gap-3 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full shadow-lg">
                            <Sparkles className="h-3.5 w-3.5 text-[#F44A22]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/70 dark:text-white/70">
                                {venue.venueType || "Premium Venue"}
                            </span>
                        </div>
                        {venue.verified && (
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F44A22]/10 backdrop-blur-xl border border-[#F44A22]/20 rounded-full shadow-lg">
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#F44A22]" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#F44A22]">Verified</span>
                            </div>
                        )}
                        {/* Live Social Proof Counter */}
                        {stats?.followers > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#F44A22]/10 to-[#FF6B4A]/10 backdrop-blur-xl border border-[#F44A22]/20 rounded-full shadow-lg animate-pulse">
                                <div className="w-2 h-2 bg-[#F44A22] rounded-full animate-ping" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#F44A22]">
                                    {stats.followers.toLocaleString()} Following
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Venue Name - Epic Typography */}
                    <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-heading font-black uppercase tracking-tighter leading-[0.85] mb-6 text-black dark:text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <span className="inline-block">{venue.name}</span>
                    </h1>

                    {/* Tagline if available */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        {venue.tagline && (
                            <p className="text-lg md:text-xl text-black/60 dark:text-white/60 font-medium max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                                "{venue.tagline}"
                            </p>
                        )}

                        <div className="flex gap-4">
                            <button className="px-10 py-5 bg-[#F44A22] text-white rounded-full text-[11px] font-black uppercase tracking-[0.3em] shadow-glow hover:scale-105 transition-all">
                                Secure Your Access
                            </button>
                            <button className="px-10 py-5 bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 text-white rounded-full text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white/20 transition-all">
                                Explore Vibe
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scroll Indicator - Sleek Animation */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                    <div className="w-6 h-10 rounded-full border-2 border-black/20 dark:border-white/20 flex justify-center pt-2">
                        <div className="w-1.5 h-3 bg-[#F44A22] rounded-full animate-bounce" />
                    </div>
                </div>

                {/* Corner Accent Decorations */}
                <div className="absolute bottom-0 right-0 w-[40%] h-[30%] bg-gradient-to-tl from-[#F44A22]/20 via-transparent to-transparent blur-2xl pointer-events-none" />
                <div className="absolute top-0 left-0 w-[30%] h-[20%] bg-gradient-to-br from-[#FF6B4A]/10 via-transparent to-transparent blur-2xl pointer-events-none" />
            </section>

            {/* UPCOMING SHOWS - Inspired by Image 0 & 4 */}
            {upcomingEvents.length > 0 && (
                <section className="py-32 px-6 sm:px-12 lg:px-24 bg-black overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-20">
                        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#F44A22] rounded-full blur-[150px] animate-pulse" />
                        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600 rounded-full blur-[150px] animate-pulse delay-1000" />
                    </div>

                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] mb-4 block">Tour Dates & Events</span>
                                <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-none text-white italic">
                                    Upcoming<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F44A22] to-purple-500">Phenomena.</span>
                                </h2>
                            </div>
                            <button className="flex items-center gap-4 text-white hover:text-[#F44A22] transition-colors group">
                                <span className="text-[11px] font-black uppercase tracking-[0.3em]">View Full Calendar</span>
                                <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:border-[#F44A22] transition-all">
                                    <ChevronRight className="h-5 w-5" />
                                </div>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {upcomingEvents.slice(0, 4).map((event, idx) => (
                                <Link
                                    key={event.id}
                                    href={`/event/${event.id}`}
                                    className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden border border-white/10"
                                >
                                    <Image
                                        src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                        fill
                                        className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                        alt={event.name}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                                    {/* Date Badge */}
                                    <div className="absolute top-6 left-6 flex flex-col items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl">
                                        <span className="text-[10px] font-black text-white/60 uppercase">{new Date(event.startDate || event.startAt).toLocaleDateString(undefined, { month: 'short' })}</span>
                                        <span className="text-xl font-black text-white">{new Date(event.startDate || event.startAt).getDate()}</span>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="absolute top-6 right-6">
                                        <div className={`px-4 py-1.5 rounded-full backdrop-blur-md border ${event.status === 'SOLD_OUT' ? 'bg-red-500/20 border-red-500/30' : 'bg-[#F44A22]/20 border-[#F44A22]/30'}`}>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${event.status === 'SOLD_OUT' ? 'text-red-400' : 'text-[#F44A22]'}`}>
                                                {event.status === 'SOLD_OUT' ? 'Sold Out' : 'Available'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-8 left-8 right-8">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F44A22] mb-3">Live Show</p>
                                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-4 group-hover:text-[#F44A22] transition-colors">{event.name}</h4>
                                        <div className="h-px w-0 group-hover:w-full bg-gradient-to-r from-[#F44A22] to-transparent transition-all duration-500" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* 2. OFFERS SECTION - Premium Cards */}
            <section className="py-32 px-6 sm:px-12 lg:px-24 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-[#F44A22]/10 via-transparent to-transparent rounded-full blur-3xl" />

                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Section Header */}
                    <div className="flex items-center gap-4 mb-12">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
                        <div className="flex items-center gap-3 px-6 py-3 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-full">
                            <Zap className="h-4 w-4 text-[#F44A22]" />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-black/60 dark:text-white/60">Special Offers</span>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
                    </div>

                    {/* Offers Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {offers.map((offer, i) => (
                            <div
                                key={i}
                                className="group relative rounded-[2.5rem] overflow-hidden cursor-pointer transform hover:scale-[1.02] transition-all duration-500"
                            >
                                {/* Gradient Background */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${offer.gradient || 'from-[#F44A22] to-[#CC3311]'} opacity-90`} />

                                {/* Glass Overlay */}
                                <div className="absolute inset-0 bg-white/[0.02]" />

                                {/* Animated Border */}
                                <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 group-hover:border-white/20 transition-colors" />

                                {/* Shine Effect */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-white/10 via-transparent to-transparent transition-opacity duration-700" />

                                {/* Content */}
                                <div className="relative p-10 h-full min-h-[320px] flex flex-col justify-between">
                                    {/* Tag */}
                                    <div className="self-start">
                                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-xl rounded-full border border-white/10">
                                            <Star className="h-3 w-3 text-white" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">{offer.tag || 'SPECIAL'}</span>
                                        </span>
                                    </div>

                                    {/* Title & Time */}
                                    <div className="space-y-4">
                                        <h3 className="text-3xl font-heading font-black uppercase tracking-tight text-white leading-none">
                                            {offer.title}
                                        </h3>
                                        <p className="text-sm font-bold text-white/60 uppercase tracking-widest">
                                            {offer.time}
                                        </p>
                                    </div>

                                    {/* Decorative Element */}
                                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-tl-[100px] transform translate-x-8 translate-y-8 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3. MENU DISCOVERY SECTION - Curated Selection */}
            <section className="py-32 px-6 sm:px-12 lg:px-24 relative overflow-hidden bg-white dark:bg-[#0A0A0A]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                        {/* Text Content */}
                        <div className="space-y-12 order-2 lg:order-1">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-px bg-[#F44A22]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22]">Curated Taste</span>
                                </div>

                                <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-[0.8] text-black dark:text-white">
                                    Taste the<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]">
                                        Extraordinary
                                    </span>
                                </h2>
                            </div>

                            <div className="space-y-8">
                                <p className="text-xl text-black/50 dark:text-white/50 leading-relaxed max-w-lg font-medium">
                                    Our menu isn't just about food and drinks; it's a sensory journey designed by award-winning mixologists and chefs.
                                </p>

                                <div className="grid grid-cols-2 gap-8 py-8 border-y border-black/5 dark:border-white/5">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#F44A22]">Signature</p>
                                        <p className="text-sm font-bold text-black/70 dark:text-white/70 italic">"The Liquid Gold" Martini</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#F44A22]">Chef's Pick</p>
                                        <p className="text-sm font-bold text-black/70 dark:text-white/70 italic">Truffle Infused Burrata</p>
                                    </div>
                                </div>

                                <Link
                                    href={`/venue/${slug}/menu`}
                                    className="group relative inline-flex items-center gap-6 px-10 py-6 bg-black dark:bg-white rounded-2xl overflow-hidden shadow-2xl transition-transform hover:-translate-y-1"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <Wine className="h-5 w-5 relative z-10 text-[#F44A22] group-hover:text-white transition-colors" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.3em] relative z-10 text-white dark:text-black group-hover:text-white transition-colors">Digital Menu</span>
                                    <ChevronRight className="h-4 w-4 relative z-10 text-white/50 group-hover:text-white transition-all group-hover:translate-x-1" />
                                </Link>
                            </div>
                        </div>

                        {/* Visual Experience Grid */}
                        <div className="relative order-1 lg:order-2">
                            {/* Decorative Orbs */}
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#F44A22]/10 rounded-full blur-[80px] animate-pulse" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#FF6B4A]/10 rounded-full blur-[80px] animate-pulse delay-700" />

                            {/* Offset Grid */}
                            <div className="relative grid grid-cols-12 gap-4">
                                <div className="col-span-12 md:col-span-7 space-y-4">
                                    <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl transform rotate-1 group">
                                        <Image
                                            src="https://images.unsplash.com/photo-1544145945-f904253db0ad?q=80&w=800"
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform duration-1000"
                                            alt="Signature"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                        <div className="absolute bottom-6 left-6">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-2">Signature</p>
                                            <h4 className="text-xl font-heading font-black text-white uppercase tracking-tight leading-none">The Artisan</h4>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-12 md:col-span-5 space-y-4 pt-12 md:pt-24">
                                    <div className="aspect-square rounded-[2rem] overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl transform -rotate-1 group">
                                        <Image
                                            src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=600"
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform duration-1000"
                                            alt="Cocktails"
                                        />
                                        <div className="absolute inset-0 bg-[#F44A22]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="aspect-[3/4] rounded-[2rem] overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl group">
                                        <Image
                                            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=600"
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform duration-1000"
                                            alt="Apps"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                                            <p className="text-sm font-black text-white uppercase tracking-widest">Shareables</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. AMBIENCE GALLERY - Stories & Premium Masonry */}
            <section className="py-32 bg-gradient-to-b from-transparent via-black/[0.02] dark:via-white/[0.02] to-transparent relative overflow-hidden">
                {/* Floating Background Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#F44A22]/10 via-transparent to-transparent rounded-full blur-[120px] opacity-60" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#FF6B4A]/10 via-transparent to-transparent rounded-full blur-[100px] opacity-40" />

                <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 space-y-16 relative z-10">
                    {/* Section Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-20">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] mb-4 block">Visual Experience</span>
                            <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-none text-black dark:text-white">
                                The<br />
                                <span className="italic">Atmosphere.</span>
                            </h2>
                        </div>
                        <div className="flex gap-4">
                            <button className="px-8 py-4 bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-all">
                                Interior
                            </button>
                            <button className="px-8 py-4 bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-all">
                                Nightlife
                            </button>
                        </div>
                    </div>

                    {/* Premium Gallery Grid - Bento Style with Video Support */}
                    {hasGallery ? (
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-6 auto-rows-[200px] md:auto-rows-[160px]">
                            {/* Large Featured Video/Image - Main Showcase */}
                            <div className="col-span-2 md:col-span-8 row-span-3 md:row-span-4 relative rounded-[3rem] overflow-hidden group border border-black/5 dark:border-white/5 shadow-2xl">
                                {galleryVideos.length > 0 ? (
                                    <>
                                        <video
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                        >
                                            <source src={galleryVideos[0]} type="video/mp4" />
                                        </video>
                                        <div className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 bg-black/30 backdrop-blur-xl rounded-full border border-white/10">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Atmosphere</span>
                                        </div>
                                    </>
                                ) : (
                                    <Image
                                        src={galleryPhotos[0] || venue.coverURL || venue.image}
                                        fill
                                        className="object-cover transition-transform duration-1000 group-hover:scale-105"
                                        alt="Featured"
                                    />
                                )}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
                                <div className="absolute bottom-12 left-12 right-12 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">The Main Stage</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30">
                                            <Camera className="h-5 w-5 text-white" />
                                        </div>
                                        <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Full Cinematic View</span>
                                    </div>
                                </div>
                            </div>

                            {/* Staggered Vertical Cards */}
                            <div className="col-span-1 md:col-span-4 row-span-2 relative rounded-[2rem] overflow-hidden group border border-black/5 dark:border-white/5 shadow-xl hover:rotate-1 transition-transform duration-500">
                                <Image
                                    src={galleryPhotos[1] || venue.coverURL || venue.image}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                    alt="Gallery"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-4 row-span-2 md:translate-y-12 relative rounded-[2rem] overflow-hidden group border border-black/5 dark:border-white/5 shadow-xl hover:-rotate-1 transition-transform duration-500">
                                <Image
                                    src={galleryPhotos[2] || venue.coverURL || venue.image}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                    alt="Gallery"
                                />
                            </div>

                            {/* Small Accent Cards with Floating Effect */}
                            <div className="col-span-1 md:col-span-3 row-span-2 relative rounded-[2rem] overflow-hidden group border border-black/5 dark:border-white/5 shadow-xl transition-all duration-500">
                                <Image
                                    src={galleryPhotos[3] || venue.coverURL || venue.image}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                    alt="Gallery"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-3 row-span-2 md:translate-y-8 relative rounded-[2rem] overflow-hidden group border border-black/5 dark:border-white/5 shadow-xl transition-all duration-500">
                                <Image
                                    src={galleryPhotos[4] || venue.coverURL || venue.image}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                    alt="Gallery"
                                />
                            </div>
                        </div>
                    ) : (
                        /* Fallback: Premium placeholder grid with venue cover + events */
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Main venue hero card */}
                            <div className="col-span-2 row-span-2 aspect-square relative rounded-[2rem] overflow-hidden group border border-black/5 dark:border-white/5 shadow-xl">
                                <Image
                                    src={venue.coverURL || venue.image || "/events/neon-nights.jpg"}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                                    alt={venue.name}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-6 left-6 right-6">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-xl rounded-full text-[10px] font-black uppercase tracking-widest text-white">
                                        <Sparkles className="h-3 w-3" />
                                        {venue.name}
                                    </span>
                                </div>
                            </div>
                            {/* Event posters as gallery items */}
                            {upcomingEvents.slice(0, 4).map((event, idx) => (
                                <Link key={event.id} href={`/event/${event.id}`} className="relative aspect-[3/4] rounded-2xl overflow-hidden group border border-black/5 dark:border-white/5 hover:border-[#F44A22]/30 transition-colors">
                                    <Image
                                        src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        alt={event.name}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="h-3 w-3 text-[#F44A22]" />
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                                                {new Date(event.startDate || event.startAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <p className="text-xs font-bold text-white line-clamp-2">{event.name}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* PASSES & ENTRY - Inspired by Image 1 */}
            <section className="py-32 px-6 sm:px-12 lg:px-24 bg-[#0A0A0A] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-l from-green-500/10 via-transparent to-transparent blur-[120px]" />

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex flex-col items-center text-center mb-20">
                        <h2 className="text-6xl md:text-9xl font-heading font-black uppercase tracking-tighter leading-none text-white">
                            Purchase<br />
                            <span className="text-[#A3E635]">Access.</span>
                        </h2>
                        <div className="mt-8 flex gap-4">
                            <div className="px-4 py-2 bg-[#A3E635]/10 border border-[#A3E635]/20 rounded-lg">
                                <span className="text-[10px] font-black text-[#A3E635] uppercase tracking-widest">Instant Booking</span>
                            </div>
                            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Digital Passes</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Ticket Card 1 */}
                        <div className="group relative bg-[#161616] rounded-3xl overflow-hidden border border-white/5 hover:border-[#A3E635]/30 transition-all flex h-48 shadow-2xl">
                            <div className="flex-1 p-8 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">General Entry</h3>
                                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Single Entry Pass</p>
                                </div>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-black text-[#A3E635]">₹1,000</p>
                                    <button className="px-6 py-2.5 bg-[#A3E635] text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform">Purchase</button>
                                </div>
                            </div>
                            {/* Perforation Line */}
                            <div className="w-12 h-full bg-[#1A1A1A] border-l border-white/5 flex flex-col items-center justify-center gap-1.5 overflow-hidden">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full bg-[#0A0A0A] -mr-8" />
                                ))}
                                <div className="absolute right-4 transform rotate-90 text-[10px] font-black text-white/10 tracking-[0.5em] uppercase whitespace-nowrap">C1RCLE PASS</div>
                            </div>
                        </div>

                        {/* Ticket Card 2 - Featured */}
                        <div className="group relative bg-[#A3E635] rounded-3xl overflow-hidden border border-[#A3E635]/20 hover:shadow-[0_0_50px_rgba(163,230,53,0.2)] transition-all flex h-48 shadow-2xl">
                            <div className="flex-1 p-8 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="px-2 py-0.5 bg-black rounded text-[8px] font-black text-[#A3E635] uppercase">Best Value</div>
                                    </div>
                                    <h3 className="text-2xl font-black text-black uppercase tracking-tight">VIP Experience</h3>
                                    <p className="text-xs text-black/60 font-bold uppercase tracking-widest mt-1">Exclusive Lounge Access</p>
                                </div>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-black text-black">₹3,500</p>
                                    <button className="px-6 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform">Purchase</button>
                                </div>
                            </div>
                            {/* Perforation Line */}
                            <div className="w-12 h-full bg-black/10 flex flex-col items-center justify-center gap-1.5 overflow-hidden">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full bg-[#0A0A0A] -mr-8" />
                                ))}
                                <div className="absolute right-4 transform rotate-90 text-[10px] font-black text-black/20 tracking-[0.5em] uppercase whitespace-nowrap">VIP ACCESS</div>
                            </div>
                        </div>

                        {/* Ticket Card 3 */}
                        <div className="group relative bg-[#161616] rounded-3xl overflow-hidden border border-white/5 flex h-48 shadow-2xl">
                            <div className="flex-1 p-8 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Group Bundle</h3>
                                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Entry for 5 People</p>
                                </div>
                                <div className="flex items-end justify-between">
                                    <p className="text-3xl font-black text-[#A3E635]">₹4,500</p>
                                    <button className="px-6 py-2.5 bg-[#A3E635] text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform">Purchase</button>
                                </div>
                            </div>
                            <div className="w-12 h-full bg-[#1A1A1A] border-l border-white/5 flex flex-col items-center justify-center gap-1.5 overflow-hidden">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full bg-[#0A0A0A] -mr-8" />
                                ))}
                            </div>
                        </div>

                        {/* Custom Inquiry */}
                        <div className="group relative rounded-3xl overflow-hidden border-2 border-dashed border-white/10 flex items-center justify-center p-8 bg-white/[0.02] hover:border-[#A3E635]/50 transition-all cursor-pointer">
                            <div className="text-center">
                                <p className="text-sm font-black text-white uppercase tracking-[0.2em] mb-2 text-glow">Corporate & Bulk</p>
                                <p className="text-xs text-white/40 font-medium">Custom tailored packages for events and groups</p>
                                <div className="mt-4 inline-flex items-center gap-2 text-[#A3E635] text-[10px] font-black uppercase tracking-widest">
                                    Let's Talk <ChevronRight className="h-3 w-3" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. SPECIALTY & TIMINGS - The Venue Dashboard */}
            <section className="py-32 px-6 sm:px-12 lg:px-24 relative overflow-hidden bg-[#0A0A0A]">
                {/* Background Text Overlay - Epic Vibe */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] select-none">
                    <h2 className="text-[20vw] font-black uppercase tracking-tighter leading-none whitespace-nowrap">
                        {venue.name}
                    </h2>
                </div>

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
                        {/* Main Identity Box */}
                        <div className="lg:col-span-12 mb-8">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 py-8 border-b border-white/10">
                                <div className="max-w-3xl">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F44A22] to-[#FF6B4A] flex items-center justify-center p-0.5">
                                            <div className="w-full h-full rounded-full bg-[#0A0A0A] flex items-center justify-center">
                                                <Star className="h-5 w-5 text-[#F44A22]" />
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#F44A22]">The Signature Experience</span>
                                    </div>
                                    <h2 className="text-4xl md:text-7xl font-heading font-black uppercase tracking-tight text-white leading-[0.9]">
                                        What defines<br />
                                        <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">Our Aura.</span>
                                    </h2>
                                </div>
                                <div className="hidden lg:block">
                                    <div className="flex -space-x-4">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="w-16 h-16 rounded-full border-4 border-[#0A0A0A] bg-white/5 flex items-center justify-center overflow-hidden grayscale hover:grayscale-0 transition-all duration-500">
                                                <Image src={`https://i.pravatar.cc/100?u=${i + 10}`} width={64} height={64} alt="Avatar" />
                                            </div>
                                        ))}
                                        <div className="w-16 h-16 rounded-full border-4 border-[#0A0A0A] bg-[#F44A22] flex items-center justify-center">
                                            <span className="text-xs font-black text-white">+2k</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-4 text-right">Trusted by Thousands</p>
                                </div>
                            </div>
                        </div>

                        {/* Bento Stats & Specialty */}
                        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Specialty Card */}
                            <div className="md:col-span-2 p-10 md:p-14 rounded-[3rem] bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#F44A22]/5 blur-[80px] group-hover:bg-[#F44A22]/10 transition-colors" />
                                <div className="relative z-10 space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22]">Our Specialty</h3>
                                    <p className="text-2xl md:text-4xl font-medium text-white/90 leading-tight">
                                        {venue.specialty || venue.description || "A premium destination crafted for extraordinary experiences. Where every detail is designed to exceed expectations."}
                                    </p>
                                </div>
                            </div>

                            {/* Stat 1 */}
                            <div className="p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col justify-between min-h-[240px]">
                                <Award className="h-10 w-10 text-[#F44A22]" />
                                <div>
                                    <p className="text-4xl font-heading font-black text-white">{upcomingEvents.length}+</p>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mt-2">Curated Events / Month</p>
                                </div>
                            </div>

                            {/* Stat 2 */}
                            <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-[#F44A22]/20 to-transparent border border-[#F44A22]/10 flex flex-col justify-between min-h-[240px]">
                                <Heart className="h-10 w-10 text-[#F44A22]" />
                                <div>
                                    <p className="text-4xl font-heading font-black text-white">{stats?.followers?.toLocaleString() || '2.4K'}</p>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mt-2">Loyal Community</p>
                                </div>
                            </div>
                        </div>

                        {/* Operating Clock */}
                        <div className="lg:col-span-4 h-full">
                            <div className="h-full p-10 rounded-[3rem] bg-gradient-to-b from-[#F44A22] to-[#CC3311] relative overflow-hidden group">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl transform -translate-y-12 translate-x-12" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-3xl transform translate-y-12 -translate-x-12" />

                                <div className="relative z-10 h-full flex flex-col justify-between gap-12">
                                    <div className="flex items-center justify-between">
                                        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center">
                                            <Clock className="h-7 w-7 text-white" />
                                        </div>
                                        <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/60">Operating Hours</h3>
                                        <div className="space-y-4">
                                            {venue.timings ? (
                                                Object.entries(venue.timings).slice(0, 5).map(([day, time], idx) => (
                                                    <div key={day} className="flex justify-between items-center text-sm py-2 border-b border-white/10 last:border-0">
                                                        <span className="font-bold text-white/60 capitalize">{day.slice(0, 3)}</span>
                                                        <span className="font-black text-white">{time}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-2">
                                                    <p className="text-4xl font-heading font-black text-white">12:00 PM</p>
                                                    <p className="text-xl font-medium text-white/60">TILL 2:00 AM</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-4">OPEN ALL WEEK</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button className="w-full py-5 bg-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-black hover:scale-[0.98] transition-transform shadow-xl">
                                        Plan Visit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. GUIDELINES - For the Elite */}
            <section className="py-32 px-6 sm:px-12 lg:px-24 bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 md:gap-24 items-start">
                        {/* House Rules & Amenities */}
                        <div className="lg:col-span-12 mb-16">
                            <h3 className="text-6xl md:text-9xl font-heading font-black uppercase tracking-tighter text-black/5 dark:text-white/5 mb-[-2rem] md:mb-[-4rem]">The Rules</h3>
                        </div>

                        <div className="lg:col-span-7 space-y-12">
                            <div className="space-y-4">
                                {rules.map((rule, idx) => (
                                    <div key={idx} className="flex items-center gap-6 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 hover:border-[#F44A22]/30 transition-all group">
                                        <span className="text-3xl font-heading font-black text-black/10 dark:text-white/10 group-hover:text-[#F44A22] transition-colors">0{idx + 1}</span>
                                        <p className="text-lg font-bold text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white transition-colors">{rule}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Amenities Tag Cloud */}
                            {venue.amenities && venue.amenities.length > 0 && (
                                <div className="pt-8">
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] mb-8 text-center md:text-left">Beyond the Basics</p>
                                    <div className="flex flex-wrap gap-4">
                                        {venue.amenities.map((amenity, idx) => {
                                            const IconComponent = AMENITY_ICONS[amenity] || Building2;
                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex-1 min-w-[120px] hover:scale-105 transition-transform">
                                                    <IconComponent className="h-6 w-6 text-[#F44A22]" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-black/40 dark:text-white/40 text-center">{AMENITY_LABELS[amenity] || amenity}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Exclusive Dress Code Card */}
                        <div className="lg:col-span-5 sticky top-32">
                            <div className="relative p-12 rounded-[3.5rem] bg-black text-white overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#F44A22] via-transparent to-transparent opacity-40 blur-[40px]" />

                                <div className="relative z-10 space-y-12">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                            <ShieldCheck className="h-6 w-6 text-[#F44A22]" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">Dress Etiquette</span>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-5xl md:text-7xl font-heading font-black uppercase tracking-tighter leading-none">
                                            {venue.dressCode || "Vogue Chic"}
                                        </h4>
                                        <p className="text-sm text-[#F44A22] font-black uppercase tracking-widest flex items-center gap-2">
                                            Strictly Enforced <Sparkles className="h-3 w-3" />
                                        </p>
                                    </div>

                                    <div className="pt-8 border-t border-white/10">
                                        <p className="text-sm text-white/40 leading-relaxed font-medium">
                                            The management reserves the right of admission based on dress code compliance. Ensure your attire matches the venue vibe.
                                        </p>
                                    </div>
                                </div>

                                <div className="absolute bottom-[-10%] right-[-10%] opacity-10">
                                    <Award className="w-64 h-64" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. UPCOMING EVENTS - The Lineup */}
            {upcomingEvents.length > 0 && (
                <section className="py-40 bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        {/* Section Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-[#F44A22] animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22]">Direct from {venue.name}</span>
                                </div>
                                <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter text-black dark:text-white leading-[0.8]">
                                    Upcoming<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F44A22] via-[#FF6B4A] to-[#F44A22]">The Lineup</span>
                                </h2>
                            </div>
                            <Link
                                href={`/explore?venue=${venue.id}`}
                                className="group flex items-center gap-4 px-8 py-4 bg-black/5 dark:bg-white/5 hover:bg-[#F44A22] border border-black/10 dark:border-white/10 hover:border-[#F44A22] rounded-2xl transition-all duration-500"
                            >
                                <span className="text-[11px] font-black uppercase tracking-widest text-black/60 dark:text-white/60 group-hover:text-white">View Full Schedule</span>
                                <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {upcomingEvents.slice(0, 6).map((event, idx) => (
                                <Link
                                    key={event.id}
                                    href={`/event/${event.id}`}
                                    className="group relative h-[500px] rounded-[3rem] overflow-hidden shadow-2xl transition-all duration-700 hover:-translate-y-2"
                                >
                                    <Image
                                        src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                        fill
                                        className="object-cover transition-transform duration-[1.5s] group-hover:scale-110"
                                        alt={event.name}
                                    />

                                    {/* Cinematic Overlays */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0A0A0A]" />
                                    <div className="absolute inset-0 bg-[#F44A22]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    {/* Top Info */}
                                    <div className="absolute top-8 left-8 right-8 flex justify-between items-start">
                                        <div className="px-4 py-2 bg-white/10 backdrop-blur-2xl rounded-xl border border-white/10">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white">
                                                {new Date(event.startDate || event.startAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        {idx === 0 && (
                                            <div className="px-3 py-1 bg-[#F44A22] rounded-full shadow-lg shadow-[#F44A22]/40">
                                                <span className="text-[9px] font-black uppercase text-white tracking-widest animate-pulse">Hot Pick</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Info */}
                                    <div className="absolute inset-x-0 bottom-0 p-10 space-y-4">
                                        <div className="flex items-center gap-2 text-[#F44A22]">
                                            <Clock className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {new Date(event.startDate || event.startAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <h3 className="text-3xl font-heading font-black text-white uppercase tracking-tighter leading-none group-hover:text-[#F44A22] transition-colors duration-500">
                                            {event.name}
                                        </h3>
                                        <div className="pt-6 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Tickets Available</span>
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                                <ChevronRight className="h-5 w-5 text-black" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* 8. CONTACT & FOOTER - The Grand Finale */}
            <footer className="py-40 bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 md:gap-24 items-start">
                        {/* Branding & Socials */}
                        <div className="lg:col-span-4 space-y-12">
                            <div className="space-y-6">
                                <h3 className="text-4xl font-heading font-black uppercase tracking-tighter text-black dark:text-white leading-[0.8]">
                                    {venue.name}<br />
                                    <span className="text-[#F44A22] italic select-none">Experience.</span>
                                </h3>
                                <p className="text-sm text-black/40 dark:text-white/40 leading-relaxed font-medium">
                                    Redefining the nightlife experience with curated events, premium amenities, and an aura like no other.
                                </p>
                            </div>

                            <div className="flex gap-4">
                                {(venue.contact?.instagram || venue.socialLinks?.instagram) && (
                                    <a
                                        href={`https://instagram.com/${(venue.contact?.instagram || venue.socialLinks?.instagram).replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-16 h-16 rounded-[1.5rem] bg-black dark:bg-white flex items-center justify-center group hover:scale-110 transition-transform duration-500 shadow-2xl"
                                    >
                                        <Instagram className="h-6 w-6 text-white dark:text-black group-hover:text-[#F44A22] transition-colors" />
                                    </a>
                                )}
                                {venue.website && (
                                    <a
                                        href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-16 h-16 rounded-[1.5rem] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center group hover:scale-110 transition-transform duration-500"
                                    >
                                        <Globe className="h-6 w-6 text-black/60 dark:text-white/60 group-hover:text-[#F44A22] transition-colors" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Middle Spacer for Desktop */}
                        <div className="hidden lg:block lg:col-span-1 border-r border-black/5 dark:border-white/5 h-64" />

                        {/* Contact Details */}
                        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22]">Concierge</p>
                                <div className="space-y-8">
                                    {(venue.contact?.email || venue.email) && (
                                        <a href={`mailto:${venue.contact?.email || venue.email}`} className="block group">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-black/30 dark:text-white/30 mb-2">Connect</p>
                                            <p className="text-2xl font-heading font-black text-black/80 dark:text-white/80 group-hover:text-[#F44A22] transition-colors truncate">{venue.contact?.email || venue.email}</p>
                                        </a>
                                    )}
                                    {(venue.contact?.phone || venue.phone) && (
                                        <a href={`tel:${venue.contact?.phone || venue.phone}`} className="block group">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-black/30 dark:text-white/30 mb-2">Helpline</p>
                                            <p className="text-2xl font-heading font-black text-black/80 dark:text-white/80 group-hover:text-[#F44A22] transition-colors">{venue.contact?.phone || venue.phone}</p>
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22]">Destination</p>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.contact?.address || venue.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/30 dark:text-white/30 mb-2">Location</p>
                                    <p className="text-sm font-bold text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white leading-relaxed transition-colors">
                                        {venue.contact?.address || venue.address}
                                    </p>
                                </a>

                                <div className="pt-4">
                                    <BookTableAction venue={venue} variant="full" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Industrial Details & Credits */}
                    <div className="mt-40 pt-20 border-t border-black/5 dark:border-white/10 flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
                        <div className="space-y-6">
                            <p className="text-[200px] font-black uppercase tracking-tighter text-black/[0.02] dark:text-white/[0.02] leading-none select-none absolute left-0 bottom-0 pointer-events-none">
                                C1RCLE
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-black/20 dark:text-white/20">The Legal & Compliance</p>
                            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                                <div>
                                    <p className="text-[9px] font-bold text-black/15 dark:text-white/15 uppercase mb-1">GSTIN</p>
                                    <p className="text-[10px] font-mono text-black/30 dark:text-white/30">{venue.businessDetails?.gst || "27XXXXXXXXXXXXX"}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-black/15 dark:text-white/15 uppercase mb-1">FSSAI</p>
                                    <p className="text-[10px] font-mono text-black/30 dark:text-white/30">{venue.businessDetails?.fssai || "115XXXXXXXXXXX"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="text-sm font-black text-black dark:text-white uppercase tracking-widest mb-2">Developed for THE C1RCLE</p>
                            <p className="text-[10px] font-bold text-black/30 dark:text-white/30 uppercase tracking-[0.4em]">© 2026. All Rights Reserved.</p>
                        </div>
                    </div>
                </div>
            </footer>

        </main>
    );
}
