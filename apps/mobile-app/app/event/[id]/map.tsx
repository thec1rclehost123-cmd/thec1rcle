import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useEventsStore } from '@/store/eventsStore';
import { findKnownVenueCoordinates } from '@/lib/venueDiscovery';
import { colors, gradients } from '@/lib/design/theme';

export default function EventDetailMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEventsStore((state) => state.events.find((e) => e.id === id));

  const coords = useMemo(() => {
    if (!event) return null;
    return (
      event.coordinates ||
      findKnownVenueCoordinates(event.venue, event.location, event.city) ||
      null
    );
  }, [event]);

  if (!event || !coords) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Location Unavailable</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>We couldn't find the exact coordinates for this event.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDirections = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const label = event.venue || event.location || 'Event Venue';
    const iosUrl = `maps:0,0?q=${encodeURIComponent(label)}@${coords.latitude},${coords.longitude}`;
    const androidUrl = `geo:0,0?q=${coords.latitude},${coords.longitude}(${encodeURIComponent(label)})`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;

    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL(iosUrl);
      } else {
        await Linking.openURL(androidUrl);
      }
    } catch {
      await Linking.openURL(fallbackUrl);
    }
  };

  const formattedDate = event.startDate
    ? new Date(event.startDate).toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const imageUrl = event.coverImage || event.poster || event.image;
  const venueName = event.venue || event.location || 'Nearby';

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
      >
        <Marker
          coordinate={{ latitude: coords.latitude, longitude: coords.longitude }}
          tracksViewChanges={false}
        >
          <View style={styles.markerContainer}>
            <View style={styles.markerPin}>
              <Text style={styles.markerEmoji}>📍</Text>
            </View>
            <View style={styles.markerTriangle} />
          </View>
        </Marker>
      </MapView>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }} 
            style={styles.backBtn}
          >
            <ChevronLeft size={28} color="#FFF" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Event Map</Text>
          </View>
          <View style={styles.backBtnPlaceholder} />
        </View>

        <View style={styles.footer}>
          <View style={styles.card}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.cardImage} contentFit="cover" />
            ) : (
              <LinearGradient colors={gradients.primary as [string, string]} style={styles.cardImage} />
            )}
            
            <View style={styles.cardContent}>
              <Text style={styles.cardEyebrow} numberOfLines={1}>
                {venueName}
              </Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.cardDate}>{formattedDate}</Text>
            </View>
          </View>

          <Pressable onPress={handleDirections} style={styles.directionsBtn}>
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backBtnPlaceholder: {
    width: 44,
  },
  headerTitleWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardEyebrow: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  directionsBtn: {
    backgroundColor: colors.iris,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionsBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  markerEmoji: {
    fontSize: 20,
  },
  markerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFF',
    marginTop: -2,
  },
});
