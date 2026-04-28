import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";

export default function DatingTab() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Dating</Text>
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/(tabs)/profile");
                    }}
                    style={styles.profileButton}
                >
                    {user?.photoURL ? (
                        <Image
                            source={{ uri: user.photoURL }}
                            style={styles.profileImage}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={styles.profilePlaceholder}>
                            <Text style={styles.profileInitials}>
                                {user?.displayName ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "C"}
                            </Text>
                        </View>
                    )}
                </Pressable>
            </View>

            <View style={styles.content}>
                <Text style={styles.text}>Dating Coming Soon</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerTitle: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "700",
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.iris,
        overflow: "hidden",
    },
    profileImage: {
        width: "100%",
        height: "100%",
    },
    profilePlaceholder: {
        flex: 1,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    profileInitials: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "700",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    text: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 20,
        fontWeight: "600",
    },
});
