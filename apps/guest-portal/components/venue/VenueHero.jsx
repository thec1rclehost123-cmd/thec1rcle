'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ChevronLeft, CheckCircle2 } from 'lucide-react';

/**
 * VenueHero - Poster-style hero section for venue page
 * Includes: Cover, Logo, Name, Category, Follow Button on poster, Followers count
 */
export default function VenueHero({ venue, isFollowing = false, onFollow, followersCount = 0 }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const coverImage = venue.coverURL || venue.coverImage || venue.image || '/events/neon-nights.jpg';
  const logo = venue.photoURL || venue.logo;
  const category = venue.venueType || venue.category || venue.type || 'Venue';
  const isVerified = venue.verified || venue.isVerified;

  return (
    <section className="relative w-full">
      {/* Poster Container */}
      <div className="relative aspect-[3/4] sm:aspect-[4/5] md:aspect-[16/10] lg:aspect-[21/9] w-full overflow-hidden">
        {/* Cover Image */}
        <Image
          src={coverImage}
          alt={venue.name}
          fill
          priority
          sizes="100vw"
          className={`object-cover transition-all duration-700 ${imageLoaded ? 'scale-100 blur-0' : 'scale-105 blur-sm'}`}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0A0A0A] via-transparent to-transparent opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

        {/* Top Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 z-40">
          <div className="safe-area-top" />
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            {/* Back Button */}
            <Link
              href="/hosts"
              className="w-10 h-10 sm:w-11 sm:h-11 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center hover:bg-black/30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </Link>

            {/* Follow Button - ON the poster */}
            <button
              onClick={onFollow}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-xl border transition-all duration-300 ${
                isFollowing
                  ? 'bg-[#F44A22] border-[#F44A22] text-white'
                  : 'bg-black/20 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              <Heart className={`h-4 w-4 ${isFollowing ? 'fill-current' : ''}`} />
              <span className="text-[11px] font-black uppercase tracking-widest">
                {isFollowing ? 'Following' : 'Follow'}
              </span>
              {followersCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isFollowing ? 'bg-white/20' : 'bg-white/10'
                  }`}
                >
                  {followersCount >= 1000
                    ? `${(followersCount / 1000).toFixed(1)}K`
                    : followersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 sm:px-6 md:px-12 pb-4 sm:pb-6 md:pb-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
            {/* Logo */}
            {logo && (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-[#0A0A0A] shadow-2xl flex-shrink-0 bg-white/10 backdrop-blur-xl">
                <Image
                  src={logo}
                  width={96}
                  height={96}
                  alt={`${venue.name} logo`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Name & Category */}
            <div className="flex-1 min-w-0">
              {/* Category Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-white dark:text-white/80">
                  {category}
                </span>
                {isVerified && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-[#F44A22]/20 rounded-full">
                    <CheckCircle2 className="h-3 w-3 text-[#F44A22]" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#F44A22]">
                      Verified
                    </span>
                  </span>
                )}
              </div>

              {/* Venue Name */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-black uppercase tracking-tighter text-white dark:text-white leading-[0.9] drop-shadow-lg">
                {venue.name}
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
