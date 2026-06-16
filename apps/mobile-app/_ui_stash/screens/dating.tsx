import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";

export default function DatingScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const initials = user?.displayName
        ? user.displayName
              .split(" ")
              .map((name) => name[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
        : "C";

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Dating</Text>
                <Pressable
                    onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/(tabs)/profile");
                    }}
                    style={styles.profileButton}
                >
                    {user?.photoURL ? (
                        <Image source={{ uri: user.photoURL }} style={styles.profileImage} contentFit="cover" />
                    ) : (
                        <View style={styles.profileFallback}>
                            <Text style={styles.profileInitials}>{initials}</Text>
                        </View>
                    )}
                </Pressable>
            </View>

            <View style={styles.body}>
                <Text style={styles.comingSoon}>Dating coming soon</Text>
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
    title: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "700",
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1.5,
        borderColor: colors.iris,
    },
    profileImage: {
        width: "100%",
        height: "100%",
    },
    profileFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(244,74,34,0.12)",
    },
    profileInitials: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "700",
    },
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    comingSoon: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 20,
        fontWeight: "600",
    },
});
