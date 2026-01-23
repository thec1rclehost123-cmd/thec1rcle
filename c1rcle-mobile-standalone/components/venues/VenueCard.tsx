import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Venue, useVenuesStore } from '@/store/venuesStore';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/lib/design/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const ASPECT_RATIO = 4 / 5;
const CARD_HEIGHT = CARD_WIDTH / ASPECT_RATIO;

interface VenueCardProps {
    venue: Venue;
}

export const VenueCard: React.FC<VenueCardProps> = ({ venue }) => {
    const { user } = useAuthStore();
    const { followVenue, unfollowVenue } = useVenuesStore();

    // We would normally track follow status here or in the store
    const isFollowing = venue.isFollowing;

    const handleFollow = async () => {
        if (!user) {
            router.push("/(auth)/login");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (isFollowing) {
            await unfollowVenue(venue.id, user.uid);
        } else {
            await followVenue(venue.id, user.uid);
        }
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/venue/${venue.slug}`);
    };

    return (
        <Pressable onPress={handlePress} style={styles.container}>
            <View style={styles.card}>
                <Image
                    source={{ uri: venue.image }}
                    style={styles.image}
                    contentFit="cover"
                    transition={500}
                />

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
                    style={styles.gradient}
                />

                {/* Badges */}
                <View style={styles.badgeContainer}>
                    {venue.venueType && (
                        <BlurView intensity={30} tint="dark" style={styles.badge}>
                            <Text style={styles.badgeText}>{venue.venueType}</Text>
                        </BlurView>
                    )}
                    {venue.tablesAvailable && (
                        <BlurView intensity={30} tint="dark" style={[styles.badge, styles.specialBadge]}>
                            <Text style={styles.badgeText}>Tables Available</Text>
                        </BlurView>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.areaText}>{venue.area || venue.city}</Text>
                            <Text style={styles.nameText}>{venue.name}</Text>
                        </View>
                    </View>

                    {/* Tags */}
                    <View style={styles.tagContainer}>
                        {(venue.genres || venue.vibes || venue.tags || []).slice(0, 3).map((tag, index) => (
                            <BlurView key={index} intensity={20} tint="light" style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </BlurView>
                        ))}
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.followerText}>
                            {(venue.followers || 0).toLocaleString('en-IN')} Followers
                        </Text>
                        <Pressable
                            onPress={handleFollow}
                            style={({ pressed }) => [
                                styles.followButton,
                                isFollowing && styles.followingButton,
                                pressed && { opacity: 0.8 }
                            ]}
                        >
                            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Pressable>
    );
};

export const VenueSkeleton = () => {
    return (
        <View style={styles.container}>
            <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={styles.skeletonInfo}>
                    <View style={styles.skeletonLineShort} />
                    <View style={styles.skeletonLineLong} />
                </View>
            </View>
        </View>
    );
};

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
        top: 20,
        right: 20,
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
    },
    specialBadge: {
        backgroundColor: 'rgba(244, 74, 34, 0.4)',
        borderColor: 'rgba(244, 74, 34, 0.3)',
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
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    areaText: {
        color: colors.iris, // Using emerald-like color if available or iris
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 4,
    },
    nameText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tagText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    followerText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    followButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    followingButton: {
        backgroundColor: '#fff',
    },
    followButtonText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    followingButtonText: {
        color: '#000',
    },
    skeletonInfo: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
    },
    skeletonLineShort: {
        height: 12,
        width: '30%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        marginBottom: 8,
    },
    skeletonLineLong: {
        height: 24,
        width: '70%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
    },
});
