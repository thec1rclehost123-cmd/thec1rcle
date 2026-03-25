import Link from "next/link";
import HeroVideo from "../components/HeroVideo";
// import HeroCarousel from "../components/HeroCarousel";
import CategoryBar from "../components/CategoryBar";
import nextDynamic from "next/dynamic";
import { GridSkeleton } from "@c1rcle/ui";
const EventGrid = nextDynamic(() => import("../components/EventGrid"), {
  ssr: true,
  loading: () => <GridSkeleton count={6} />
});
import Selects from "../components/Selects";
import InterviewSection from "../components/InterviewSection";
import ArtistsSection from "../components/ArtistsSection";
import HeroCarousel from "../components/HeroCarouselClient";
import SectionReveal from "../components/SectionReveal";
import { heroVideoSrc, getHomepageContent } from "../lib/homepageData";

// ISR: Revalidate homepage data every 60 seconds instead of on every request.
// This prevents the 8+ second Firestore queries from blocking the server.
export const revalidate = 60;

export default async function HomePage() {

  let data = {
    heroCards: [],
    categoryFilters: [],
    eventGrid: [],
    selects: [],
    interviews: []
  };

  try {
    data = await getHomepageContent();
  } catch (error) {
    console.warn("⚠️ Build Warning: Failed to fetch live homepage data (likely expected during static generation). Rendering empty shell.", error.message);
  }

  const { heroCards, categoryFilters, eventGrid, selects, interviews } = data;
  return (
    <>
      <HeroVideo src={heroVideoSrc} />
      <SectionReveal>
        <HeroCarousel cards={heroCards} />
      </SectionReveal>
      <SectionReveal>
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-[0.1em] text-black dark:text-white">
                Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4b1f] to-[#ff9068]">Offline</span>
              </h2>
              <p className="mt-4 text-black/70 dark:text-white/80 text-sm md:text-base max-w-md font-medium leading-relaxed">
                Curated experiences, underground sets, and the best of your city's culture—all in one place.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/explore" className="group flex items-center gap-2 px-6 py-3 rounded-full bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 text-black dark:text-white text-[11px] font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-300">
                View All
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
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
