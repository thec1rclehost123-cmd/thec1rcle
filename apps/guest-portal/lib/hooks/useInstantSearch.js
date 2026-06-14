"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useInstantSearch - React hook for instant search with debouncing
 *
 * Features:
 * - Debounced search (300ms default)
 * - Loading states
 * - Autocomplete suggestions
 * - Filter support
 * - Pagination
 */
export function useInstantSearch(options = {}) {
  const { type = "events", debounceMs = 300, initialFilters = {}, limit = 20 } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [facets, setFacets] = useState({});
  const [totalHits, setTotalHits] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [offset, setOffset] = useState(0);

  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Build search URL
  const buildSearchUrl = useCallback(
    (q, opts = {}) => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("type", opts.type || type);
      params.set("limit", opts.limit || limit);
      params.set("offset", opts.offset || 0);

      // Add filters
      const f = opts.filters || filters;
      if (f.city) params.set("city", f.city);
      if (f.genres?.length) params.set("genres", f.genres.join(","));
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.priceMax) params.set("priceMax", f.priceMax);
      if (f.available) params.set("available", "true");
      if (f.sort) params.set("sort", f.sort);

      return `/api/search?${params.toString()}`;
    },
    [type, limit, filters],
  );

  // Execute search
  const executeSearch = useCallback(
    async (searchQuery, searchOffset = 0) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!searchQuery && type === "events") {
        // Empty query - could load featured/trending
        setResults([]);
        setTotalHits(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      abortControllerRef.current = new AbortController();

      try {
        const url = buildSearchUrl(searchQuery, { offset: searchOffset });
        const res = await fetch(url, {
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();

        if (searchOffset === 0) {
          setResults(data.hits || []);
        } else {
          // Append for pagination
          setResults((prev) => [...prev, ...(data.hits || [])]);
        }

        setTotalHits(data.totalHits || 0);
        setFacets(data.facetDistribution || {});
        setOffset(searchOffset);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          console.error("[Search] Error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [buildSearchUrl, type],
  );

  // Fetch suggestions (autocomplete)
  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`/api/search?type=suggestions&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("[Suggestions] Error:", err);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      executeSearch(query, 0);
      fetchSuggestions(query);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, executeSearch, fetchSuggestions]);

  // Re-search when filters change
  useEffect(() => {
    if (query) {
      executeSearch(query, 0);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more (pagination)
  const loadMore = useCallback(() => {
    const newOffset = offset + limit;
    if (newOffset < totalHits) {
      executeSearch(query, newOffset);
    }
  }, [offset, limit, totalHits, query, executeSearch]);

  // Update a single filter
  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => {
      if (value === null || value === undefined || value === "") {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setTotalHits(0);
    setOffset(0);
  }, []);

  return {
    // State
    query,
    results,
    suggestions,
    facets,
    totalHits,
    isLoading,
    error,
    filters,
    hasMore: offset + limit < totalHits,

    // Actions
    setQuery,
    loadMore,
    updateFilter,
    setFilters,
    clearFilters,
    clearSearch,
    refresh: () => executeSearch(query, 0),
  };
}

/**
 * SearchInput Component - Ready to use search bar
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search events, venues...",
  className = "",
  showClear = true,
}) {
  return (
    <div className={`search-input-wrapper ${className}`}>
      <svg
        className="search-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
      {showClear && value && (
        <button onClick={() => onChange("")} className="search-clear" aria-label="Clear search">
          ×
        </button>
      )}
    </div>
  );
}
