import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Venue } from '@/store/venuesStore';
import { colors } from '@/lib/design/theme';
import {
  formatCompactCount,
  formatDistance,
  getVenueDisplayName,
  getVenueLocationLabel,
} from '@/lib/venueDiscovery';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const ASPECT_RATIO = 4 / 5;
const CARD_HEIGHT = CARD_WIDTH / ASPECT_RATIO;

type VenueCardVenue = Venue & {
  distanceKm?: number | null;
};

export function VenueCard({ venue, onPress }: { venue: VenueCardVenue; onPress: () => void }) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const displayName = getVenueDisplayName(venue);
  const displayArea = getVenueLocationLabel(venue);
  const imageUrl =
    venue.coverImage || venue.coverURL || venue.bannerImage || venue.photoURL || venue.image;
  const tags = (venue.genres || venue.vibes || venue.tags || []).slice(0, 3);
  const distanceLabel = formatDistance(venue.distanceKm);

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View style={styles.card}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={500}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)']}
          style={styles.gradient}
        />

        <View style={styles.badgeContainer}>
          {venue.isVerified && (
            <BlurView
              intensity={30}
              tint="dark"
              style={[styles.badge, { backgroundColor: `${colors.iris}40` }]}
            >
              <Text style={[styles.badgeText, { color: colors.iris }]}>VERIFIED</Text>
            </BlurView>
          )}
          {venue.venueType ? (
            <BlurView intensity={30} tint="dark" style={styles.badge}>
              <Text style={styles.badgeText}>{venue.venueType}</Text>
            </BlurView>
          ) : null}
          {venue.tablesAvailable && (
            <BlurView intensity={30} tint="dark" style={[styles.badge, styles.specialBadge]}>
              <Text style={styles.badgeText}>Tables</Text>
            </BlurView>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.areaText} numberOfLines={1}>
            {displayArea}
          </Text>
          <Text style={styles.nameText} numberOfLines={1}>
            {displayName}
          </Text>

          {tags.length > 0 && (
            <View style={styles.tagContainer}>
              {tags.map((tag, idx) => (
                <BlurView key={`${tag}-${idx}`} intensity={20} tint="dark" style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </BlurView>
              ))}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{formatCompactCount(venue.followers)}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            {venue.upcomingEventsCount ? (
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{venue.upcomingEventsCount}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
            ) : null}
            {distanceLabel ? (
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{distanceLabel}</Text>
              </View>
            ) : null}
          </View>

          {venue.nextEventTitle ? (
            <Text style={styles.nextEventText} numberOfLines={1}>
              Next: {venue.nextEventTitle}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function VenueSkeleton() {
  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  card: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  badgeContainer: {
    position: 'absolute',
    top: 18,
    right: 18,
    alignItems: 'flex-end',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  specialBadge: {
    backgroundColor: 'rgba(244, 74, 34, 0.4)',
    borderColor: 'rgba(244, 74, 34, 0.25)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 22,
  },
  areaText: {
    color: colors.iris,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  nameText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextEventText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },
});
