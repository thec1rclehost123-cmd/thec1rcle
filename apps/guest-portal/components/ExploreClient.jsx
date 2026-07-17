'use client';

import dynamic from 'next/dynamic';
import { GridSkeleton } from '@c1rcle/ui';
import ExploreFilterBar from './ExploreFilterBar';
import ExploreEventGrid from './ExploreEventGrid';
import { useExplorePageState } from '../features/discovery/hooks/useExplorePageState';

const ExploreCarouselHeader = dynamic(() => import('./ExploreCarouselHeader'), {
  loading: () => (
    <div className="h-[40vh] sm:h-[50vh] animate-pulse rounded-[32px] bg-black/5 sm:rounded-[40px] mx-4 mt-4 sm:mx-12 sm:mt-12" />
  ),
  ssr: true,
});

export default function ExploreClient({
  initialEvents = [],
  initialFeaturedEvents = [],
  initialErrors = [],
}) {
  const {
    activeCityLabel,
    activeSort,
    cityDropdownOptions,
    clearFilters,
    error,
    fallbackCities,
    featuredSlides,
    filteredEvents,
    filters,
    handleFilterChange,
    hasMore,
    heroStatus,
    loadMore,
    searchTerm,
    selectedCity,
    setActiveSort,
    setSearchTerm,
    setSelectedCity,
    status,
    setCustomDate,
  } = useExplorePageState({ initialEvents, initialFeaturedEvents });

  const heroSection = featuredSlides.length ? (
    <ExploreCarouselHeader slides={featuredSlides} />
  ) : (
    <HeroSkeleton status={heroStatus} error={error} />
  );

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0A0A0A]">
      <div className="relative z-10">
        <section className="px-4 py-4 lg:px-8 lg:py-6">
          <div className="relative overflow-hidden rounded-[32px] border border-black/5 bg-black shadow-2xl sm:rounded-[48px] dark:border-white/10">
            {heroSection}
          </div>
        </section>

        <div className="relative z-[20] -mt-12 mb-16 flex justify-center">
          <div className="w-full overflow-visible">
            <ExploreFilterBar
              city={selectedCity}
              cityOptions={cityDropdownOptions}
              date={filters.datePreset}
              startDate={filters.startDate}
              setCustomDate={setCustomDate}
              searchTerm={searchTerm}
              setCity={setSelectedCity}
              setDate={(value) => handleFilterChange('datePreset', value)}
              setSearchTerm={setSearchTerm}
              setSort={setActiveSort}
              sort={activeSort}
            />
          </div>
        </div>

        <section className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-12">
          <div className="space-y-12">
            {initialErrors.length > 0 && <ErrorBlock message={initialErrors.join(' ')} />}
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]" />
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">
                    Explore Events
                  </p>
                </div>
                <h2 className="text-3xl font-heading font-black uppercase leading-tight tracking-tight text-black dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
                  What&apos;s on in{' '}
                  <span className="inline-block bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">
                    {activeCityLabel}
                  </span>
                </h2>
              </div>
              <div className="text-center md:text-right">
                <div className="inline-flex flex-col gap-1 rounded-2xl border border-black/10 bg-black/5 px-8 py-4 dark:border-white/10 dark:bg-white/5">
                  <p className="bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-4xl font-black text-transparent">
                    {filteredEvents.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60">
                    Events Found
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-[400px]">
              {status === 'loading' && (
                <GridSkeleton
                  count={8}
                  columns="grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                />
              )}
              {status === 'error' && <ErrorBlock message={error || 'Failed to load events.'} />}
              {status === 'ready' && filteredEvents.length === 0 && (
                <EmptyState
                  city={activeCityLabel}
                  fallbackCities={fallbackCities}
                  onCitySelect={setSelectedCity}
                  onReset={clearFilters}
                />
              )}
              {filteredEvents.length > 0 && (
                <>
                  <ExploreEventGrid events={filteredEvents} />

                  {hasMore && (
                    <div className="mt-12 flex justify-center pb-12">
                      <button
                        onClick={loadMore}
                        disabled={status === 'loading'}
                        className="group flex items-center gap-4 rounded-full border border-black/10 bg-black/5 px-10 py-5 transition-all duration-500 hover:bg-black hover:text-white disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white dark:hover:text-black"
                      >
                        <span className="text-xs font-black uppercase tracking-[0.3em]">
                          {status === 'loading' ? 'Loading...' : 'Load More Events'}
                        </span>
                        {status !== 'loading' && (
                          <ArrowRightIcon className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-2" />
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroSkeleton({ status, error }) {
  if (status === 'error') {
    return (
      <section className="relative w-full py-12">
        <div className="mx-auto w-full max-w-[1400px] px-6">
          <div className="rounded-[40px] border border-red-500/20 bg-red-500/5 p-16 text-center backdrop-blur-xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="mb-2 text-2xl font-black text-red-500 dark:text-red-400">
              Failed to load featured events
            </p>
            <p className="text-base text-red-500/70 dark:text-red-400/70">
              {error || 'Please try refreshing the page.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full py-4 lg:py-6">
      <div className="mx-auto w-full px-4 sm:px-6">
        <div className="relative flex min-h-[400px] h-auto items-center justify-center overflow-hidden rounded-[32px] border border-black/5 bg-gradient-to-br from-black/5 to-transparent sm:rounded-[48px] lg:min-h-[600px] dark:border-white/5 dark:from-white/5 dark:to-transparent">
          <div className="shimmer-block absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-transparent dark:from-white/5" />
          <div className="relative z-10 space-y-4 text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-black/10 border-t-black dark:border-white/10 dark:border-t-white" />
            <p className="text-sm font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
              Loading Featured Events
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ city, fallbackCities, onCitySelect, onReset }) {
  return (
    <div className="rounded-[32px] border border-black/10 bg-gradient-to-br from-black/5 to-transparent p-16 text-center backdrop-blur-xl dark:border-white/10 dark:from-white/5 dark:to-transparent">
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-[#F44A22]/30 bg-gradient-to-br from-[#F44A22]/20 to-[#FF6B4A]/20">
        <SearchIcon />
      </div>
      <h3 className="mb-3 text-3xl font-heading font-black uppercase text-black dark:text-white md:text-4xl">
        No events found
      </h3>
      <p className="mx-auto mb-10 max-w-lg text-lg text-black/60 dark:text-white/60">
        We couldn&apos;t find any events matching your filters in{' '}
        <span className="font-bold text-[#F44A22]">{city}</span>. Try adjusting your search or check
        out other cities.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={onReset}
          className="rounded-full border border-black/20 px-6 py-3 min-h-[44px] text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-black/10 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
        >
          Clear Filters
        </button>
      </div>

      {fallbackCities.length > 0 && (
        <div className="mt-8 border-t border-black/10 dark:border-white/10 pt-8">
          <p className="mb-4 text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40">
            Popular Cities
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {fallbackCities.map((option) => (
              <button
                key={option.value}
                onClick={() => onCitySelect(option.value)}
                className="rounded-full border border-black/10 bg-black/5 px-4 py-2.5 min-h-[44px] text-[10px] font-bold uppercase tracking-widest text-black/70 transition-colors hover:bg-black/10 hover:text-black dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorBlock({ message }) {
  return (
    <div className="rounded-[32px] border border-red-500/20 bg-red-500/10 p-6 text-red-200">
      <p className="text-lg font-semibold">Something glitched.</p>
      <p className="text-sm text-red-100">{message}</p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 text-black/60 dark:text-white/60"
      aria-hidden="true"
    >
      <path
        d="M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5.5-1 4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 10h10m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
