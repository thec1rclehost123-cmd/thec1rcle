'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Heart, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

/**
 * VenueGallery - Instagram-style 3x3 photo grid with fullscreen viewer
 * Supports infinite scroll and image likes
 */
export default function VenueGallery({ photos = [], venueName = 'Venue', initialLimit = 9 }) {
  const [displayCount, setDisplayCount] = useState(initialLimit);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [likedPhotos, setLikedPhotos] = useState({});

  // Filter out invalid photos
  const validPhotos = photos.filter((p) => p && typeof p === 'string' && !p.includes('.svg'));

  if (validPhotos.length === 0) return null;

  const displayedPhotos = validPhotos.slice(0, displayCount);
  const hasMore = displayCount < validPhotos.length;

  const openViewer = (index) => {
    setSelectedIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeViewer = () => {
    setSelectedIndex(null);
    document.body.style.overflow = 'auto';
  };

  const goToNext = () => {
    setSelectedIndex((prev) => {
      const next = prev + 1;
      if (next >= validPhotos.length) return 0;
      // Load more if needed
      if (next >= displayCount) {
        setDisplayCount((dc) => Math.min(dc + 9, validPhotos.length));
      }
      return next;
    });
  };

  const goToPrev = () => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : validPhotos.length - 1));
  };

  const toggleLike = (index) => {
    setLikedPhotos((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const loadMore = () => {
    setDisplayCount((prev) => Math.min(prev + 9, validPhotos.length));
  };

  return (
    <>
      <section className="px-4 sm:px-6 md:px-12 lg:px-24 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] block mb-2">
                Gallery
              </span>
              <h2 className="text-3xl font-heading font-black uppercase tracking-tighter text-black dark:text-white">
                The Vibe
              </h2>
            </div>
            <span className="text-[11px] font-bold text-black/30 dark:text-white/30 uppercase tracking-widest">
              {validPhotos.length} Photos
            </span>
          </div>

          {/* 3x3 Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-2">
            {displayedPhotos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => openViewer(idx)}
                className="relative aspect-square group overflow-hidden"
              >
                <Image
                  src={photo}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  alt={`${venueName} photo ${idx + 1}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
                {/* Like indicator if liked */}
                {likedPhotos[idx] && (
                  <div className="absolute top-2 right-2">
                    <Heart className="h-4 w-4 text-red-500 fill-current" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                className="px-8 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-[11px] font-black uppercase tracking-widest text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
              >
                Load More ({validPhotos.length - displayCount} remaining)
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Fullscreen Viewer */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-bold text-white">
              {selectedIndex + 1} / {validPhotos.length}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleLike(selectedIndex)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  likedPhotos[selectedIndex] ? 'bg-red-500/20' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Heart
                  className={`h-5 w-5 ${likedPhotos[selectedIndex] ? 'text-red-500 fill-current' : 'text-white'}`}
                />
              </button>
              <button
                onClick={closeViewer}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 relative flex items-center justify-center">
            <Image
              src={validPhotos[selectedIndex]}
              fill
              className="object-contain"
              alt={`${venueName} photo ${selectedIndex + 1}`}
            />

            {/* Navigation */}
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </div>

          {/* Thumbnails */}
          <div className="p-4 overflow-x-auto">
            <div className="flex items-center justify-center gap-2">
              {validPhotos
                .slice(Math.max(0, selectedIndex - 4), selectedIndex + 5)
                .map((photo, idx) => {
                  const actualIndex = Math.max(0, selectedIndex - 4) + idx;
                  return (
                    <button
                      key={actualIndex}
                      onClick={() => setSelectedIndex(actualIndex)}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        actualIndex === selectedIndex
                          ? 'border-white'
                          : 'border-transparent opacity-50 hover:opacity-100'
                      }`}
                    >
                      <Image src={photo} fill className="object-cover" alt="" />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
