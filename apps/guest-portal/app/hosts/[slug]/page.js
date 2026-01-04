"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "../../../components/PageShell";
import EventCard from "../../../components/EventCard";
import { HostSkeleton } from "../../../components/hosts/HostCard";
import { BadgeCheck, Users, Calendar, MapPin, Grid, Play, Heart, MessageCircle } from "lucide-react";
import ShimmerImage from "../../../components/ShimmerImage";
import { useAuth } from "../../../components/providers/AuthProvider";
import { useToast } from "../../../components/providers/ToastProvider";

export default function HostProfilePage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const [host, setHost] = useState(null);
    const [events, setEvents] = useState([]);
    const [pastEvents, setPastEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [likedPosts, setLikedPosts] = useState(new Set());

    useEffect(() => {
        async function fetchHostData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/hosts/${slug}`);
                if (!res.ok) throw new Error("Host not found");
                const data = await res.json();
                setHost(data);

                // Fetch events
                const eventsRes = await fetch(`/api/events?host=${data.handle}`);
                const allEvents = await eventsRes.json();

                const now = new Date();
                const upcoming = allEvents.filter(e => new Date(e.startDate || e.date) >= now);
                const past = allEvents.filter(e => new Date(e.startDate || e.date) < now);

                setEvents(upcoming);
                setPastEvents(past);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchHostData();
    }, [slug]);

    const handleFollow = () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
                detail: { intent: 'FOLLOW_HOST', targetId: host.id }
            }));
            return;
        }
        toast({ type: "success", message: `Now following ${host.name}` });
    };

    const handleLike = (postId) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
                detail: { intent: 'LIKE_POST', targetId: postId }
            }));
            return;
        }
        setLikedPosts(prev => {
            const next = new Set(prev);
            if (next.has(postId)) next.delete(postId);
            else next.add(postId);
            return next;
        });
    };

    if (loading) return <ProfileSkeleton />;
    if (!host) return <div className="pt-40 text-center text-white">Curator not found</div>;

    return (
        <PageShell>
            <div className="relative min-h-screen bg-[#0A0A0A]">
                {/* Immersive Header */}
                <div className="relative h-[60vh] min-h-[500px] w-full overflow-hidden">
                    <ShimmerImage
                        src={host.cover || host.avatar}
                        alt={host.name}
                        fill
                        className="object-cover blur-2xl opacity-30 scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-black/40" />

                    <div className="absolute inset-0 flex items-end">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16">
                            <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="relative h-48 w-48 rounded-full border-4 border-[#0A0A0A] overflow-hidden shadow-2xl z-10"
                                >
                                    <img src={host.avatar} className="h-full w-full object-cover" alt={host.name} />
                                </motion.div>

                                <div className="flex-1 text-center md:text-left space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-center md:justify-start gap-3">
                                            <h1 className="text-4xl md:text-7xl font-heading font-black uppercase tracking-tighter text-white">
                                                {host.name}
                                            </h1>
                                            {host.verified && <BadgeCheck size={32} className="text-orange" />}
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white/50 text-[10px] font-black uppercase tracking-[0.3em]">
                                            <span className="flex items-center gap-2"><MapPin size={14} /> {host.location}</span>
                                            <span className="h-1 w-1 rounded-full bg-white/20" />
                                            <span className="flex items-center gap-2 text-orange">{host.role}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center md:justify-start gap-8">
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-white">{host.followers.toLocaleString()}</span>
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Followers</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-white">{events.length}</span>
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Upcoming</span>
                                        </div>
                                        <button
                                            onClick={handleFollow}
                                            className="px-10 py-3 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-glow ml-4"
                                        >
                                            Follow
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-24">

                    {/* Bio & Highlights */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                        <div className="lg:col-span-1 space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">Archives</h3>
                                <p className="text-white/70 text-base leading-relaxed font-medium">
                                    {host.bio}
                                </p>
                            </div>

                            <div className="p-8 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange mb-6">Curator Vibes</h4>
                                <div className="flex flex-wrap gap-2">
                                    {host.vibes?.map(vibe => (
                                        <span key={vibe} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white/60">
                                            {vibe}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Visual Feed */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-heading font-black uppercase tracking-tight text-white flex items-center gap-3">
                                    <Play size={24} className="text-orange" />
                                    Highlights
                                </h2>
                                <span className="h-px flex-1 bg-white/5 ml-6" />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ y: -5 }}
                                        className="relative aspect-[3/4] rounded-[24px] overflow-hidden group bg-white/5 border border-white/5"
                                    >
                                        <ShimmerImage
                                            src={host.cover || host.avatar}
                                            alt="Highlight"
                                            fill
                                            className="object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all">
                                            <button
                                                onClick={() => handleLike(`post-${i}`)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border ${likedPosts.has(`post-${i}`) ? 'bg-orange/20 border-orange text-orange' : 'bg-white/10 border-white/20 text-white'}`}
                                            >
                                                <Heart size={14} fill={likedPosts.has(`post-${i}`) ? "currentColor" : "none"} />
                                                <span className="text-[10px] font-bold">1.2k</span>
                                            </button>
                                            <div className="text-white/60"><MessageCircle size={18} /></div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    <section className="space-y-12">
                        <div className="flex items-center justify-between">
                            <h2 className="text-3xl font-heading font-black uppercase tracking-tight text-white">Upcoming Sets & Events</h2>
                            <span className="h-px flex-1 bg-white/5 ml-8" />
                        </div>

                        {events.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {events.map((event, idx) => (
                                    <EventCard key={event.id} event={event} index={idx} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 rounded-[40px] border border-dashed border-white/10 text-center">
                                <p className="text-white/30 uppercase tracking-[0.3em] text-xs font-black">No upcoming transmissions scheduled</p>
                            </div>
                        )}
                    </section>

                    {/* Past Archives */}
                    {pastEvents.length > 0 && (
                        <section className="space-y-12 opacity-60">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-heading font-black uppercase tracking-tight text-white/50">Past Archives</h2>
                                <span className="h-px flex-1 bg-white/5 ml-8" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {pastEvents.map(event => (
                                    <div key={event.id} className="relative aspect-video rounded-2xl overflow-hidden hover:opacity-100 grayscale hover:grayscale-0 transition-all group">
                                        <img src={event.image} className="w-full h-full object-cover" alt={event.title} />
                                        <div className="absolute inset-0 bg-black/40" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </PageShell>
    );
}

function ProfileSkeleton() {
    return (
        <PageShell>
            <div className="min-h-screen bg-[#0A0A0A] animate-pulse">
                <div className="h-[60vh] bg-white/5" />
                <div className="max-w-7xl mx-auto px-4 py-20">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                        <div className="h-64 bg-white/5 rounded-[32px]" />
                        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <div key={i} className="aspect-[3/4] bg-white/5 rounded-[24px]" />)}
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
