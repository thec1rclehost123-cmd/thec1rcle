
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { colors, radii, spacing } from "../../lib/design/theme";

interface ExplorePremiumHeaderProps {
    city: string;
    onCityPress: () => void;
    onSearchPress: () => void;
    onFilterPress: (type: "date" | "price") => void;
}

export const ExplorePremiumHeader: React.FC<ExplorePremiumHeaderProps> = ({
    city,
    onCityPress,
    onSearchPress,
    onFilterPress,
}) => {
    return (
        <View style={styles.container}>
            {/* Top Row: Logo + City Selector */}
            <View style={styles.topRow}>
                <Pressable onPress={onCityPress} style={styles.citySelector}>
                    <Text style={styles.logoText}>(P)</Text>
                    <Text style={styles.cityText}>{city}</Text>
                    <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.6)" />
                </Pressable>
            </View>

            {/* Bottom Row: Filter Pills + Search Icon */}
            <View style={styles.bottomRow}>
                <View style={styles.filterPills}>
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onFilterPress("date");
                        }}
                        style={styles.filterChip}
                    >
                        <Text style={styles.filterChipText}>Date</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onFilterPress("price");
                        }}
                        style={styles.filterChip}
                    >
                        <Text style={styles.filterChipText}>Price</Text>
                    </Pressable>
                </View>

                <Pressable onPress={onSearchPress} style={styles.searchButton}>
                    <Ionicons name="search" size={24} color="#fff" />
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: "transparent",
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    citySelector: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    logoText: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "900",
        fontStyle: "italic",
    },
    cityText: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "300", // Thin weight as per requirement
    },
    bottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    filterPills: {
        flexDirection: "row",
        gap: 12,
    },
    filterChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    filterChipText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    searchButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
});
