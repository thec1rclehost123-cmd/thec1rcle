import Link from "next/link";
import { motion } from "framer-motion";
import Skeleton from "../ui/Skeleton";
import ShimmerImage from "../ShimmerImage";

export function VenueCard({ venue, onFollow }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-orange/30 dark:hover:border-white/20 hover:shadow-2xl hover:shadow-orange/10 dark:hover:shadow-white/5"
        >
            <Link href={`/venues/${venue.slug}`} className="block">
                <div className="relative aspect-[4/5] overflow-hidden">
                    <ShimmerImage
                        src={venue.image}
                        alt={venue.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {venue.tablesAvailable && (
                        <div className="absolute top-4 right-4">
                            <span className="px-3 py-1 rounded-full bg-orange/90 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white shadow-lg ring-1 ring-white/20">
                                Tables Available
                            </span>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange dark:text-gold mb-1">
                                {venue.area}
                            </p>
                            <h3 className="text-xl font-heading font-black uppercase tracking-tight text-white leading-tight">
                                {venue.name}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                            {venue.followers.toLocaleString()} Followers
                        </p>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onFollow && onFollow(venue.id);
                            }}
                            className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white text-[10px] font-bold uppercase tracking-widest text-white hover:text-black transition-all border border-white/10"
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
            <Link href={`/hosts/${host.slug}`} className="block">
                <div className="relative aspect-[4/5] overflow-hidden p-8 flex flex-col items-center justify-center bg-black/40">
                    <div className="relative h-32 w-32 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-orange/50 transition-colors shadow-2xl">
                        <ShimmerImage
                            src={host.avatar}
                            alt={host.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    </div>

                    <div className="mt-6 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-bold uppercase tracking-widest text-white/60">
                                {host.role}
                            </span>
                            {host.verified && (
                                <span className="text-orange text-xs">●</span>
                            )}
                        </div>
                        <h3 className="text-2xl font-heading font-black uppercase tracking-tight text-white leading-tight">
                            {host.name}
                        </h3>
                        <p className="mt-2 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                            {host.upcomingEventsCount} Upcoming Events
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-black/60 backdrop-blur-md flex items-center justify-between border-t border-white/5">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                        {host.followers.toLocaleString()} Followers
                    </p>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onFollow && onFollow(host.id);
                        }}
                        className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white text-[10px] font-bold uppercase tracking-widest text-white hover:text-black transition-all border border-white/10"
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
        <div className="relative h-[420px] overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white/5">
            <Skeleton className="h-2/3 w-full rounded-none" />
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-3/4" />
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20 rounded-full" />
                </div>
            </div>
        </div>
    );
}
