import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { useEventsStore, type Event } from '@/store/eventsStore';
import { useVenuesStore, type Venue } from '@/store/venuesStore';
import { apiFetch } from '@/lib/api';
import { colors, radii, gradients } from '@/lib/design/theme';
import {
  calculateDistanceKm,
  type Coordinates,
  findKnownVenueCoordinates,
  formatCompactCount,
  formatDistance,
  getVenueDisplayName,
  getVenueLocationLabel,
} from '@/lib/venueDiscovery';
import { Skeleton } from '@/components/ui/Skeleton';

const DEFAULT_REGION = {
  latitude: 19.076,
  longitude: 72.8777,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const MAP_PIN_LIMIT = 100;
const MAP_REGION_DEBOUNCE_MS = 500;

type MapMode = 'events' | 'venues';

interface EventWithCoords extends Partial<Event> {
  id: string;
  venueId?: string;
  venueSlug?: string;
  resolvedCoords?: Coordinates;
}

type EventMapPin = {
  id: string;
  latitude: number;
  longitude: number;
  heatScore?: number;
};

type MapBounds = {
  northEastLat: number;
  northEastLng: number;
  southWestLat: number;
  southWestLng: number;
};

interface VenueWithCoords extends Venue {
  resolvedCoords: Coordinates;
  distanceKm?: number | null;
}

interface EventCluster {
  key: string;
  coordinate: Coordinates;
  events: EventWithCoords[];
  venueId?: string;
  venueSlug?: string;
  venueName: string;
}

function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delayMs);
  };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
  return debounced;
}

function normalizeLongitude(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value === 180 || value === -180) return value;
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function boundsFromRegion(region: Region): MapBounds {
  const halfLat = Math.max(region.latitudeDelta, 0.001) / 2;
  const halfLng = Math.max(region.longitudeDelta, 0.001) / 2;
  const spansWorld = region.longitudeDelta >= 360;

  return {
    northEastLat: Math.min(90, region.latitude + halfLat),
    northEastLng: spansWorld ? 180 : normalizeLongitude(region.longitude + halfLng),
    southWestLat: Math.max(-90, region.latitude - halfLat),
    southWestLng: spansWorld ? -180 : normalizeLongitude(region.longitude - halfLng),
  };
}

function buildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

async function fetchEventMapPins(region: Region): Promise<EventMapPin[]> {
  const bounds = boundsFromRegion(region);
  const response = await apiFetch<{ pins?: EventMapPin[]; data?: { pins?: EventMapPin[] } }>(
    `/api/v1/events/map?${buildQuery({ ...bounds, limit: MAP_PIN_LIMIT })}`,
    { requireAuth: false },
  );
  return response.pins || response.data?.pins || [];
}

function eventFromPin(pin: EventMapPin): EventWithCoords {
  return {
    id: pin.id,
    title: 'Event nearby',
    startDate: '',
    venue: 'Nearby',
    heatScore: pin.heatScore,
    resolvedCoords: {
      latitude: pin.latitude,
      longitude: pin.longitude,
    },
  };
}

function normalizeParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function geocodeVenue(
  venue?: string,
  location?: string,
  city?: string,
): Promise<Coordinates | null> {
  const known = findKnownVenueCoordinates(venue, location, city);
  if (known) {
    return known;
  }

  const searchText = [venue, location, city].filter(Boolean).join(', ');
  if (!searchText) {
    return null;
  }

  try {
    const results = await Location.geocodeAsync(searchText);
    if (!results.length) {
      return null;
    }

    return {
      latitude: results[0].latitude,
      longitude: results[0].longitude,
    };
  } catch (error) {
    console.warn('[Map] Geocoding failed:', error);
    return null;
  }
}

