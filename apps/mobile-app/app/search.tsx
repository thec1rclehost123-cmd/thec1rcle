/**
 * Global Search Screen
 * Unified search for events, venues, and hosts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Keyboard, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchResultSkeleton } from '@/components/ui/Skeleton';
import { colors, radii, gradients } from '@/lib/design/theme';
import { trackScreen, trackSearch } from '@/lib/analytics';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '@/lib/api';
import {
  buildPublicSearchPath,
  mapPublicSearchResponse,
  type PublicSearchFilter,
  type PublicSearchResult,
} from '@/lib/publicSearch';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const RECENT_SEARCHES_KEY = '@recent_searches';
const MAX_RECENT_SEARCHES = 8;
const SEARCH_DEBOUNCE_MS = 300;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'events', label: 'Events' },
  { id: 'venues', label: 'Venues' },
  { id: 'hosts', label: 'Hosts' },
];

// Search result card
function SearchResultCard({
  result,
  index,
  onPress,
}: {
  result: PublicSearchResult;
  index: number;
  onPress: (posterTransitionTag: string) => void;
}) {
  const scale = useSharedValue(1);
  const posterTransitionTag = `poster-${result.id}-search-${index}`;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 250 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 250 });
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 40)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(posterTransitionTag);
      }}
      style={[animatedStyle, styles.resultCard]}
    >
      {/* Image */}
      {result.imageUrl ? (
        result.type === 'event' ? (
          <Animated.Image
            sharedTransitionTag={posterTransitionTag}
            source={{ uri: result.imageUrl }}
            style={styles.resultImage}
            resizeMode="cover"
          />
        ) : (
          <Image source={{ uri: result.imageUrl }} style={styles.resultImage} contentFit="cover" />
        )
      ) : (
        <View style={styles.resultImagePlaceholder}>
          <Text style={styles.resultImageEmoji}>
            {result.type === 'event' ? '🎉' : result.type === 'venue' ? '📍' : '🎧'}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {result.title}
        </Text>
        {result.subtitle && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {result.subtitle}
          </Text>
        )}
        <View style={styles.resultMeta}>
          <View
            style={[styles.resultTypeBadge, result.type === 'event' && styles.resultTypeBadgeEvent]}
          >
            <Text style={styles.resultTypeText}>
              {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.resultArrow}>›</Text>
    </AnimatedPressable>
  );
}

