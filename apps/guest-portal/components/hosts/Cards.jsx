'use client';

import { memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BadgeCheck, Heart } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import ShimmerImage from '../ShimmerImage';

export const VenueCard = memo(function VenueCard({ venue, onFollow }) {
  const imageUrl = venue.image || venue.coverURL || venue.bannerImage || '/events/neon-nights.jpg';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-[#F5F4F2] dark:bg-[#111111] transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
    >
      <Link href={`/venue/${venue.slug || venue.id}`} className="block relative">
        {/* Image */}
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          <ShimmerImage
            src={imageUrl}
            alt={venue.name || venue.displayName}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

          {/* Badges */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-10">
            {venue.isVerified && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F44A22] text-white shadow ring-1 ring-white/20">
                <BadgeCheck size={14} />
              </div>
            )}
            {venue.venueType && (
              <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[9px] font-black uppercase tracking-widest text-white/70 border border-white/15">
                {venue.venueType}
              </span>
            )}
            {venue.tablesAvailable && (
              <span className="px-2.5 py-1 rounded-full bg-[#F44A22]/90 text-[9px] font-black uppercase tracking-widest text-white">
                Tables
              </span>
            )}
          </div>

          {/* Bottom overlay content */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/50 mb-1">
              {venue.neighborhood ?? venue.area ?? venue.city ?? 'Pune, IN'}
            </p>
            <h3 className="text-xl font-heading font-black uppercase tracking-tight text-white leading-tight">
              {venue.name ?? venue.displayName ?? 'Unnamed Venue'}
            </h3>
            {(venue.genres || venue.vibes)?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(venue.genres || venue.vibes).slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white/55"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats + Follow */}
        <div className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02]">
          <div>
            <p className="text-sm font-black text-black dark:text-white">
              {(venue.followers || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[9px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40">
              Followers
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              onFollow && onFollow(venue.id);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-80 active:scale-95 shadow"
          >
            <Heart size={12} fill="currentColor" />
            Follow
          </button>
        </div>
      </Link>
    </motion.div>
  );
});

export const HostCard = memo(function HostCard({ host, onFollow }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-[#F5F4F2] dark:bg-[#111111] transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
    >
      <Link href={`/host/${host.slug || host.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden">
          {host.cover || host.coverURL || host.bannerImage ? (
            <ShimmerImage
              src={host.cover || host.coverURL || host.bannerImage}
              alt={host.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-50"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#F44A22]/15 to-[#0A0A0A]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-white/25 shadow-xl mb-4">
              <ShimmerImage
                src={host.photoURL || host.avatar || '/events/holi-edit.svg'}
                alt={host.name}
                fill
                className="object-cover"
              />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F44A22]/20 border border-[#F44A22]/30 text-[9px] font-black uppercase tracking-widest text-[#F44A22] mb-2">
              {host.role || 'Host'}
            </span>
            <h3 className="text-lg font-heading font-black uppercase tracking-tight text-white text-center leading-tight">
              {host.name}
            </h3>
            {(host.genres || host.vibes)?.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {(host.genres || host.vibes).slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white/55"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between border-t border-black/5 dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex gap-5">
            <div>
              <p className="text-sm font-black text-black dark:text-white">
                {(host.followers || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-[9px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">
                Followers
              </p>
            </div>
            <div>
              <p className="text-sm font-black text-black dark:text-white">
                {host.upcomingEventsCount || 0}
              </p>
              <p className="text-[9px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">
                Events
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              onFollow && onFollow(host.id);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest hover:opacity-80 active:scale-95 transition-all shadow"
          >
            <Heart size={12} fill="currentColor" />
            Follow
          </button>
        </div>
      </Link>
    </motion.div>
  );
});

export function CardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-[#F5F4F2] dark:bg-[#111111]">
      <div className="aspect-[4/5] bg-black/5 dark:bg-white/5 animate-pulse" />
      <div className="p-4 flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-14 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
          <div className="h-2.5 w-20 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-9 w-20 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
