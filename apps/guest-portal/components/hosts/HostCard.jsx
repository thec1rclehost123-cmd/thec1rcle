"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, TrendingUp, Share2, User, Calendar, Users, Heart } from "lucide-react";
import ShimmerImage from "../ShimmerImage";

export default function HostCard({ host, onFollow, index }) {
    const nextEventDateLabel = host.nextEventDate ? new Date(host.nextEventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;

    // Deterministic gradient if no cover is present
    const getGradient = (id) => {
        const colors = [
            "from-[#F44A22]/40 to-[#121212]",
            "from-purple-600/30 to-[#0A0A0A]",
            "from-emerald-600/30 to-[#0A0A0A]",
            "from-blue-600/30 to-[#0A0A0A]"
        ];
        const index = id ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length : 0;
        return (
            <div className={`relative h-full w-full bg-gradient-to-br ${colors[index]}`}>
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -8, scale: 1.01 }}
            className="group relative flex flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#121212] transition-all duration-500 hover:border-orange/40 hover:shadow-[0_0_40px_rgba(244,74,34,0.15)]"
        >
            {/* Always-on Aura Glow */}
            <div className="absolute -inset-4 z-0 bg-gradient-to-br from-orange/10 via-transparent to-purple-500/5 opacity-40 blur-3xl transition-all duration-700 group-hover:opacity-80 group-hover:scale-110" />

            {/* Media Section */}
            <Link href={`/hosts/${host.slug}`} className="relative aspect-[4/3] w-full overflow-hidden">
                {host.cover ? (
                    <ShimmerImage
                        src={host.cover}
                        alt={host.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1"
                    />
                ) : (
                    getGradient(host.id)
                )}

                {/* Overlays */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                {/* Badges */}
                <div className="absolute top-4 right-4 flex gap-2">
                    {host.verified && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange/90 text-white backdrop-blur-md shadow-lg ring-1 ring-white/20">
                            <BadgeCheck size={16} />
                        </div>
                    )}
                    {host.trending && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md shadow-lg ring-1 ring-white/10">
                            <TrendingUp size={16} />
                        </div>
                    )}
                </div>

                {/* Host Info Overlay (Bottom Left) */}
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-full border-2 border-white/20 overflow-hidden shadow-2xl">
                            <img src={host.avatar} className="h-full w-full object-cover" alt={host.name} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange mb-0.5">{host.role}</p>
                            <h3 className="text-xl font-heading font-black uppercase tracking-tight text-white leading-tight">{host.name}</h3>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {host.vibes?.slice(0, 3).map(vibe => (
                            <span key={vibe} className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest text-white/80">
                                {vibe}
                            </span>
                        ))}
                    </div>
                </div>
            </Link>

            {/* Stats Row */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
                <div className="flex flex-col">
                    <span className="text-sm font-black text-white">{host.followers.toLocaleString()}</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-white/40">Followers</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-sm font-black text-white">{host.upcomingEventsCount}</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-white/40">Events</span>
                </div>
                {nextEventDateLabel && (
                    <div className="px-3 py-1.5 rounded-full bg-orange/10 border border-orange/20">
                        <span className="text-[10px] font-black text-orange uppercase tracking-widest">NEXT: {nextEventDateLabel}</span>
                    </div>
                )}
            </div>

            {/* Action Row */}
            <div className="p-4 flex items-center justify-between gap-4">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onFollow && onFollow(host.id);
                    }}
                    className="flex-1 px-6 py-3 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/90 hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"
                >
                    <Heart size={14} fill="currentColor" />
                    Follow
                </button>

                <div className="flex gap-2">
                    <button
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                        title="Share Profile"
                    >
                        <Share2 size={18} />
                    </button>
                    <Link
                        href={`/hosts/${host.slug}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                        title="View Profile"
                    >
                        <User size={18} />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}

export function HostSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]">
            <div className="aspect-[4/3] bg-white/5 animate-pulse" />
            <div className="p-6 border-b border-white/5 flex justify-between">
                <div className="space-y-2"><div className="h-4 w-12 bg-white/10 rounded" /><div className="h-2 w-16 bg-white/10 rounded" /></div>
                <div className="space-y-2"><div className="h-4 w-8 bg-white/10 rounded" /><div className="h-2 w-12 bg-white/10 rounded" /></div>
                <div className="h-8 w-24 bg-white/10 rounded-full" />
            </div>
            <div className="p-4 flex gap-4">
                <div className="flex-1 h-12 bg-white/10 rounded-full animate-pulse" />
                <div className="h-11 w-11 bg-white/10 rounded-full" />
                <div className="h-11 w-11 bg-white/10 rounded-full" />
            </div>
        </div>
    );
}
