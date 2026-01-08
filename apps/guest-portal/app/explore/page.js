"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ExploreCarouselHeader from "../../components/ExploreCarouselHeader";
import ExploreFilterBar from "../../components/ExploreFilterBar";
import CategoryTabs from "../../components/CategoryTabs";
import ExploreEventGrid from "../../components/ExploreEventGrid";
import Skeleton from "../../components/ui/Skeleton";

const sortTabs = ["Trending", "This Week", "New", "Soonest", "Price Low to High"];
const dateFilters = [
  { label: "Any date", value: "any" },
  { label: "Today", value: "today" },
  { label: "This weekend", value: "weekend" },
  { label: "Custom", value: "custom" }
];
const priceFilters = [
  { label: "All prices", value: "all" },
  { label: "Free RSVP", value: "free" },
  { label: "Paid", value: "paid" }
];
const curatedCategoryOptions = [
  { label: "All vibes", value: "all", description: "Show everything" },
  { label: "Campus", value: "campus", description: "College quads & fresher nights" },
  { label: "Party", value: "party", description: "Venues, edits, blowouts" },
  { label: "Afters", value: "afters", description: "Late nights & underground" },
  { label: "Brunch", value: "brunch", description: "Day parties, sun-kissed" },
  { label: "Art", value: "art", description: "Galleries & pop-up shows" },
  { label: "Community", value: "community", description: "Markets & meet-ups" }
];

const curatedCategoryMatchers = {
  campus: ["campus", "college", "university", "freshers"],
  party: ["party", "venue", "night", "dj", "dance"],
  afters: ["after", "afterhours", "late", "underground"],
  brunch: ["brunch", "day party", "sunrise", "cookout"],
  art: ["art", "gallery", "exhibit", "creative", "design"],
  community: ["community", "market", "meetup", "collective", "venue"]
};

const pageSize = 12;

const slugify = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-/, "").replace(/-$/, "");
const formatTypeLabel = (value = "") =>
  value
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const getStartingPrice = (event) => {
  if (typeof event.startingPrice === "number") return event.startingPrice;
  if (typeof event.priceRange?.min === "number") return event.priceRange.min;
  if (Array.isArray(event.tickets) && event.tickets.length) {
    return event.tickets.reduce((min, ticket) => Math.min(min, Number(ticket.price) || 0), Infinity);
  }
  return 0;
};

const getEventTime = (event) => {
  const date = toDate(event.startDateTime || event.startDate);
  if (date) return date.getTime();
  return Number.MAX_SAFE_INTEGER;
};

const sortComparators = {
  Trending: (a, b) => (b.heatScore ?? b.stats?.heatScore ?? 0) - (a.heatScore ?? a.stats?.heatScore ?? 0),
  "This Week": (a, b) => {
    const now = Date.now();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    const timeA = getEventTime(a);
    const timeB = getEventTime(b);
    const aInWeek = timeA >= now && timeA <= weekAhead;
    const bInWeek = timeB >= now && timeB <= weekAhead;
    if (aInWeek && !bInWeek) return -1;
    if (!aInWeek && bInWeek) return 1;
    return timeA - timeB;
  },
  New: (a, b) => new Date(b.createdAt || b.stats?.createdAt || 0) - new Date(a.createdAt || a.stats?.createdAt || 0),
  Soonest: (a, b) => getEventTime(a) - getEventTime(b),
  "Price Low to High": (a, b) => getStartingPrice(a) - getStartingPrice(b)
};

