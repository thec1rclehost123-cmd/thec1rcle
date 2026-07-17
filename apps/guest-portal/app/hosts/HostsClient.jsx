'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HostCard, { HostSkeleton } from '../../components/hosts/HostCard';
import { VenueCard, CardSkeleton as VenueSkeleton } from '../../components/hosts/Cards';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../components/providers/AuthProvider';
import { useHostsStore } from '../../store/hostsStore';

const AREAS = [
  'Koregaon Park',
  'Baner',
  'Viman Nagar',
  'Kalyani Nagar',
  'FC Road',
  'Hinjewadi',
  'Wakad',
  'Shivajinagar',
];
const VIBES = [
  'Techno',
  'Bollywood',
  'Hip-hop',
  'House',
  'Commercial',
  'Afro',
  'Trance',
  'Open format',
  'Lounge',
  'Rooftop',
];
const ROLES = ['Promoter', 'DJ', 'Collective'];
const STATUSES = ['Verified', 'Trending', 'Popular'];
const SORTS = ['All', 'Popular', 'Soonest event', 'Most followed'];

export default function DiscoveryPage({
  initialVenues = [],
  initialHosts = [],
  initialErrors = [],
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('venues');
  const [search, setSearch] = useState('');
  const [activeArea, setActiveArea] = useState(null);
  const [activeVibe, setActiveVibe] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [activeStatus, setActiveStatus] = useState(null);
  const [activeSort, setActiveSort] = useState('All');
  const [tablesOnly, setTablesOnly] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { results: storeResults, status: fetchStatus, error, fetchData, hasMore } = useHostsStore();
  const loading = fetchStatus === 'loading';
  const hasDefaultFilters =
    !debouncedSearch &&
    !activeArea &&
    !activeVibe &&
    !activeRole &&
    !activeStatus &&
    activeSort === 'All' &&
    !tablesOnly;
  const activeInitialResults = activeTab === 'venues' ? initialVenues : initialHosts;
  const usingInitialResults = hasDefaultFilters && activeInitialResults.length > 0;

  // Default tab views should stay tied to their server-prefetched list; filtered
  // views use the store so persisted results cannot leak across Venues/Hosts.
  const results = usingInitialResults ? activeInitialResults : storeResults;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (hasDefaultFilters && activeInitialResults.length > 0) {
      return;
    }
    fetchData(
      {
        activeTab,
        search: debouncedSearch,
        activeArea,
        activeVibe,
        activeRole,
        activeStatus,
        activeSort,
        tablesOnly,
      },
      true,
    );
  }, [
    activeTab,
    debouncedSearch,
    activeArea,
    activeVibe,
    activeRole,
    activeStatus,
    activeSort,
    tablesOnly,
    fetchData,
    hasDefaultFilters,
    activeInitialResults.length,
  ]);

  const handleLoadMore = () => {
    fetchData(
      {
        activeTab,
        search: debouncedSearch,
        activeArea,
        activeVibe,
        activeRole,
        activeStatus,
        activeSort,
        tablesOnly,
      },
      false,
    );
  };

  const handleFollow = (id) => {
    if (!user) {
      window.dispatchEvent(
        new CustomEvent('OPEN_AUTH_MODAL', {
          detail: { intent: `FOLLOW_${activeTab.toUpperCase()}`, targetId: id },
        }),
      );
    }
  };

  const clearAll = () => {
    setSearch('');
    setActiveArea(null);
    setActiveVibe(null);
    setActiveRole(null);
    setActiveStatus(null);
    setTablesOnly(false);
    setActiveSort('All');
  };

  const isVenues = activeTab === 'venues';
  const hasActiveFilters =
    activeArea || activeVibe || activeRole || activeStatus || search || tablesOnly;

  return (
    <div className="relative bg-white dark:bg-[#0A0A0A] min-h-screen">
      {/* ─── Page header ─────────────────────────────────────────── */}
      <div className="pt-28 sm:pt-32 pb-10 px-4 sm:px-6 lg:px-12 max-w-[1600px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">
              {isVenues ? 'Discover Spaces' : 'Discover People'}
            </p>
          </div>

          {/* Heading + tab switcher row */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:justify-between">
            <AnimatePresence mode="wait">
              <motion.h1
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-4xl md:text-5xl lg:text-6xl font-heading font-black uppercase tracking-tight text-black dark:text-white leading-tight"
              >
                {isVenues ? (
                  <>
                    The{' '}
                    <span className="inline-block bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">
                      Venues
                    </span>
                  </>
                ) : (
                  <>
                    The{' '}
                    <span className="inline-block bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">
                      Hosts
                    </span>
                  </>
                )}
              </motion.h1>
            </AnimatePresence>

            {/* Tab switcher */}
            <div className="flex p-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full w-fit">
              {['venues', 'hosts'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    clearAll();
                  }}
                  className={`relative px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                    activeTab === tab
                      ? 'bg-black dark:bg-white text-white dark:text-black shadow'
                      : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-sm font-medium text-black/50 dark:text-white/40 max-w-lg leading-relaxed">
            {isVenues
              ? "The stages that set the pulse — Pune's finest circuits."
              : 'Curators, DJs, and collectives who shape the night.'}
          </p>
        </motion.div>
      </div>

      {/* ─── Filter + Search bar ─────────────────────────────────── */}
      <div className="sticky top-[72px] sm:top-[88px] z-40 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-y border-black/5 dark:border-white/5 py-4 transition-all duration-300">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 space-y-3">
          {/* Search */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search
                size={18}
                className="text-black/20 dark:text-white/20 group-focus-within:text-[#F44A22] transition-colors"
              />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${isVenues ? 'venues' : 'hosts'} by name, neighborhood, vibe...`}
              className="w-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-full py-3.5 pl-12 pr-5 text-sm text-black dark:text-white focus:outline-none focus:border-[#F44A22]/60 focus:ring-2 focus:ring-[#F44A22]/20 transition-all placeholder:text-black/25 dark:placeholder:text-white/20"
            />
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
            <div className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.5em] text-black/30 dark:text-white/30 pr-2">
              <SlidersHorizontal size={12} />
              Filters
            </div>
            <div className="w-px h-4 bg-black/10 dark:bg-white/10 flex-shrink-0" />

            {isVenues ? (
              <>
                <FilterChip
                  active={tablesOnly}
                  onClick={() => setTablesOnly(!tablesOnly)}
                  label="Tables Available"
                  accent
                />
                <FilterGroup items={AREAS} active={activeArea} setActive={setActiveArea} />
                <FilterGroup items={VIBES} active={activeVibe} setActive={setActiveVibe} />
              </>
            ) : (
              <>
                <FilterGroup items={ROLES} active={activeRole} setActive={setActiveRole} />
                <FilterGroup items={VIBES} active={activeVibe} setActive={setActiveVibe} />
                <FilterGroup items={STATUSES} active={activeStatus} setActive={setActiveStatus} />
              </>
            )}

            <div className="w-px h-4 bg-black/10 dark:bg-white/10 flex-shrink-0" />
            <FilterGroup items={SORTS} active={activeSort} setActive={setActiveSort} isSort />

            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="flex-shrink-0 ml-1 px-4 py-1.5 rounded-full border border-[#F44A22]/30 bg-[#F44A22]/5 text-[9px] font-black uppercase tracking-widest text-[#F44A22] hover:bg-[#F44A22] hover:text-white transition-all"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Section header + grid ───────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-12 pt-10">
        <div className="space-y-10">
          {initialErrors.length > 0 && (
            <div className="rounded-[32px] border border-red-500/20 bg-red-500/10 p-6 text-red-100">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-300">
                Partial outage
              </p>
              <p className="mt-3 text-sm">{initialErrors.join(' ')}</p>
            </div>
          )}

          {/* Section meta row */}
          {!loading && results.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-1 w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">
                  {isVenues ? 'All Venues' : 'All Hosts'}
                </p>
              </div>
              <div className="inline-flex gap-1.5 items-baseline px-5 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                <p className="text-xl font-black bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">
                  {results.length}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
                  Found
                </p>
              </div>
            </div>
          )}

          {/* States */}
          <div className="min-h-[400px]">
            {loading && results.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isVenues
                  ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => <VenueSkeleton key={i} />)
                  : [1, 2, 3, 4, 5, 6, 7, 8].map((i) => <HostSkeleton key={i} />)}
              </div>
            ) : error ? (
              <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 dark:to-transparent backdrop-blur-xl p-16 text-center space-y-5">
                <h3 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">
                  Sync Error
                </h3>
                <p className="text-black/40 dark:text-white/40 text-sm">{error}</p>
                <button
                  onClick={() =>
                    fetchData(
                      {
                        activeTab,
                        search: debouncedSearch,
                        activeArea,
                        activeVibe,
                        activeRole,
                        activeStatus,
                        activeSort,
                        tablesOnly,
                      },
                      true,
                    )
                  }
                  className="px-8 py-3 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  Retry
                </button>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 dark:to-transparent p-16 text-center space-y-5">
                <p className="text-5xl opacity-20">○</p>
                <h3 className="text-3xl font-heading font-black text-black dark:text-white uppercase tracking-tighter">
                  Nothing here
                </h3>
                <p className="text-black/40 dark:text-white/40 text-sm font-medium">
                  No results match these filters.
                </p>
                <button
                  onClick={clearAll}
                  className="px-8 py-3 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence mode="popLayout">
                    {results.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-50px' }}
                        transition={{
                          duration: 0.5,
                          delay: Math.min(idx * 0.05, 0.3),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        exit={{ opacity: 0 }}
                      >
                        {isVenues ? (
                          <VenueCard venue={item} onFollow={handleFollow} />
                        ) : (
                          <HostCard host={item} index={idx} onFollow={handleFollow} />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {!usingInitialResults && hasMore && (
                  <div className="flex justify-center mt-12">
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="group flex items-center gap-4 px-10 py-5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-500 disabled:opacity-50"
                    >
                      <span className="text-xs font-black uppercase tracking-[0.3em]">
                        {loading ? 'Loading...' : `Load More ${isVenues ? 'Venues' : 'Hosts'}`}
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="py-16" />
    </div>
  );
}

function FilterChip({ active, onClick, label, accent }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 snap-center px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all ${
        active
          ? 'bg-[#F44A22] border-[#F44A22] text-white'
          : 'bg-black/[0.03] dark:bg-white/[0.03] border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:border-black/20 dark:hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}

function FilterGroup({ items, active, setActive, isSort = false }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => setActive(active === item && !isSort ? null : item)}
          className={`flex-shrink-0 snap-center px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all ${
            active === item
              ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
              : 'bg-black/[0.03] dark:bg-white/[0.03] border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:border-black/20 dark:hover:border-white/20 hover:text-black dark:hover:text-white'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
