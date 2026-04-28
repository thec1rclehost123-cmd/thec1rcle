import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    Gesture,
    GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    FadeIn,
    runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radii } from '@/lib/design/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.8;

export interface GuestItem {
    id: string;
    name: string;
    avatarUrl?: string | null;
    initials?: string;
    isLiked?: boolean;
}

interface GuestlistBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    going?: GuestItem[];
    interested?: GuestItem[];
    loading?: boolean;
}

export function GuestlistBottomSheet({
    isVisible,
    onClose,
    going = [],
    interested = [],
    loading = false,
}: GuestlistBottomSheetProps) {
    const insets = useSafeAreaInsets();
    const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({});

    // Animation values
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const context = useSharedValue({ y: 0 });
    const opacity = useSharedValue(0);

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, context.value.y + event.translationY);
        })
        .onEnd((event) => {
            if (translateY.value > SHEET_HEIGHT / 3 || event.velocityY > 500) {
                translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
                    runOnJS(onClose)();
                });
            } else {
                translateY.value = withSpring(0, { damping: 20 });
            }
        });

    useEffect(() => {
        if (isVisible) {
            opacity.value = withTiming(1, { duration: 300 });
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 90,
                mass: 1,
            });
        } else {
            opacity.value = withTiming(0, { duration: 250 });
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        }
    }, [isVisible]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        display: opacity.value === 0 && !isVisible ? 'none' : 'flex',
    }));

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const toggleLike = (guestId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLocalLikes(prev => ({
            ...prev,
            [guestId]: !prev[guestId]
        }));
    };

    const renderGuest = (item: GuestItem, index: number) => {
        const isLiked = localLikes[item.id] || !!item.isLiked;
        const hasAvatar = !!item.avatarUrl && item.avatarUrl.length > 10;

        return (
            <Animated.View
                key={item.id}
                entering={FadeIn.delay(index * 30)}
                style={styles.guestCardWrapper}
            >
                <View style={styles.avatarWrapper}>
                    <Pressable
                        onPress={() => Haptics.selectionAsync()}
                        style={({ pressed }) => [
                            styles.avatarContainer,
                            pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }
                        ]}
                    >
                        {hasAvatar ? (
                            <Image
                                source={{ uri: item.avatarUrl! }}
                                style={styles.avatar}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                            />
                        ) : (
                            <LinearGradient
                                colors={["rgba(244, 74, 34, 0.25)", "rgba(244, 74, 34, 0.08)"]}
                                style={styles.avatarPlaceholder}
                            >
                                <Text style={styles.initialsText}>
                                    {item.initials || (item.name ? item.name.charAt(0).toUpperCase() : '?')}
                                </Text>
                            </LinearGradient>
                        )}
                    </Pressable>

                    {/* Like Button - Positioned absolutely relative to wrapper */}
                    <Pressable
                        onPress={() => toggleLike(item.id)}
                        style={styles.likeButton}
                    >
                        <View style={[styles.likeIconContainer, isLiked && styles.likeIconContainerActive]}>
                            <Ionicons
                                name={isLiked ? "heart" : "heart-outline"}
                                size={14}
                                color={isLiked ? "#fff" : "#A0A0A0"}
                            />
                        </View>
                    </Pressable>
                </View>
                <Text style={styles.guestName} numberOfLines={1}>{item.name}</Text>
            </Animated.View>
        );
    };

    const [shouldRender, setShouldRender] = useState(isVisible);

    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? 'auto' : 'none'}>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            {/* Bottom Sheet wrapper */}
            <GestureDetector gesture={gesture}>
                <Animated.View
                    style={[
                        styles.sheet,
                        { height: SHEET_HEIGHT, paddingBottom: insets.bottom },
                        sheetStyle
                    ]}
                >
                    {/* Grab Handle */}
                    <View style={styles.grabHandleContainer}>
                        <View style={styles.grabHandle} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Guestlist</Text>
                            <Text style={styles.subtitle}>
                                {going.length} {going.length === 1 ? 'person' : 'people'} going
                            </Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.closeButton,
                                pressed && { opacity: 0.7 }
                            ]}
                        >
                            <Ionicons name="close" size={24} color={colors.gold} />
                        </Pressable>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator color={colors.iris} size="large" />
                        </View>
                    ) : (going.length > 0 || interested.length > 0) ? (
                        <Animated.ScrollView
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Going Section */}
                            {going.length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.grid}>
                                        {going.map((item, index) => renderGuest(item, index))}
                                    </View>
                                </View>
                            )}

                            {/* Interested Section */}
                            {interested.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionHeader}>Interested ({interested.length})</Text>
                                    <View style={styles.grid}>
                                        {interested.map((item, index) => renderGuest(item, index + going.length))}
                                    </View>
                                </View>
                            )}
                        </Animated.ScrollView>
                    ) : (
                        <View style={styles.centerContainer}>
                            <Text style={styles.emptyText}>🎫</Text>
                            <Text style={styles.emptyTitle}>No guests yet</Text>
                            <Text style={styles.emptySubtitle}>Be the first to join this event!</Text>
                        </View>
                    )}
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#050505',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    grabHandleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    grabHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '800',
    },
    subtitle: {
        color: '#A0A0A0', // Fallback for goldMetallic if needed, but let's assume it exists in theme
        fontSize: 13,
        marginTop: 2,
        fontWeight: '500',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingTop: 10,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
        paddingHorizontal: 12,
    },
    sectionHeader: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        marginTop: 8,
        paddingLeft: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6, // Offset the padding of cards
    },
    guestCardWrapper: {
        width: '33.33%',
        alignItems: 'center',
        paddingVertical: 12,
    },
    avatarWrapper: {
        width: 100,
        height: 100,
        position: 'relative',
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#111',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialsText: {
        color: '#F44A22',
        fontSize: 28,
        fontWeight: '700',
    },
    likeButton: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        zIndex: 10,
    },
    likeIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#0B0B0B',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    likeIconContainerActive: {
        backgroundColor: '#F44A22', // Iris
        borderColor: '#F44A22',
    },
    guestName: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
        fontWeight: '500',
        width: 80,
        textAlign: 'center',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: '#A0A0A0',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
