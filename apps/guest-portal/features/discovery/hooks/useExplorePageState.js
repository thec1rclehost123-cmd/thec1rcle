'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useExploreStore } from '../../../store/exploreStore';
import { isGuestBffEnabled } from '../../../lib/bff/flags.js';
import {
  curatedCategoryMatchers,
  formatTypeLabel,
  getStartingPrice,
  isSameDay,
  isWeekend,
  slugify,
  sortComparators,
  sortTabs,
  toDate,
  toEventEndDate,
} from '../exploreModel';

function getBackendSort(sortLabel) {
  return sortLabel === 'Trending' || sortLabel === 'This Week'
    ? 'heat'
    : sortLabel === 'New'
      ? 'new'
      : sortLabel === 'Price Low to High'
        ? 'price'
        : 'soonest';
}

export function useExplorePageState({ initialEvents = [], initialFeaturedEvents = [] }) {
  const seedRef = useRef(false);
  const bffEnabled = isGuestBffEnabled('explore');

  const [activeSort, setActiveSort] = useState(sortTabs[0]);
  const [selectedCity, setSelectedCity] = useState('');
  const [filters, setFilters] = useState({
    curatedCategory: 'all',
    datePreset: 'any',
    endDate: '',
    eventType: 'all',
    price: 'all',
    startDate: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        curatedCategory: filters.curatedCategory,
        datePreset: filters.datePreset,
        endDate: filters.endDate,
        eventType: filters.eventType,
        price: filters.price,
        search: debouncedSearch.trim().toLowerCase(),
        startDate: filters.startDate,
      }),
    [debouncedSearch, filters],
  );
  const backendFilters = useMemo(() => {
    const nextFilters = {};
    const trimmedSearch = debouncedSearch.trim().toLowerCase();

    if (trimmedSearch) nextFilters.search = trimmedSearch;
    if (filters.eventType !== 'all') nextFilters.eventType = filters.eventType;
    if (filters.curatedCategory !== 'all') nextFilters.curatedCategory = filters.curatedCategory;
    if (filters.price === 'free' || filters.price === 'paid') nextFilters.priceType = filters.price;

    if (filters.datePreset === 'today') {
      nextFilters.dayKey = new Date().toISOString().slice(0, 10);
    } else if (filters.datePreset === 'weekend') {
      nextFilters.datePreset = 'weekend';
    } else if (filters.datePreset === 'custom') {
      nextFilters.datePreset = 'custom';
      if (filters.startDate) nextFilters.startDate = filters.startDate;
      if (filters.endDate) nextFilters.endDate = filters.endDate;
    }

    return nextFilters;
  }, [debouncedSearch, filters]);

  const events = useExploreStore((state) => state.events);
  const status = useExploreStore((state) => state.status);
  const error = useExploreStore((state) => state.error);
  const fetchEvents = useExploreStore((state) => state.fetchEvents);
  const hasMore = useExploreStore((state) => state.hasMore);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    if (initialEvents.length > 0) {
      useExploreStore.getState().seedEvents({
        city: null,
        events: initialEvents,
        filtersKey,
        sort: getBackendSort(sortTabs[0]),
      });
    }
  }, [filtersKey, initialEvents]);

  useEffect(() => {
    void fetchEvents(
      selectedCity || null,
      false,
      getBackendSort(activeSort),
      filtersKey,
      backendFilters,
    );
  }, [activeSort, backendFilters, fetchEvents, filtersKey, selectedCity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('c1rcle:city');
    if (stored) {
      setSelectedCity(stored);
    }
  }, []);

  const cityOptions = useMemo(() => {
    const citySource = bffEnabled && initialEvents.length > 0 ? initialEvents : events;
    if (!citySource.length) {
      return [{ count: 0, label: 'Pune, IN', value: 'pune-in' }];
    }
    const map = new Map();
    citySource.forEach((event) => {
      const value = event.cityKey || 'other-in';
      const label = event.cityLabel || 'Other City, IN';
      if (!map.has(value)) {
        map.set(value, { count: 0, label, value });
      }
      map.get(value).count += 1;
    });
    return Array.from(map.values()).sort((left, right) => right.count - left.count);
  }, [bffEnabled, events, initialEvents]);

  useEffect(() => {
    if (!cityOptions.length) return;
    setSelectedCity((previous) => {
      if (previous && cityOptions.some((option) => option.value === previous)) return previous;
      const pune = cityOptions.find((option) => option.value === 'pune-in');
      return pune ? pune.value : cityOptions[0].value;
    });
  }, [cityOptions]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedCity) return;
    window.localStorage.setItem('c1rcle:city', selectedCity);
  }, [selectedCity]);

  const eventTypeOptions = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const primaryTag = Array.isArray(event.tags) ? event.tags[0] : '';
      const key = slugify(primaryTag || event.eventType || event.category || 'venue');
      const label = primaryTag || formatTypeLabel(key);
      if (!map.has(key)) {
        map.set(key, { count: 0, label, value: key });
      }
      map.get(key).count += 1;
    });
    return Array.from(map.values()).sort((left, right) => right.count - left.count);
  }, [events]);

  const featuredSlides = useMemo(() => {
    if (initialFeaturedEvents.length > 0) return initialFeaturedEvents;
    if (!events.length) return [];
    return [...events].sort(sortComparators.Trending).slice(0, 6);
  }, [events, initialFeaturedEvents]);

  const cityDropdownOptions = useMemo(() => {
    if (!cityOptions.length) {
      return [{ description: '', label: 'Loading city', value: '' }];
    }
    return cityOptions.map((option) => ({
      description: `${option.count} events`,
      label: option.label,
      value: option.value,
    }));
  }, [cityOptions]);

  const eventsSource = useMemo(() => events, [events]);

  const processedEvents = useMemo(() => {
    return eventsSource.map((event) => {
      const parsedDate = toDate(event.startDateTime || event.startDate);
      return {
        ...event,
        _eventType: slugify(
          (Array.isArray(event.tags) ? event.tags[0] : '') ||
            event.eventType ||
            event.category ||
            'venue',
        ),
        _searchHaystack: [
          event.title,
          event.location,
          event.city,
          event.host,
          event.description,
          ...(event.tags || []),
        ]
          .join(' ')
          .toLowerCase(),
        _startingPrice: getStartingPrice(event),
        _time: parsedDate ? parsedDate.getTime() : Number.MAX_SAFE_INTEGER,
      };
    });
  }, [eventsSource]);

  const filteredEvents = useMemo(() => {
    if (bffEnabled) {
      return processedEvents;
    }

    const now = new Date();
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const targetCity = selectedCity;
    const priceFilter = filters.price;

    const matchesDatePreset = (event) => {
      const parsedDate = toDate(event.startDateTime || event.startDate);
      if (!parsedDate) return false;
      if (filters.datePreset === 'today') return isSameDay(parsedDate, now);
      if (filters.datePreset === 'weekend') return isWeekend(parsedDate);
      if (filters.datePreset === 'custom') {
        const start = filters.startDate ? toDate(filters.startDate) : null;
        const end = filters.endDate ? toEventEndDate(filters.endDate) : null;
        if (start && parsedDate < start) return false;
        if (end && parsedDate > end) return false;
      }
      return true;
    };

    const comparator = sortComparators[activeSort] || sortComparators.Trending;

    return processedEvents
      .filter((event) => {
        const eventEnd = toEventEndDate(event.endDate || event.startDate);
        if (eventEnd && eventEnd < now) return false;
        if (targetCity && event.cityKey !== targetCity) return false;
        if (filters.eventType !== 'all' && event._eventType !== filters.eventType) return false;
        if (filters.curatedCategory !== 'all') {
          const keywords = curatedCategoryMatchers[filters.curatedCategory] || [];
          if (!keywords.some((keyword) => event._searchHaystack.includes(keyword))) return false;
        }
        if (priceFilter === 'free' && !(event._startingPrice <= 0 || event.isFree)) return false;
        if (priceFilter === 'paid' && !(event._startingPrice > 0)) return false;
        if (normalizedSearch && !event._searchHaystack.includes(normalizedSearch)) return false;
        return matchesDatePreset(event);
      })
      .sort(comparator);
  }, [activeSort, bffEnabled, debouncedSearch, filters, processedEvents, selectedCity]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.datePreset !== 'any') count += 1;
    if (filters.price !== 'all') count += 1;
    if (filters.eventType !== 'all') count += 1;
    if (filters.curatedCategory !== 'all') count += 1;
    if (filters.startDate || filters.endDate) count += 1;
    if (searchTerm.trim()) count += 1;
    return count;
  }, [filters, searchTerm]);

  return {
    activeCityLabel:
      cityOptions.find((option) => option.value === selectedCity)?.label ||
      cityOptions[0]?.label ||
      'your city',
    activeFilterCount,
    activeSort,
    cityDropdownOptions,
    clearFilters: () => {
      setFilters({
        curatedCategory: 'all',
        datePreset: 'any',
        endDate: '',
        eventType: 'all',
        price: 'all',
        startDate: '',
      });
      setSearchTerm('');
    },
    error,
    eventTypeOptions,
    featuredSlides,
    fallbackCities: cityOptions.filter((option) => option.value !== selectedCity).slice(0, 2),
    filteredEvents,
    filters,
    handleFilterChange: (field, value) => {
      setFilters((previous) => ({ ...previous, [field]: value }));
    },
    hasMore,
    heroStatus: status,
    loadMore: () =>
      fetchEvents(selectedCity, false, getBackendSort(activeSort), filtersKey, backendFilters),
    searchTerm,
    selectedCity,
    setActiveSort,
    setSearchTerm,
    setSelectedCity,
    status,
  };
}
