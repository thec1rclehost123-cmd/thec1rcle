"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, TrendingUp, Share2, User, Heart } from "lucide-react";
import ShimmerImage from "../ShimmerImage";

export default function HostCard({ host, onFollow, index }) {
    const nextEventDateLabel = host.nextEventDate
        ? new Date(host.nextEventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
        : null;

    const getGradient = (id) => {
        const palettes = [
            "from-[#F44A22]/25 to-[#0A0A0A]",
            "from-purple-600/20 to-[#0A0A0A]",
            "from-indigo-600/20 to-[#0A0A0A]",
            "from-rose-600/20 to-[#0A0A0A]",
        ];
        const i = id ? id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length : 0;
        return <div className={`absolute inset-0 bg-gradient-to-br ${palettes[i]}`} />;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: Math.min((index ?? 0) * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -4 }}
            className="group relative flex flex-col overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-[#F5F4F2] dark:bg-[#111111] transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        >
            {/* Media */}
            <Link href={`/host/${host.slug || host.id}`} className="relative aspect-[3/4] w-full overflow-hidden block">
                {host.cover || host.coverURL ? (
                    <ShimmerImage
                        src={host.cover || host.coverURL}
                        alt={host.name || host.displayName}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-60"
                    />
                ) : (
                    getGradient(host.id)
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                {/* Badges */}
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    {host.verified && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F44A22] text-white shadow ring-1 ring-white/20">
                            <BadgeCheck size={14} />
                        </div>
                    )}
                    {host.trending && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm shadow ring-1 ring-white/10">
                            <TrendingUp size={14} />
                        </div>
                    )}
                </div>

                {/* Center: avatar + identity */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6">
                    <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-white/25 group-hover:border-white/50 transition-all duration-500 shadow-xl mb-4 flex-shrink-0">
                        <ShimmerImage
                            src={host.photoURL || host.avatar || "/events/holi-edit.svg"}
                            alt={host.name || host.displayName}
                            fill
                            className="object-cover"
                        />
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-[#F44A22]/20 border border-[#F44A22]/30 text-[9px] font-black uppercase tracking-widest text-[#F44A22] mb-2">
                        {host.role ?? "Host"}
                    </span>

                    <h3 className="text-lg font-heading font-black uppercase tracking-tight text-white text-center leading-tight">
                        {host.name ?? host.displayName ?? 'Unnamed Host'}
                    </h3>
                    {host.neighborhood && (
                        <p className="mt-1 text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">{host.neighborhood}</p>
                    )}

                    {(host.genres || host.vibes || []).length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                            {(host.genres || host.vibes || []).slice(0, 3).map(g => (
                                <span key={g} className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white/55">
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </Link>

            {/* Stats */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-black/5 dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
                <div>
                    <p className="text-sm font-black text-black dark:text-white">{(host.followers ?? 0).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40">Followers</p>
                </div>
                <div className="text-center">
                    <p className="text-sm font-black text-black dark:text-white">{host.upcomingEventsCount ?? 0}</p>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40">Events</p>
                </div>
                {nextEventDateLabel && (
                    <div className="px-3 py-1.5 rounded-full bg-[#F44A22]/10 border border-[#F44A22]/20">
                        <span className="text-[9px] font-black text-[#F44A22] uppercase tracking-widest">NEXT: {nextEventDateLabel}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-4 flex items-center gap-3">
                <button
                    onClick={(e) => { e.preventDefault(); onFollow && onFollow(host.id); }}
                    className="flex-1 px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-80 active:scale-95 flex items-center justify-center gap-2 shadow"
                >
                    <Heart size={12} fill="currentColor" />
                    Follow
                </button>
                <button
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-all active:scale-90"
                    title="Share"
                >
                    <Share2 size={15} />
                </button>
                <Link
                    href={`/host/${host.slug || host.id}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-all active:scale-90"
                    title="View Profile"
                >
                    <User size={15} />
                </Link>
            </div>
        </motion.div>
    );
}

export function HostSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-[#F5F4F2] dark:bg-[#111111]">
            <div className="aspect-[3/4] bg-black/5 dark:bg-white/5 animate-pulse" />
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/[0.06] flex justify-between">
                <div className="space-y-1.5">
                    <div className="h-4 w-10 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                    <div className="h-2.5 w-16 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                </div>
                <div className="space-y-1.5">
                    <div className="h-4 w-8 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                    <div className="h-2.5 w-12 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                </div>
            </div>
            <div className="p-4 flex gap-3">
                <div className="flex-1 h-10 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                <div className="h-10 w-10 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                <div className="h-10 w-10 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
            </div>
        </div>
    );
}