function getEventPriceLabel(event: Partial<Event>): string {
  const tickets = Array.isArray(event.tickets) ? event.tickets : [];
  const price =
    tickets.reduce((min, tier) => (tier.price < min ? tier.price : min), tickets[0]?.price || 0) ||
    event.minPrice;

  if (price === undefined || price === null) {
    return 'Details';
  }

  return price === 0 ? 'Free' : `₹${price}`;
}

function getDirectionsUrl(coords: Coordinates, label: string): string {
  if (Platform.OS === 'ios') {
    return `maps:0,0?q=${encodeURIComponent(label)}@${coords.latitude},${coords.longitude}`;
  }

  return `geo:0,0?q=${coords.latitude},${coords.longitude}(${encodeURIComponent(label)})`;
}

async function openDirections(coords: Coordinates, label: string) {
  try {
    await Linking.openURL(getDirectionsUrl(coords, label));
  } catch {
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`,
    );
  }
}

function MapEventCard({ cluster, onPress }: { cluster: EventCluster; onPress: () => void }) {
  const event = cluster.events[0];
  const formattedDate = event.startDate
    ? new Date(event.startDate).toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Tap for details';
  const imageUrl = event.coverImage || event.poster || event.image;
  const posterTransitionTag = `poster-${event.id}-map`;
  const venueName = cluster.venueName || event.venue || event.location || 'Nearby';

  return (
    <Pressable onPress={onPress} style={mapStyles.eventCard}>
      {imageUrl ? (
        <Animated.Image
          sharedTransitionTag={posterTransitionTag}
          source={{ uri: imageUrl }}
          style={mapStyles.eventCardImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={gradients.primary as [string, string]}
          style={mapStyles.eventCardImage}
        >
          <Text style={mapStyles.cardFallbackEmoji}>🎉</Text>
        </LinearGradient>
      )}

      <View style={mapStyles.eventCardContent}>
        <Text style={mapStyles.eventCardEyebrow} numberOfLines={1}>
          {cluster.events.length > 1
            ? `${cluster.events.length} events at ${venueName}`
            : venueName}
        </Text>
        <Text style={mapStyles.eventCardTitle} numberOfLines={1}>
          {event.title || 'Event nearby'}
        </Text>
        <View style={mapStyles.eventCardFooter}>
          <Text style={mapStyles.eventCardDate}>{formattedDate}</Text>
          <Text style={mapStyles.eventCardPrice}>{getEventPriceLabel(event)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MapVenueCard({ venue, onPress }: { venue: VenueWithCoords; onPress: () => void }) {
  const imageUrl =
    venue.coverImage || venue.coverURL || venue.bannerImage || venue.photoURL || venue.image;
  const distanceLabel = formatDistance(venue.distanceKm);

  return (
    <Pressable onPress={onPress} style={mapStyles.eventCard}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={mapStyles.eventCardImage} contentFit="cover" />
      ) : (
        <LinearGradient colors={['#0F2D3A', '#11251F']} style={mapStyles.eventCardImage}>
          <Text style={mapStyles.cardFallbackEmoji}>📍</Text>
        </LinearGradient>
      )}

      <View style={mapStyles.eventCardContent}>
        <Text style={mapStyles.eventCardEyebrow} numberOfLines={1}>
          {getVenueLocationLabel(venue) || 'Venue'}
        </Text>
        <Text style={mapStyles.eventCardTitle} numberOfLines={1}>
          {getVenueDisplayName(venue)}
        </Text>
        <View style={mapStyles.venueStatRow}>
          <Text style={mapStyles.eventCardDate}>
            {formatCompactCount(venue.followers)} following
          </Text>
          {venue.upcomingEventsCount ? (
            <Text style={mapStyles.eventCardDate}>{venue.upcomingEventsCount} upcoming</Text>
          ) : null}
        </View>
        {distanceLabel ? <Text style={mapStyles.distanceText}>{distanceLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function MapScreen() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    venueId?: string | string[];
    mode?: string | string[];
    lat?: string | string[];
    lng?: string | string[];
    latDelta?: string | string[];
    lngDelta?: string | string[];
  }>();
  const requestedEventId = normalizeParam(params.eventId);
  const requestedVenueId = normalizeParam(params.venueId);
  const requestedMode = normalizeParam(params.mode) === 'venues' ? 'venues' : 'events';
  const initialLat = normalizeParam(params.lat);
  const initialLng = normalizeParam(params.lng);
  const initialLatDelta = normalizeParam(params.latDelta);
  const initialLngDelta = normalizeParam(params.lngDelta);

  const fetchVenues = useVenuesStore((state) => state.fetchVenues);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const eventDetailCacheRef = useRef(new Map<string, EventWithCoords>());
  const currentRegionRef = useRef<Region>(DEFAULT_REGION);
  const hasInitializedMapRef = useRef(false);

  const [mapMode, setMapMode] = useState<MapMode>(requestedMode);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [eventsWithCoords, setEventsWithCoords] = useState<EventWithCoords[]>([]);
  const [venuesWithCoords, setVenuesWithCoords] = useState<VenueWithCoords[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<EventCluster | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueWithCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);

  useEffect(() => {
    setMapMode(requestedMode);
  }, [requestedMode]);

  const loadEventPinsForRegion = useCallback(async (region: Region, showLoading = false) => {
    if (showLoading) setLoading(true);
    setMapError(null);
    try {
      const pins = await fetchEventMapPins(region);
      const nextEvents = pins.map((pin) => {
        const base = eventFromPin(pin);
        const cached = eventDetailCacheRef.current.get(pin.id);
        return {
          ...base,
          ...cached,
          heatScore: pin.heatScore ?? cached?.heatScore,
          resolvedCoords: base.resolvedCoords,
        };
      });
      setEventsWithCoords(nextEvents);
    } catch (error) {
      console.warn('[Map] Failed to fetch bounded event pins:', error);
      setMapError('Could not load events. Pull down to retry.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const loadVenuesForMap = useCallback(
    async (resolvedUserLocation: Coordinates | null) => {
      if (useVenuesStore.getState().venues.length === 0) {
        await fetchVenues();
      }

      const venueItems = useVenuesStore.getState().venues;
      const resolvedVenues = venueItems
        .map((venue) => {
          const coords =
            venue.coordinates ||
            findKnownVenueCoordinates(
              venue.displayName,
              venue.name,
              venue.neighborhood,
              venue.area,
              venue.city,
              venue.address,
            );

          if (!coords) {
            return null;
          }

          return {
            ...venue,
            resolvedCoords: coords,
            distanceKm: resolvedUserLocation
              ? calculateDistanceKm(resolvedUserLocation, coords)
              : null,
          } as VenueWithCoords;
        })
        .filter((venue): venue is VenueWithCoords => Boolean(venue))
        .sort((left, right) => {
          const leftDistance = left.distanceKm ?? null;
          const rightDistance = right.distanceKm ?? null;

          if (leftDistance !== null && rightDistance !== null) {
            return leftDistance - rightDistance;
          }
          return (right.popularityScore || 0) - (left.popularityScore || 0);
        });

      setVenuesWithCoords(resolvedVenues);
      return resolvedVenues;
    },
    [fetchVenues],
  );

  const resolveEventDetail = useCallback(async (event: EventWithCoords) => {
    const cached = eventDetailCacheRef.current.get(event.id);
    if (cached && cached.title && cached.title !== 'Event nearby') return cached;

    const detail = await useEventsStore.getState().getEventById(event.id);
    if (!detail) return event;

    const resolvedCoords =
      detail.coordinates ||
      event.resolvedCoords ||
      findKnownVenueCoordinates(detail.venue, detail.location, detail.city) ||
      (await geocodeVenue(detail.venue, detail.location, detail.city));

    const hydrated = {
      ...event,
      ...detail,
      venueId: detail.venueId || event.venueId,
      resolvedCoords: resolvedCoords || event.resolvedCoords,
    } as EventWithCoords;
    eventDetailCacheRef.current.set(event.id, hydrated);
    return hydrated;
  }, []);

  const hydrateClusterDetails = useCallback(
    async (cluster: EventCluster) => {
      const hydratedEvents = await Promise.all(cluster.events.slice(0, 3).map(resolveEventDetail));
      const hydratedById = new Map(hydratedEvents.map((event) => [event.id, event]));

      setEventsWithCoords((current) => current.map((event) => hydratedById.get(event.id) || event));
      setSelectedCluster((current) =>
        current?.key === cluster.key
          ? {
              ...current,
              events: current.events.map((event) => hydratedById.get(event.id) || event),
            }
          : current,
      );
    },
    [resolveEventDetail],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      setLoading(true);
      let resolvedUserLocation: Coordinates | null = null;
      let initialRegion: Region = DEFAULT_REGION;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          resolvedUserLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          initialRegion = {
            ...resolvedUserLocation,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
        }
      } catch (error) {
        console.warn('[Map] Location permission error:', error);
      }

      if (cancelled) return;
      currentRegionRef.current = initialRegion;
      setUserLocation(resolvedUserLocation);
      if (resolvedUserLocation) {
        setTimeout(() => {
          mapRef.current?.animateToRegion(initialRegion, 600);
        }, 450);
      }

      try {
        await Promise.all([
          loadEventPinsForRegion(initialRegion),
          requestedMode === 'venues' || requestedVenueId
            ? loadVenuesForMap(resolvedUserLocation)
            : Promise.resolve(),
        ]);
      } finally {
        hasInitializedMapRef.current = true;
        if (!cancelled) setLoading(false);
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
    };
  }, [loadEventPinsForRegion, loadVenuesForMap, requestedMode, requestedVenueId]);

  const eventClusters = useMemo(() => {
    const grouped = new Map<string, EventCluster>();

    eventsWithCoords.forEach((event) => {
      if (!event.resolvedCoords) {
        return;
      }

      const key =
        event.venueId ||
        event.venueSlug ||
        `${event.resolvedCoords.latitude.toFixed(4)}:${event.resolvedCoords.longitude.toFixed(4)}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.events.push(event);
        return;
      }

      grouped.set(key, {
        key,
        coordinate: event.resolvedCoords,
        events: [event],
        venueId: event.venueId,
        venueSlug: event.venueSlug,
        venueName: event.venue || event.location || event.title || 'Nearby',
      });
    });

    return [...grouped.values()]
      .map((cluster) => ({
        ...cluster,
        events: [...cluster.events].sort(
          (left, right) => Date.parse(left.startDate || '') - Date.parse(right.startDate || ''),
        ),
      }))
      .sort((left, right) => right.events.length - left.events.length);
  }, [eventsWithCoords]);

  const venueClustersWithinBounds = useMemo(() => {
    if (mapMode !== 'venues' || !currentRegion) return venuesWithCoords;
    const bounds = boundsFromRegion(currentRegion);
    return venuesWithCoords.filter((venue) => {
      const { latitude, longitude } = venue.resolvedCoords;
      return (
        latitude >= bounds.southWestLat &&
        latitude <= bounds.northEastLat &&
        longitude >= bounds.southWestLng &&
        longitude <= bounds.northEastLng
      );
    });
  }, [venuesWithCoords, currentRegion, mapMode]);

  const topPopularEvents = useMemo(() => {
    if (mapMode !== 'events' || eventClusters.length === 0) return [];
    return [...eventClusters]
      .sort((a, b) => {
        const aScore = Math.max(...a.events.map((e) => e.heatScore || 0));
        const bScore = Math.max(...b.events.map((e) => e.heatScore || 0));
        return bScore - aScore;
      })
      .slice(0, 6);
  }, [eventClusters, mapMode]);

  const debouncedLoadEventPins = useMemo(
    () =>
      debounce((region: Region) => {
        void loadEventPinsForRegion(region);
      }, MAP_REGION_DEBOUNCE_MS),
    [loadEventPinsForRegion],
  );

  useEffect(() => {
    return () => debouncedLoadEventPins.cancel();
  }, [debouncedLoadEventPins]);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      currentRegionRef.current = region;
      setCurrentRegion(region);
      setSuggestionsCollapsed(false);
      if (mapMode === 'events') {
        setSelectedCluster(null);
        debouncedLoadEventPins(region);
      } else {
        setSelectedVenue(null);
      }
    },
    [debouncedLoadEventPins, mapMode],
  );

  const handleSelectCluster = useCallback(
    (cluster: EventCluster) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCluster(cluster);
      setSelectedVenue(null);
      void hydrateClusterDetails(cluster);
    },
    [hydrateClusterDetails],
  );

  useEffect(() => {
    if (!hasInitializedMapRef.current) return;
    if (mapMode === 'events') {
      void loadEventPinsForRegion(currentRegionRef.current);
    } else if (venuesWithCoords.length === 0) {
      void loadVenuesForMap(userLocation);
    }
  }, [loadEventPinsForRegion, loadVenuesForMap, mapMode, userLocation, venuesWithCoords.length]);

  useEffect(() => {
    if (!requestedEventId) return;
    let active = true;

    async function focusRequestedEvent() {
      const hydrated = await resolveEventDetail({
        id: requestedEventId!,
        title: 'Event nearby',
        startDate: '',
        venue: 'Nearby',
      });
      if (!active || !hydrated.resolvedCoords) return;
      setMapMode('events');
      setSelectedVenue(null);
      setEventsWithCoords((current) => {
        const exists = current.some((event) => event.id === hydrated.id);
        if (exists) {
          return current.map((event) => (event.id === hydrated.id ? hydrated : event));
        }
        return [hydrated, ...current];
      });
    }

    void focusRequestedEvent();
    return () => {
      active = false;
    };
  }, [requestedEventId, resolveEventDetail]);

  useEffect(() => {
    if (!requestedVenueId || venuesWithCoords.length === 0) return;

    const focusVenue = venuesWithCoords.find(
      (venue) => venue.id === requestedVenueId || venue.slug === requestedVenueId,
    );
    if (!focusVenue) return;

    setMapMode('venues');
    setSelectedCluster(null);
    setSelectedVenue(focusVenue);
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          ...focusVenue.resolvedCoords,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        800,
      );
    }, 450);
  }, [requestedVenueId, venuesWithCoords]);

  useEffect(() => {
    if (!requestedEventId || !eventClusters.length) {
      return;
    }

    const targetCluster = eventClusters.find((cluster) =>
      cluster.events.some((event) => event.id === requestedEventId),
    );

    if (!targetCluster) {
      return;
    }

    setSelectedCluster(targetCluster);
    setSelectedVenue(null);

    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          ...targetCluster.coordinate,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        800,
      );
    }, 350);
  }, [eventClusters, requestedEventId]);

  const initialRegion = useMemo(() => {
    if (initialLat && initialLng && initialLatDelta && initialLngDelta) {
      return {
        latitude: Number(initialLat),
        longitude: Number(initialLng),
        latitudeDelta: Number(initialLatDelta),
        longitudeDelta: Number(initialLngDelta),
      };
    }

    if (userLocation) {
      return { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }

    if (mapMode === 'venues' && venuesWithCoords.length > 0) {
      return {
        ...venuesWithCoords[0].resolvedCoords,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
    }

    if (eventClusters.length > 0) {
      return {
        ...eventClusters[0].coordinate,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      };
    }

    return DEFAULT_REGION;
  }, [
    eventClusters,
    initialLat,
    initialLatDelta,
    initialLng,
    initialLngDelta,
    mapMode,
    userLocation,
    venuesWithCoords,
  ]);

  const subtitle = useMemo(() => {
    if (mapMode === 'venues') {
      const shown = venueClustersWithinBounds.length;
      const total = venuesWithCoords.length;
      return shown < total ? `${shown} of ${total} venues shown` : `${total} venues mapped`;
    }
    return `${eventClusters.length} hotspots nearby`;
  }, [eventClusters.length, mapMode, venueClustersWithinBounds.length, venuesWithCoords.length]);

  return (
    <View style={mapStyles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
        customMapStyle={darkMapStyle}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {mapReady && mapMode === 'events'
          ? eventClusters.map((cluster) => {
              const isSelected = selectedCluster?.key === cluster.key;
              const markerCount = cluster.events.length;

              return (
                <Marker
                  key={cluster.key}
                  coordinate={cluster.coordinate}
                  onPress={() => handleSelectCluster(cluster)}
                >
                  <View style={mapStyles.markerContainer}>
                    <LinearGradient
                      colors={
                        isSelected
                          ? (gradients.primary as [string, string])
                          : markerCount > 1
                            ? ['rgba(13, 161, 146, 0.92)', 'rgba(13, 161, 146, 0.68)']
                            : ['rgba(244, 74, 34, 0.82)', 'rgba(244, 74, 34, 0.56)']
                      }
                      style={[
                        mapStyles.markerGradient,
                        isSelected && mapStyles.markerSelected,
                        markerCount > 1 && mapStyles.markerGradientCluster,
                      ]}
                    >
                      <Text style={markerCount > 1 ? mapStyles.markerCount : mapStyles.markerEmoji}>
                        {markerCount > 1 ? markerCount : '🎉'}
                      </Text>
                    </LinearGradient>
                    <View style={mapStyles.markerArrow} />
                  </View>
                </Marker>
              );
            })
          : mapReady
            ? venueClustersWithinBounds.map((venue) => {
                const isSelected = selectedVenue?.id === venue.id;
                const markerLabel = venue.upcomingEventsCount
                  ? `${Math.min(venue.upcomingEventsCount, 99)}`
                  : 'V';

                return (
                  <Marker
                    key={venue.id}
                    coordinate={venue.resolvedCoords}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedVenue(venue);
                      setSelectedCluster(null);
                    }}
                  >
                    <View style={mapStyles.markerContainer}>
                      <LinearGradient
                        colors={
                          isSelected
                            ? ['#F4B942', '#F44A22']
                            : ['rgba(24, 112, 77, 0.9)', 'rgba(24, 112, 77, 0.62)']
                        }
                        style={[mapStyles.markerGradient, isSelected && mapStyles.markerSelected]}
                      >
                        <Text style={mapStyles.markerCount}>{markerLabel}</Text>
                      </LinearGradient>
                      <View style={mapStyles.markerArrow} />
                    </View>
                  </Marker>
                );
              })
            : null}
      </MapView>

      {loading ? (
        <View style={mapStyles.loadingOverlay}>
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={60}
            tint="dark"
            style={mapStyles.loadingBlur}
          >
            <View style={mapStyles.mapSkeletonCard}>
              <Skeleton width={54} height={54} borderRadius={27} />
              <View style={mapStyles.mapSkeletonCopy}>
                <Skeleton width={160} height={14} borderRadius={7} />
                <Skeleton width={220} height={12} borderRadius={6} />
              </View>
            </View>
            <Text style={mapStyles.loadingText}>Building the city map...</Text>
          </BlurView>
        </View>
      ) : null}

      {mapError && !loading ? (
        <View style={mapStyles.loadingOverlay}>
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={60}
            tint="dark"
            style={mapStyles.loadingBlur}
          >
            <Text style={[mapStyles.loadingText, { textAlign: 'center' }]}>{mapError}</Text>
            <Pressable
              onPress={() => {
                void loadEventPinsForRegion(currentRegionRef.current);
              }}
              style={{
                marginTop: 12,
                paddingVertical: 8,
                paddingHorizontal: 20,
                backgroundColor: colors.iris,
                borderRadius: radii.pill,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry</Text>
            </Pressable>
          </BlurView>
        </View>
      ) : null}

      <SafeAreaView edges={['top']} style={mapStyles.topBar}>
        <View style={mapStyles.topBarContent}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
            style={mapStyles.backButton}
          >
            <BlurView
              blurMethod="dimezisBlurView"
              intensity={40}
              tint="dark"
              style={mapStyles.backButtonBlur}
            >
              <Text style={mapStyles.backButtonText}>←</Text>
            </BlurView>
          </Pressable>

          <View style={mapStyles.titleContainer}>
            <Text style={mapStyles.titleText}>
              {mapMode === 'events' ? 'Event Map' : 'Venue Map'}
            </Text>
            <Text style={mapStyles.subtitleText}>{subtitle}</Text>
          </View>

          <Pressable
            onPress={() => {
              if (!userLocation) {
                return;
              }

              mapRef.current?.animateToRegion(
                {
                  ...userLocation,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                },
                600,
              );
            }}
            style={mapStyles.locationButton}
          >
            <BlurView
              blurMethod="dimezisBlurView"
              intensity={40}
              tint="dark"
              style={mapStyles.backButtonBlur}
            >
              <Text style={mapStyles.backButtonText}>📍</Text>
            </BlurView>
          </Pressable>
        </View>

        <View style={mapStyles.modeSwitchRow}>
          {(['events', 'venues'] as MapMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMapMode(mode);
                if (mode === 'events') {
                  setSelectedVenue(null);
                } else {
                  setSelectedCluster(null);
                }
              }}
              style={[mapStyles.modeChip, mapMode === mode && mapStyles.modeChipActive]}
            >
              <Text
                style={[mapStyles.modeChipText, mapMode === mode && mapStyles.modeChipTextActive]}
              >
                {mode === 'events' ? 'Events' : 'Venues'}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {mapMode === 'events' && topPopularEvents.length > 0 && !suggestionsCollapsed ? (
        <View style={mapStyles.suggestionsContainer}>
          <View style={mapStyles.suggestionsRow}>
            <Text style={mapStyles.suggestionsLabel}>🔥 Popular</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={mapStyles.suggestionsScroll}
            >
              {topPopularEvents.map((cluster) => {
                const event = cluster.events[0];
                const title = event.title || 'Event';
                return (
                  <Pressable
                    key={cluster.key}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSuggestionsCollapsed(true);
                      handleSelectCluster(cluster);
                      mapRef.current?.animateToRegion(
                        {
                          ...cluster.coordinate,
                          latitudeDelta: 0.012,
                          longitudeDelta: 0.012,
                        },
                        600,
                      );
                    }}
                    style={mapStyles.suggestionPill}
                  >
                    <Text style={mapStyles.suggestionPillText} numberOfLines={1}>
                      🎉 {title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => setSuggestionsCollapsed(true)}
              hitSlop={8}
              style={mapStyles.suggestionsClose}
            >
              <Text style={mapStyles.suggestionsCloseText}>✕</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {mapMode === 'events' && selectedCluster ? (
        <Animated.View
          entering={SlideInUp.duration(250)}
          style={[mapStyles.bottomCard, { paddingBottom: insets.bottom + 8 }]}
        >
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={mapStyles.bottomCardInner}>
            <MapEventCard
              cluster={selectedCluster}
              onPress={() =>
                router.push({
                  pathname: '/event/[id]',
                  params: {
                    id: selectedCluster.events[0].id,
                    posterTransitionTag: `poster-${selectedCluster.events[0].id}-map`,
                  },
                })
              }
            />

            <View style={mapStyles.bottomActions}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: '/event/[id]',
                    params: {
                      id: selectedCluster.events[0].id,
                      posterTransitionTag: `poster-${selectedCluster.events[0].id}-map`,
                    },
                  });
                }}
                style={mapStyles.viewButton}
              >
                <LinearGradient
                  colors={gradients.primary as [string, string]}
                  style={mapStyles.viewButtonGradient}
                >
                  <Text style={mapStyles.viewButtonText}>View Event</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => {
                  const targetVenue =
                    (selectedCluster.venueId &&
                      venuesWithCoords.find((venue) => venue.id === selectedCluster.venueId)) ||
                    (selectedCluster.venueSlug &&
                      venuesWithCoords.find((venue) => venue.slug === selectedCluster.venueSlug));

                  if (targetVenue) {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/venue/${targetVenue.slug || targetVenue.id}` as never);
                    return;
                  }

                  if (selectedCluster.events[0].resolvedCoords) {
                    void openDirections(
                      selectedCluster.events[0].resolvedCoords,
                      selectedCluster.venueName,
                    );
                  }
                }}
                style={mapStyles.directionsButton}
              >
                <Text style={mapStyles.directionsButtonText}>
                  {selectedCluster.events.length > 1 ? 'Venue Page' : 'Directions'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {mapMode === 'venues' && selectedVenue ? (
        <Animated.View
          entering={SlideInUp.duration(250)}
          style={[mapStyles.bottomCard, { paddingBottom: insets.bottom + 8 }]}
        >
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={mapStyles.bottomCardInner}>
            <MapVenueCard
              venue={selectedVenue}
              onPress={() =>
                router.push(`/venue/${selectedVenue.slug || selectedVenue.id}` as never)
              }
            />

            <View style={mapStyles.bottomActions}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push(`/venue/${selectedVenue.slug || selectedVenue.id}` as never);
                }}
                style={mapStyles.viewButton}
              >
                <LinearGradient
                  colors={['#F4B942', '#F44A22']}
                  style={mapStyles.viewButtonGradient}
                >
                  <Text style={mapStyles.viewButtonText}>View Venue</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void openDirections(
                    selectedVenue.resolvedCoords,
                    getVenueDisplayName(selectedVenue),
                  );
                }}
                style={mapStyles.directionsButton}
              >
                <Text style={mapStyles.directionsButtonText}>Directions</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a2e1a' }, { visibility: 'simplified' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212121' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
];

const mapStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1d1d1d',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerGradient: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  markerGradientCluster: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  markerSelected: {
    transform: [{ scale: 1.14 }],
  },
  markerEmoji: {
    fontSize: 18,
  },
  markerCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(244, 74, 34, 0.6)',
    marginTop: -2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingBlur: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: radii.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapSkeletonCard: {
    width: 260,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mapSkeletonCopy: {
    flex: 1,
    gap: 10,
  },
  loadingText: {
    color: colors.gold,
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {},
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  titleText: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitleText: {
    color: colors.goldMetallic,
    fontSize: 12,
    marginTop: 2,
  },
  locationButton: {},
  modeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  modeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeChipActive: {
    backgroundColor: 'rgba(244,74,34,0.2)',
    borderColor: 'rgba(244,74,34,0.35)',
  },
  modeChipText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modeChipTextActive: {
    color: '#fff',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    overflow: 'hidden',
  },
  bottomCardInner: {
    padding: 16,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  eventCardImage: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFallbackEmoji: {
    fontSize: 24,
  },
  eventCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  eventCardEyebrow: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eventCardTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventCardDate: {
    color: colors.goldDark,
    fontSize: 12,
    fontWeight: '600',
  },
  eventCardPrice: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  venueStatRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  distanceText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  viewButton: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  viewButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  directionsButton: {
    minWidth: 120,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 170,
    left: 0,
    right: 0,
    zIndex: 90,
    paddingHorizontal: 12,
  },
  suggestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionsLabel: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  suggestionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: 200,
  },
  suggestionPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionsClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  suggestionsCloseText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
});
