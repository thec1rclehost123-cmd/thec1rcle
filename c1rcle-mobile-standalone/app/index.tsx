import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/lib/design/theme";

/**
 * Index Route - Entry Point
 * 
 * This is the initial route when the app launches.
 * It checks auth state and redirects accordingly:
 * - If not initialized: Show loading
 * - If authenticated: Go to main tabs
 * - If not authenticated: Go to login
 */
export default function Index() {
    const { initialized, user } = useAuthStore();

    // Still initializing - show loading state
    if (!initialized) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: colors.base.DEFAULT,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    // Redirect based on auth state
    if (user) {
        return <Redirect href="/(tabs)/explore" />;
    }

    return <Redirect href="/(auth)/login" />;
}
