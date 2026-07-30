'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useExploreStore } from '../../../store/exploreStore';
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

const SUPPORTED_CITIES = [
  { label: 'Pune, IN', value: 'pune-in' },
  { label: 'Mumbai, IN', value: 'mumbai-in' },
  { label: 'Bengaluru, IN', value: 'bengaluru-in' },
  { label: 'Delhi NCR, IN', value: 'delhi-in' },
  { label: 'Goa, IN', value: 'goa-in' },
  { label: 'Hyderabad, IN', value: 'hyderabad-in' },
  { label: 'Chennai, IN', value: 'chennai-in' },
  { label: 'Kolkata, IN', value: 'kolkata-in' },
  { label: 'Jaipur, IN', value: 'jaipur-in' },
  { label: 'Chandigarh, IN', value: 'chandigarh-in' },
];

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
    } else if (filters.datePreset === 'tomorrow') {
      nextFilters.datePreset = 'tomorrow';
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

  const cityOptions = useMemo(() => {
    const counts = {};
    events.forEach((event) => {
      const value = event.cityKey || 'other-in';
      counts[value] = (counts[value] || 0) + 1;
    });

    const list = SUPPORTED_CITIES.map((city) => ({
      ...city,
      count: counts[city.value] || 0,
    }));

    // Append any extra cities dynamically
    Object.keys(counts).forEach((key) => {
      if (key !== 'other-in' && !SUPPORTED_CITIES.some((c) => c.value === key)) {
        list.push({
          label: key.replace('-in', '').toUpperCase() + ', IN',
          value: key,
          count: counts[key],
        });
      }
    });

    return list.sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });
  }, [events]);

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
    const totalCount = events.length;
    const allOption = {
      description: `${totalCount} events`,
      label: 'All Cities',
      value: '',
    };
    if (!cityOptions.length) {
      return [allOption];
    }
    return [
      allOption,
      ...cityOptions.map((option) => ({
        description: `${option.count} events`,
        label: option.label,
        value: option.value,
      })),
    ];
  }, [cityOptions, events.length]);

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
    const now = new Date();
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const targetCity = selectedCity;
    const priceFilter = filters.price;

    const matchesDatePreset = (event) => {
      const parsedDate = toDate(event.startDateTime || event.startDate);
      if (!parsedDate) return false;
      if (filters.datePreset === 'today') return isSameDay(parsedDate, now);
      if (filters.datePreset === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return isSameDay(parsedDate, tomorrow);
      }
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
  }, [activeSort, debouncedSearch, filters, processedEvents, selectedCity]);

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
      selectedCity === ''
        ? 'All Cities'
        : cityOptions.find((option) => option.value === selectedCity)?.label ||
          cityOptions[0]?.label ||
          'All Cities',
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
    setCustomDate: (dateString) => {
      setFilters((previous) => ({
        ...previous,
        datePreset: dateString ? 'custom' : 'any',
        startDate: dateString || '',
        endDate: dateString || '',
      }));
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
