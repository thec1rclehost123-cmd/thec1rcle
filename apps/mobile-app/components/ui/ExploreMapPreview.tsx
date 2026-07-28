import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { type Event } from '@/store/eventsStore';
import { colors, typography } from '@/lib/design/theme';

const DEFAULT_MAP_REGION = {
  latitude: 19.076,
  longitude: 72.8777,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

function hasFiniteCoordinates(event: Event) {
  return (
    Number.isFinite(Number(event.coordinates?.latitude)) &&
    Number.isFinite(Number(event.coordinates?.longitude))
  );
}

function SectionHeader({ title, onViewAll, viewAllLabel }: any) {
  const words = title.trim().split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.glowBar} />
        <Text style={styles.sectionTitle}>
          {firstPart}
          {firstPart ? ' ' : ''}
          <Text style={styles.sectionTitleAccent}>{lastWord}</Text>
        </Text>
      </View>
      {onViewAll && (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.viewAll}>{viewAllLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ExploreMapPreview({ events }: { events: Event[] }) {
  const eventsWithCoords = useMemo(() => {
    return events.filter(hasFiniteCoordinates);
  }, [events]);

  const initialRegion = useMemo(() => {
    if (eventsWithCoords.length > 0) {
      const first = eventsWithCoords[0].coordinates!;
      return {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return DEFAULT_MAP_REGION;
  }, [eventsWithCoords]);

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Explore on Map"
        onViewAll={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: '/map',
            params: {
              lat: initialRegion.latitude.toFixed(6),
              lng: initialRegion.longitude.toFixed(6),
              latDelta: initialRegion.latitudeDelta.toFixed(6),
              lngDelta: initialRegion.longitudeDelta.toFixed(6),
            },
          });
        }}
        viewAllLabel="View Map →"
      />
      <Pressable
        style={styles.mapCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: '/map',
            params: {
              lat: initialRegion.latitude.toFixed(6),
              lng: initialRegion.longitude.toFixed(6),
              latDelta: initialRegion.latitudeDelta.toFixed(6),
              lngDelta: initialRegion.longitudeDelta.toFixed(6),
            },
          });
        }}
      >
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          liteMode={true}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          userInterfaceStyle="dark"
          customMapStyle={darkMapStyle}
        >
          {eventsWithCoords.slice(0, 10).map((e) => (
            <Marker key={e.id} coordinate={e.coordinates!} pinColor="#F44A22" />
          ))}
        </MapView>
        <View style={styles.mapOverlay} />
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            📍 {eventsWithCoords.length || events.length} events nearby
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 44 },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glowBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.iris,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '800',
    color: colors.goldLight,
    letterSpacing: 0,
  },
  sectionTitleAccent: {
    color: colors.iris,
    textShadowColor: 'rgba(244,74,34,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  viewAll: { color: colors.iris, fontSize: typography.fontSize.base, fontWeight: '700' },
  mapCard: {
    marginHorizontal: 16,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  mapBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mapBadgeText: { color: colors.goldLight, fontSize: typography.fontSize.sm, fontWeight: '700' },
});
