"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PageShell from "../../../components/PageShell";
import EventCard from "../../../components/EventCard";
import Skeleton from "../../../components/ui/Skeleton";

export default function VenueProfilePage() {
    const { slug } = useParams();
    const router = useRouter();
    const [venue, setVenue] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [likedPosts, setLikedPosts] = useState(new Set());

    useEffect(() => {
        async function fetchVenueData() {
            setLoading(true);
            try {
                // Fetch venue details
                const venueRes = await fetch(`/api/venues?slug=${slug}`);
                const venues = await venueRes.json();
                const venueData = venues.find(v => v.slug === slug);
                setVenue(venueData);

                // Fetch events for this venue
                if (venueData) {
                    const eventsRes = await fetch(`/api/events?limit=20`);
                    const allEvents = await eventsRes.json();
                    // Simple filter by name match since we don't have a reliable venue ID link yet
                    const venueEvents = allEvents.filter(e => e.venue?.toLowerCase() === venueData.name.toLowerCase() || e.location?.toLowerCase().includes(venueData.name.toLowerCase()));
                    setEvents(venueEvents);
                }
            } catch (err) {
                console.error("Failed to fetch venue data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchVenueData();
    }, [slug]);

    const handleFollow = () => {
        window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
            detail: { intent: 'FOLLOW_VENUE', targetId: venue.id }
        }));
    };

    const handleLike = (postId) => {
        if (!likedPosts.has(postId)) {
            setLikedPosts(new Set([...likedPosts, postId]));
            // Trigger auth gate if not logged in
            window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
                detail: { intent: 'LIKE_POST', targetId: postId }
            }));
        }
    };

    if (loading) return <VenueSkeleton />;
    if (!venue) return <div className="pt-40 text-center text-white">Venue not found</div>;

    return (
        <PageShell>
            {/* Immersive Banner Background */}
            <div className="absolute top-0 inset-x-0 h-[600px] overflow-hidden -z-10">
                <img
                    src={venue.image}
                    alt={venue.name}
                    className="w-full h-full object-cover blur-3xl opacity-20 scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0A]/80 to-[#0A0A0A]" />
            </div>

            <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-6 max-w-2xl">
                        <div className="space-y-2">
                            <p className="text-orange font-bold uppercase tracking-[0.3em] text-xs">
                                {venue.area}
                            </p>
                            <h1 className="text-5xl md:text-7xl font-heading font-black uppercase tracking-tighter text-white">
                                {venue.name}
                            </h1>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {venue.tags?.map(tag => (
                                <span key={tag} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center gap-8 pt-4">
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-white">{venue.followers.toLocaleString()}</span>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Followers</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleFollow}
                                    className="px-8 py-3 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-glow"
                                >
                                    Follow
                                </button>
                                <button className="px-8 py-3 rounded-full bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
                                    Book Table
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                    {/* Left Column: Events & Feed */}
                    <div className="lg:col-span-2 space-y-20">
                        {/* Upcoming Events */}
                        <section className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-heading font-black uppercase tracking-tight text-white">Upcoming Events</h2>
                                <span className="h-px flex-1 bg-white/10 ml-6" />
                            </div>

                            {events.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {events.map(event => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 px-8 rounded-3xl bg-white/5 border border-white/10 text-center">
                                    <p className="text-white/40 uppercase tracking-widest text-xs font-bold">No upcoming events scheduled yet</p>
                                </div>
                            )}
                        </section>

                        {/* Posts & Highlights */}
                        <section className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-heading font-black uppercase tracking-tight text-white">Highlights & Feed</h2>
                                <span className="h-px flex-1 bg-white/10 ml-6" />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ scale: 1.02 }}
                                        className="relative aspect-square rounded-2xl overflow-hidden group border border-white/10"
                                    >
                                        <img
                                            src={venue.image} // Placeholder for post images
                                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <button
                                            onClick={() => handleLike(`post-${i}`)}
                                            className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform hover:bg-orange"
                                        >
                                            <svg className="w-4 h-4" fill={likedPosts.has(`post-${i}`) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Info & Rules */}
                    <div className="space-y-12">
                        <div className="p-8 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">About Venue</h3>
                                <p className="text-white/80 text-sm leading-relaxed">
                                    {venue.description}
                                </p>
                            </div>

                            <div className="space-y-6 pt-8 border-t border-white/10">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Dress Code</h4>
                                    <p className="text-white text-sm font-bold uppercase tracking-wide">{venue.dressCode}</p>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Entry Rules</h4>
                                    <ul className="space-y-2">
                                        {venue.rules?.map((rule, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-xs text-white/60">
                                                <span className="text-orange mt-0.5">•</span>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Mini Map / Location placeholder */}
                        <div className="aspect-video rounded-[32px] bg-white/5 border border-white/10 overflow-hidden relative group">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Open in Maps</p>
                                    <p className="text-white text-xs font-bold">{venue.area}, Pune</p>
                                </div>
                            </div>
                            <div className="absolute inset-0 bg-orange/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    );
}

function VenueSkeleton() {
    return (
        <PageShell>
            <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
                <div className="space-y-6">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-1/2" />
                    <Skeleton className="h-8 w-1/3" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                    <div className="lg:col-span-2 space-y-12">
                        <Skeleton className="h-[400px] w-full rounded-3xl" />
                    </div>
                    <div className="space-y-12">
                        <Skeleton className="h-[500px] w-full rounded-[32px]" />
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
