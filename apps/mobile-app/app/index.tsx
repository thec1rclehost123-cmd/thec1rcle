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
    // Index doesn't need its own redirect logic anymore.
    // The useProtectedRoute hook in _layout.tsx will handle the routing
    // once the auth state is initialized.
    // This file just serves as a clean entry point / loading stage.
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