export default function ExplorePage() {
  const [activeSort, setActiveSort] = useState(sortTabs[0]);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [filters, setFilters] = useState({
    datePreset: "any",
    startDate: "",
    endDate: "",
    price: "all",
    eventType: "all",
    curatedCategory: "all"
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadEvents() {
      setStatus("loading");
      setError("");
      try {
        const response = await fetch("/api/events?limit=60&sort=heat", {
          signal: controller.signal,
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error("Unable to fetch events");
        }
        const payload = await response.json();
        if (!cancelled) {
          setEvents(Array.isArray(payload) ? payload : []);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.name === "AbortError" ? "" : err.message || "Unable to fetch events");
          setStatus(err?.name === "AbortError" ? "loading" : "error");
        }
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("c1rcle:city");
    if (stored) {
      setSelectedCity(stored);
    }
  }, []);

  const cityOptions = useMemo(() => {
    if (!events.length) {
      return [{ value: "pune-in", label: "Pune, IN", count: 0 }];
    }
    const map = new Map();
    events.forEach((event) => {
      // Use canonical cityKey and Label from mapEventForClient
      const value = event.cityKey || "other-in";
      const label = event.cityLabel || "Other City, IN";
      if (!map.has(value)) {
        map.set(value, { value, label, count: 0 });
      }
      map.get(value).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [events]);

  useEffect(() => {
    if (!cityOptions.length) return;
    setSelectedCity((prev) => {
      if (prev && cityOptions.some((option) => option.value === prev)) return prev;
      // Default to Pune if available, otherwise first option
      const pune = cityOptions.find(o => o.value === "pune-in");
      return pune ? pune.value : cityOptions[0].value;
    });
  }, [cityOptions]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedCity) return;
    window.localStorage.setItem("c1rcle:city", selectedCity);
  }, [selectedCity]);

  const eventTypeOptions = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const primaryTag = Array.isArray(event.tags) ? event.tags[0] : "";
      const key = slugify(primaryTag || event.eventType || event.category || "venue");
      const label = primaryTag || formatTypeLabel(key);
      if (!map.has(key)) {
        map.set(key, { value: key, label, count: 0 });
      }
      map.get(key).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [events]);

  const heroEvents = useMemo(() => {
    if (!events.length) return [];
    const comparator = sortComparators.Trending;
    const sorted = [...events].sort(comparator);

    // Prioritize "After Dark AZ: Mansion Party"
    const priorityIndex = sorted.findIndex(e =>
      e.title?.toLowerCase().includes("after dark az") &&
      e.title?.toLowerCase().includes("mansion party")
    );

    if (priorityIndex > -1) {
      const [priorityEvent] = sorted.splice(priorityIndex, 1);
      sorted.unshift(priorityEvent);
    }

    return sorted.slice(0, 6);
  }, [events]);

  const cityDropdownOptions = useMemo(() => {
    if (!cityOptions.length) {
      return [{ value: "", label: "Loading city", description: "" }];
    }
    return cityOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: `${option.count} events`
    }));
  }, [cityOptions]);

  const filteredEvents = useMemo(() => {
    if (!events.length) return [];
    const typeFilter = filters.eventType || "all";
    const priceFilter = filters.price;
    const curatedFilter = filters.curatedCategory || "all";
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const targetCity = selectedCity || cityOptions[0]?.value || "";
    const customStart = filters.datePreset === "custom" && filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
    const customEnd =
      filters.datePreset === "custom" && filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
    const now = new Date();

    const matchesDatePreset = (event) => {
      if (filters.datePreset === "any") return true;
      const eventDate = toDate(event.startDateTime || event.startDate);
      if (!eventDate) return true;
      if (filters.datePreset === "today") {
        return isSameDay(eventDate, now);
      }
      if (filters.datePreset === "weekend") {
        return isWeekend(eventDate);
      }
      if (filters.datePreset === "custom") {
        if (customStart && eventDate < customStart) return false;
        if (customEnd && eventDate > customEnd) return false;
        return true;
      }
      return true;
    };

    const matchesSearch = (event) => {
      if (!normalizedSearch) return true;
      const haystack = [
        event.title,
        event.location,
        event.city,
        event.host,
        event.description,
        ...(event.tags || [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    };

    const matchesCity = (event) => {
      if (!targetCity) return true;
      return event.cityKey === targetCity;
    };
    const matchesType = (event) => {
      if (typeFilter === "all") return true;
      const primaryTag = Array.isArray(event.tags) ? event.tags[0] : "";
      const eventType = slugify(primaryTag || event.eventType || event.category || "");
      return eventType === typeFilter;
    };

    const matchesCuratedCategory = (event) => {
      if (curatedFilter === "all") return true;
      const keywords = curatedCategoryMatchers[curatedFilter] || [];
      const haystack = `${event.title || ""} ${event.description || ""} ${event.location || ""} ${(
        event.tags || []
      ).join(" ")}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    };

    const matchesPrice = (event) => {
      if (priceFilter === "all") return true;
      const startingPrice = getStartingPrice(event);
      if (priceFilter === "free") return startingPrice <= 0 || event.isFree;
      if (priceFilter === "paid") return startingPrice > 0;
      return true;
    };

    const comparator = sortComparators[activeSort] || sortComparators.Trending;

    return events
      .filter(
        (event) =>
          matchesCity(event) &&
          matchesType(event) &&
          matchesCuratedCategory(event) &&
          matchesPrice(event) &&
          matchesSearch(event) &&
          matchesDatePreset(event)
      )
      .sort(comparator);
  }, [events, filters, searchTerm, activeSort, selectedCity, cityOptions]);

  const activeCityLabel = cityOptions.find((option) => option.value === selectedCity)?.label || cityOptions[0]?.label || "your city";
  const fallbackCities = cityOptions.filter((option) => option.value !== selectedCity).slice(0, 2);
  const showCustomRange = filters.datePreset === "custom";
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.datePreset !== "any") count += 1;
    if (filters.price !== "all") count += 1;
    if (filters.eventType !== "all") count += 1;
    if (filters.curatedCategory && filters.curatedCategory !== "all") count += 1;
    if (filters.startDate || filters.endDate) count += 1;
    if (searchTerm.trim()) count += 1;
    return count;
  }, [filters.datePreset, filters.price, filters.eventType, filters.curatedCategory, filters.startDate, filters.endDate, searchTerm]);
  const filterSummaryLabel = activeFilterCount
    ? `${activeFilterCount} active ${activeFilterCount === 1 ? "filter" : "filters"}`
    : "No filters applied";

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm, activeSort, selectedCity]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));

  useEffect(() => {
    setCurrentPage((prev) => {
      const next = Math.min(prev, totalPages);
      return next < 1 ? 1 : next;
    });
  }, [totalPages]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      datePreset: "any",
      startDate: "",
      endDate: "",
      price: "all",
      eventType: "all",
      curatedCategory: "all"
    });
    setSearchTerm("");
  };

  const heroSection = heroEvents.length ? (
    <ExploreCarouselHeader slides={heroEvents} />
  ) : (
    <HeroSkeleton status={status} error={error} />
  );

  return (
    <div className="relative bg-white dark:bg-[#0A0A0A]">
      {/* Content wrapper */}
      <div className="relative z-10">
        {heroSection}

        {/* Filter Bar */}
        <div className="w-full bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-y border-black/5 dark:border-white/5 py-4 transition-all duration-300">
          <ExploreFilterBar
            sort={activeSort}
            setSort={setActiveSort}
            date={filters.datePreset}
            setDate={(val) => handleFilterChange("datePreset", val)}
            city={selectedCity}
            setCity={setSelectedCity}
            cityOptions={cityDropdownOptions}
          />
        </div>

        <section className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-12">
          <div className="space-y-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-12 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">
                    Explore Events
                  </p>
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black uppercase tracking-tight text-black dark:text-white leading-tight">
                  What&apos;s on in{" "}
                  <span className="inline-block bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">
                    {activeCityLabel}
                  </span>
                </h2>
              </div>
              <div className="text-center md:text-right">
                <div className="inline-flex flex-col gap-1 px-8 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <p className="text-4xl font-black bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">{filteredEvents.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60">Events Found</p>
                </div>
              </div>
            </div>

            <div className="min-h-[400px]">
              {status === "loading" && <LoadingSkeletonGrid />}
              {status === "error" && <ErrorBlock message={error || "Failed to load events."} />}
              {status === "ready" && filteredEvents.length === 0 && (
                <EmptyState
                  city={activeCityLabel}
                  fallbackCities={fallbackCities}
                  onCitySelect={setSelectedCity}
                  onReset={clearFilters}
                />
              )}
              {filteredEvents.length > 0 && (
                <>
                  <ExploreEventGrid events={paginatedEvents} />
                  {filteredEvents.length > pageSize && (
                    <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
      {/* End content wrapper */}
    </div>
  );
}

function FilterDropdown({ label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0] || { label: "Select", value: "" };

  useEffect(() => {
    const handleClick = (event) => {
      if (!containerRef.current || containerRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex min-w-[185px] items-center justify-between rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-6 py-3.5 backdrop-blur-md transition-all hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[9px] uppercase tracking-[0.5em] text-black/40 dark:text-white/40 mb-0.5">{label}</span>
          <span className="text-sm font-bold text-black dark:text-white tracking-wide">{selected.label}</span>
          {selected.description && <span className="text-[10px] text-black/40 dark:text-white/40">{selected.description}</span>}
        </div>
        <ChevronDownIcon className={clsx("h-4 w-4 text-black/60 dark:text-white/60 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-[24px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#0A0A0A]/95 p-2 shadow-floating backdrop-blur-xl"
          >
            <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
              {options.map((option) => (
                <button
                  key={option.value || option.label}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all",
                    option.value === value ? "bg-black/10 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                  )}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold tracking-wide">{option.label}</span>
                    {option.description && <span className="text-[10px] uppercase tracking-wider text-black/30 dark:text-white/30">{option.description}</span>}
                  </span>
                  {option.value === value && <CheckIcon className="text-black dark:text-white" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroSkeleton({ status, error }) {
  if (status === "error") {
    return (
      <section className="relative w-full py-12">
        <div className="mx-auto w-full max-w-[1400px] px-6">
          <div className="rounded-[40px] border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-2xl font-black text-red-500 dark:text-red-400 mb-2">Failed to load featured events</p>
            <p className="text-base text-red-500/70 dark:text-red-400/70">{error || "Please try refreshing the page."}</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="relative w-full py-12">
      <div className="mx-auto w-full max-w-[1600px] px-6">
        <div className="relative overflow-hidden rounded-[40px] border border-black/5 dark:border-white/5 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 dark:to-transparent min-h-[50vh] lg:min-h-[750px] h-auto flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-black/5 dark:from-white/5 via-transparent to-transparent shimmer-block" />
          <div className="relative z-10 text-center space-y-4">
            <div className="w-16 h-16 border-4 border-black/10 dark:border-white/10 border-t-black dark:border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Loading Featured Events</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadingSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="relative h-[420px] overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-surface"
        >
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-8 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ city, fallbackCities, onCitySelect, onReset }) {
  return (
    <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 dark:to-transparent backdrop-blur-xl p-16 text-center">
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#F44A22]/20 to-[#FF6B4A]/20 border border-[#F44A22]/30">
        <SearchIcon />
      </div>
      <h3 className="text-3xl md:text-4xl font-heading font-black text-black dark:text-white mb-3 uppercase">No events found</h3>
      <p className="text-lg text-black/60 dark:text-white/60 max-w-lg mx-auto mb-10">
        We couldn't find any events matching your filters in <span className="font-bold text-[#F44A22]">{city}</span>. Try adjusting your search or check out other cities.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={onReset}
          className="rounded-full border border-black/20 dark:border-white/20 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {fallbackCities.length > 0 && (
        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-4">Popular Cities</p>
          <div className="flex flex-wrap justify-center gap-2">
            {fallbackCities.map((option) => (
              <button
                key={option.value}
                onClick={() => onCitySelect(option.value)}
                className="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors"
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

function Pagination({ current, total, onChange }) {
  return (
    <div className="flex items-center justify-between mt-12">
      <button
        onClick={() => onChange(Math.max(current - 1, 1))}
        disabled={current === 1}
        className="group flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60 disabled:opacity-30 hover:text-black dark:hover:text-white transition-colors"
      >
        <ArrowLeftIcon />
        <span className="group-hover:-translate-x-1 transition-transform">Previous</span>
      </button>

      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            className={clsx(
              "h-2 rounded-full transition-all duration-300",
              current === i + 1 ? "w-8 bg-black dark:bg-white" : "w-2 bg-black/20 dark:bg-white/20 hover:bg-black/40 dark:hover:bg-white/40"
            )}
            aria-label={`Page ${i + 1}`}
          />
        ))}
      </div>

      <button
        onClick={() => onChange(Math.min(current + 1, total))}
        disabled={current === total}
        className="group flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60 disabled:opacity-30 hover:text-black dark:hover:text-white transition-colors"
      >
        <span className="group-hover:translate-x-1 transition-transform">Next</span>
        <ArrowRightIcon />
      </button>
    </div>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={clsx("h-4 w-4", className)} aria-hidden="true">
      <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black/60 dark:text-white/60" aria-hidden="true">
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

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" aria-hidden="true">
      <path d="M15 10H5m0 0 5-5m-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" aria-hidden="true">
      <path d="M5 10h10m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