// Recent search item
function RecentSearchItem({
  query,
  onPress,
  onRemove,
  delay,
}: {
  query: string;
  onPress: () => void;
  onRemove: () => void;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.recentSearchItem}>
      <Pressable onPress={onPress} style={styles.recentSearchContent}>
        <Text style={styles.recentSearchIcon}>🕐</Text>
        <Text style={styles.recentSearchText}>{query}</Text>
      </Pressable>
      <Pressable onPress={onRemove} style={styles.recentSearchRemove}>
        <Text style={styles.recentSearchRemoveIcon}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

// Quick filter chip
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      {selected ? (
        <LinearGradient colors={gradients.primary as [string, string]} style={styles.filterChip}>
          <Text style={styles.filterChipTextSelected}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.filterChip, styles.filterChipInactive]}>
          <Text style={styles.filterChipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function SearchScreen() {
  const { filter: initialFilter } = useLocalSearchParams<{ filter?: string }>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PublicSearchFilter>(
    initialFilter === 'events' || initialFilter === 'venues' || initialFilter === 'hosts'
      ? initialFilter
      : 'all',
  );
  const [selectedCity, setSelectedCity] = useState('All Cities');
  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);

  useEffect(() => {
    trackScreen('Search');
    loadRecentSearches();
    InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
    });
  }, []);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const saveRecentSearch = async (searchQuery: string) => {
    try {
      const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(
        0,
        MAX_RECENT_SEARCHES,
      );
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  };

  const removeRecentSearch = async (searchQuery: string) => {
    try {
      const updated = recentSearches.filter((s) => s !== searchQuery);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Failed to remove recent search:', error);
    }
  };

  const performSearch = useCallback(
    async (
      searchQuery: string,
      overrides: { filter?: PublicSearchFilter; city?: string } = {},
    ) => {
      if (!searchQuery.trim()) {
        searchIdRef.current += 1;
        setResults([]);
        setHasSearched(false);
        setLoading(false);
        setError(null);
        return;
      }

      const searchId = ++searchIdRef.current;
      setLoading(true);
      setHasSearched(true);
      setError(null);

      try {
        const resolvedFilter = overrides.filter ?? activeFilter;
        const resolvedCity = overrides.city ?? selectedCity;
        const response = await apiFetch(
          buildPublicSearchPath(searchQuery, resolvedFilter, resolvedCity),
          { requireAuth: false },
        );

        if (searchId !== searchIdRef.current) return;
        const mapped = mapPublicSearchResponse(response as Record<string, any>, resolvedFilter);

        setResults(mapped);
        trackSearch(searchQuery, mapped.length, {
          filter: resolvedFilter,
          city: resolvedCity,
        });
      } catch (err: any) {
        if (searchId !== searchIdRef.current) return;
        setError(err.message || 'Search failed. Please try again.');
        setResults([]);
      } finally {
        if (searchId === searchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [activeFilter, selectedCity],
  );

  const debouncedSearch = useCallback(
    (text: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        performSearch(text);
      }, SEARCH_DEBOUNCE_MS);
    },
    [performSearch],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearch = () => {
    Keyboard.dismiss();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (query.trim()) {
      saveRecentSearch(query.trim());
      performSearch(query);
    }
  };

  const handleRecentSearchPress = (searchQuery: string) => {
    setQuery(searchQuery);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    saveRecentSearch(searchQuery);
    performSearch(searchQuery);
  };

  const handleResultPress = (result: PublicSearchResult, posterTransitionTag?: string) => {
    if (result.type === 'event') {
      router.push({
        pathname: '/event/[id]',
        params: {
          id: result.id,
          posterTransitionTag: posterTransitionTag || `poster-${result.id}`,
        },
      });
    } else if (result.type === 'venue') {
      const venueId = result.data?.venueId as string | undefined;
      if (venueId) {
        router.push(`/venue/${venueId}` as never);
      } else {
        router.push({
          pathname: '/search',
          params: { filter: 'venues', q: result.title },
        });
      }
    } else if (result.type === 'host') {
      const hostId = result.data?.hostId as string | undefined;
      if (hostId) {
        router.push(`/host/${hostId}` as never);
      } else {
        router.push({
          pathname: '/search',
          params: { filter: 'hosts', q: result.title },
        });
      }
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const clearQuery = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    searchIdRef.current += 1;
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setLoading(false);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.length > 2) {
                debouncedSearch(text);
              } else if (text.length === 0) {
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
                setResults([]);
                setHasSearched(false);
                setError(null);
              }
            }}
            placeholder="Search events, venues..."
            placeholderTextColor={colors.goldMetallic}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {query.length > 0 && (
            <Pressable onPress={clearQuery} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView
          bounces={false}
          overScrollMode="never"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        >
          {FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              selected={activeFilter === filter.id}
              onPress={() => {
                Haptics.selectionAsync();
                const nextFilter = filter.id as PublicSearchFilter;
                setActiveFilter(nextFilter);
                if (query) {
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }
                  performSearch(query, { filter: nextFilter });
                }
              }}
            />
          ))}

          <View style={styles.filterDivider} />

          {/* City filter */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Keyboard.dismiss();
              setIsCityPickerOpen(true);
            }}
            style={styles.cityFilter}
          >
            <Text style={styles.cityFilterIcon}>📍</Text>
            <Text style={styles.cityFilterText}>{selectedCity}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <SearchResultSkeleton count={4} />
          </View>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>
              {results.length} Result{results.length > 1 ? 's' : ''}
            </Text>
            {results.map((result, index) => (
              <SearchResultCard
                key={`${result.type}:${result.id}`}
                result={result}
                index={index}
                onPress={(posterTransitionTag) => handleResultPress(result, posterTransitionTag)}
              />
            ))}
          </View>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            type="error"
            message={error}
            actionLabel="Try Again"
            onAction={() => performSearch(query)}
          />
        )}

        {/* No results */}
        {!loading && !error && hasSearched && results.length === 0 && (
          <EmptyState
            type="no-search-results"
            message={`No results for "${query}". Try different keywords.`}
            actionLabel="Clear Search"
            onAction={clearQuery}
          />
        )}

        {/* Initial state - show recent and suggestions */}
        {!hasSearched && !loading && (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <Pressable
                    onPress={async () => {
                      setRecentSearches([]);
                      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </Pressable>
                </View>
                {recentSearches.map((search, index) => (
                  <RecentSearchItem
                    key={search}
                    query={search}
                    onPress={() => handleRecentSearchPress(search)}
                    onRemove={() => removeRecentSearch(search)}
                    delay={index * 30}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {isCityPickerOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setIsCityPickerOpen(false)}
          />
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#161616',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 16,
              paddingTop: 16,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#333' }} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16 }}>
                Select City
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {['All Cities', 'Mumbai', 'Delhi', 'Bangalore', 'Goa', 'Pune'].map((city) => (
                <Pressable
                  key={city}
                  style={{
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.05)',
                  }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (debounceTimerRef.current) {
                      clearTimeout(debounceTimerRef.current);
                      debounceTimerRef.current = null;
                    }
                    setSelectedCity(city);
                    setIsCityPickerOpen(false);
                    if (query) performSearch(query, { city });
                  }}
                >
                  <Text
                    style={{
                      color: selectedCity === city ? colors.gold : '#fff',
                      fontSize: 16,
                      fontWeight: selectedCity === city ? '700' : '500',
                    }}
                  >
                    {city}
                  </Text>
                  {selectedCity === city && <Text style={{ color: colors.gold }}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    marginRight: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.gold,
    fontSize: 16,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    color: colors.goldMetallic,
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '500',
  },
  filters: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  filtersList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  filterChipInactive: {
    backgroundColor: colors.base[50],
  },
  filterChipText: {
    color: colors.goldMetallic,
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  cityFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
  },
  cityFilterIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  cityFilterText: {
    color: colors.goldMetallic,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  clearAllText: {
    color: colors.iris,
    fontSize: 14,
    fontWeight: '500',
  },

  // Results
  resultsSection: {},
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 14,
  },
  resultImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: colors.base[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImageEmoji: {
    fontSize: 24,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultSubtitle: {
    color: colors.goldMetallic,
    fontSize: 13,
    marginBottom: 6,
  },
  resultMeta: {
    flexDirection: 'row',
  },
  resultTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  resultTypeBadgeEvent: {
    backgroundColor: 'rgba(244, 74, 34, 0.15)',
  },
  resultTypeText: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '500',
  },
  resultArrow: {
    color: colors.goldMetallic,
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
  },

  // Recent searches
  recentSection: {
    marginTop: 8,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  recentSearchContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentSearchIcon: {
    fontSize: 16,
    marginRight: 14,
  },
  recentSearchText: {
    color: colors.gold,
    fontSize: 16,
  },
  recentSearchRemove: {
    padding: 8,
  },
  recentSearchRemoveIcon: {
    color: colors.goldMetallic,
    fontSize: 14,
  },

});
