'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { GridSkeleton } from '@c1rcle/ui';
import HeroVideo from '../components/HeroVideo';
import CategoryBar from '../components/CategoryBar';
import Selects from '../components/Selects';
import InterviewSection from '../components/InterviewSection';
import ArtistsSection from '../components/ArtistsSection';
import HeroCarousel from '../components/HeroCarouselClient';
import SectionReveal from '../components/SectionReveal';
import { heroVideoSrc, loadHomepageContent } from '../features/discovery/homepageData';

const EventGrid = nextDynamic(() => import('../components/EventGrid'), {
  ssr: true,
  loading: () => <GridSkeleton count={6} />,
});

const EMPTY_DATA = {
  heroCards: [],
  categoryFilters: [],
  eventGrid: [],
  selects: [],
  interviews: [],
};

export default function HomePageClient({ initialData = null, initialErrors = [] }) {
  const [data, setData] = useState(initialData || EMPTY_DATA);
  const [errors, setErrors] = useState(initialErrors);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    async function loadContent() {
      try {
        const nextData = await loadHomepageContent();
        if (!cancelled) {
          setData(nextData);
          setErrors([]);
        }
      } catch (error) {
        if (!cancelled) {
          setErrors([error?.message || 'Homepage content could not be loaded.']);
        }
      }
    }

    loadContent();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const { heroCards, categoryFilters, eventGrid, selects, interviews } = data;

  return (
    <>
      {errors.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
          <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5 text-red-100 backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-300">
              Partial outage
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {errors.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <HeroVideo src={heroVideoSrc} />
      <SectionReveal>
        <HeroCarousel cards={heroCards} />
      </SectionReveal>
      <SectionReveal>
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-[0.1em] text-black dark:text-white md:text-6xl">
                Discover{' '}
                <span className="bg-gradient-to-r from-[#ff4b1f] to-[#ff9068] bg-clip-text text-transparent">
                  Offline
                </span>
              </h2>
              <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-black/70 dark:text-white/80 md:text-base">
                Curated experiences, underground sets, and the best of your city's culture-all in
                one place.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/explore"
                className="group flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-6 py-3 text-[11px] font-black uppercase tracking-widest text-black transition-all duration-300 hover:bg-black hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white dark:hover:text-black"
              >
                View All
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>
          </div>

          <CategoryBar categories={categoryFilters} />

          <div className="mt-2">
            <EventGrid events={eventGrid} />
          </div>
        </div>
      </SectionReveal>
      <Selects items={selects} />
      <InterviewSection interviews={interviews} />
      <SectionReveal>
        <ArtistsSection />
      </SectionReveal>
    </>
  );
}
