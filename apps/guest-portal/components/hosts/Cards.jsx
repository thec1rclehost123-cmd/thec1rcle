import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import Skeleton from "../ui/Skeleton";
import ShimmerImage from "../ShimmerImage";

export function VenueCard({ venue, onFollow }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-[32px] border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/30 dark:hover:border-white/20 hover:shadow-2xl hover:shadow-emerald-500/10 dark:hover:shadow-white/5"
        >
            <Link href={`/venue/${venue.slug}`} className="block">
                <div className="relative aspect-[4/5] overflow-hidden">
                    <ShimmerImage
                        src={venue.image || venue.coverURL}
                        alt={venue.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Badges */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                        {venue.isVerified && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white backdrop-blur-md shadow-lg ring-1 ring-white/20">
                                <BadgeCheck size={16} />
                            </div>
                        )}
                        {venue.venueType && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                                {venue.venueType}
                            </span>
                        )}
                        {venue.tablesAvailable && (
                            <span className="px-3 py-1 rounded-full bg-orange/90 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white shadow-lg ring-1 ring-white/20">
                                Tables Available
                            </span>
                        )}
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1">
                                {venue.neighborhood || venue.area || venue.city}
                            </p>
                            <h3 className="text-xl font-heading font-black uppercase tracking-tight text-white dark:text-white leading-tight">
                                {venue.name}
                            </h3>
                        </div>
                    </div>

                    {/* Genres */}
                    {(venue.genres || venue.vibes)?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            {(venue.genres || venue.vibes).slice(0, 3).map(genre => (
                                <span key={genre} className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest text-white/60">
                                    {genre}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
                        <p className="text-[10px] font-bold text-black/60 dark:text-white/60 uppercase tracking-widest">
                            {(venue.followers || 0).toLocaleString('en-IN')} Followers
                        </p>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onFollow && onFollow(venue.id);
                            }}
                            className="px-4 py-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black dark:hover:bg-white text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white hover:text-white dark:hover:text-black transition-all border border-black/5 dark:border-white/10"
                        >
                            Follow
                        </button>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

export function HostCard({ host, onFollow }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-orange/30 dark:hover:border-white/20 hover:shadow-2xl hover:shadow-orange/10 dark:hover:shadow-white/5"
        >
            <Link href={`/host/${host.slug}`} className="block">
                <div className="relative aspect-[4/5] overflow-hidden">
                    {/* Background Cover */}
                    {host.cover && (
                        <ShimmerImage
                            src={host.cover}
                            alt={host.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110 opacity-40"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/40" />

                    {/* Content */}
                    <div className="absolute inset-0 p-8 flex flex-col items-center justify-center">
                        <div className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-orange/50 transition-colors shadow-2xl">
                            <ShimmerImage
                                src={host.photoURL || host.avatar || "/events/holi-edit.svg"}
                                alt={host.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                        </div>

                        <div className="mt-5 text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="px-2.5 py-0.5 rounded-full bg-orange/20 border border-orange/30 text-[9px] font-bold uppercase tracking-widest text-orange">
                                    {host.role || "Host"}
                                </span>
                                {host.verified && (
                                    <span className="w-4 h-4 bg-orange rounded-full flex items-center justify-center">
                                        <span className="text-[8px] text-white">✓</span>
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-heading font-black uppercase tracking-tight text-white leading-tight">
                                {host.name}
                            </h3>
                            {host.city && (
                                <p className="mt-1 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                                    {host.city}
                                </p>
                            )}
                        </div>

                        {/* Genres */}
                        {(host.genres || host.vibes)?.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                                {(host.genres || host.vibes).slice(0, 3).map(genre => (
                                    <span key={genre} className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest text-white/60">
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-5 bg-black/60 backdrop-blur-md flex items-center justify-between border-t border-white/5">
                    <div className="flex gap-4">
                        <div>
                            <p className="text-sm font-bold text-white">{(host.followers || 0).toLocaleString('en-IN')}</p>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Followers</p>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{host.upcomingEventsCount || 0}</p>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Events</p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onFollow && onFollow(host.id);
                        }}
                        className="px-4 py-1.5 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-white/90 transition-all"
                    >
                        Follow
                    </button>
                </div>
            </Link>
        </motion.div>
    );
}

export function CardSkeleton() {
    return (
        <div className="relative h-[420px] overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            <Skeleton className="h-2/3 w-full rounded-none" />
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-3/4" />
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20 rounded-full" />
                </div>
            </div>
        </div>
    );
}
