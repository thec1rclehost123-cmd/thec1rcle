import React, { memo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Event } from "@/store/eventsStore";
import { EventCard } from "@/components/ui/EventCard";
import { colors, gradients, radii } from "@/lib/design/theme";
import { formatEventDate } from "@/lib/utils/formatters";
import Animated, { FadeInRight } from "react-native-reanimated";

interface HorizontalSectionProps {
    title: string;
    events: Event[];
    icon?: keyof typeof Ionicons.glyphMap;
    onSeeAll?: () => void;
}

export const HorizontalSection = memo(({ title, events, icon = "sparkles", onSeeAll }: HorizontalSectionProps) => {
    if (events.length === 0) return null;

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name={icon} size={18} color={colors.iris} />
                    <Text style={styles.title}>{title}</Text>
                </View>
                {onSeeAll && (
                    <Pressable onPress={onSeeAll}>
                        <Text style={styles.seeAllText}>See All</Text>
                    </Pressable>
                )}
            </View>

            <FlatList
                data={events}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                snapToInterval={180 + 12} // Width + gap
                decelerationRate="fast"
                renderItem={({ item, index }) => (
                    <Animated.View
                        entering={FadeInRight.delay(index * 100)}
                        style={styles.cardWrapper}
                    >
                        <EventCard
                            id={item.id}
                            title={item.title}
                            venue={item.venue || item.location || "Venue TBA"}
                            date={formatEventDate(item.startDate, "short")}
                            imageUrl={item.posterUrl || ""}
                            price={item.priceDisplay}
                            category={item.category}
                            isTonight={item.isTonight}
                            isSoldOut={item.isSoldOut}
                            variant="grid"
                            width={180}
                        />
                    </Animated.View>
                )}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    sectionContainer: {
        marginBottom: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    title: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    seeAllText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "600",
    },
    listContent: {
        paddingHorizontal: 20,
        gap: 12,
    },
    cardWrapper: {
        width: 180, // Fixed width for horizontal items
    }
});
