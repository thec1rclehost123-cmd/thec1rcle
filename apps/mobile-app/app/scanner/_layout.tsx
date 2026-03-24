import { useEffect } from "react";
import { Stack } from "expo-router";
import { colors } from "@/lib/design/theme";
import { useScannerStore } from "@/store/scannerStore";

/**
 * Scanner group layout — no auth required.
 * Security staff navigates: code entry → tabbed scanner experience
 */
export default function ScannerLayout() {
    useEffect(() => {
        // H9: Rehydrate session from SecureStore on app open
        useScannerStore.getState().rehydrate();
    }, []);

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.base.DEFAULT },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="door-entry" />
            <Stack.Screen name="stats" />
            <Stack.Screen name="guestlist" />
            <Stack.Screen name="walk-ins" />
            <Stack.Screen name="cover-charge" />
        </Stack>
    );
}
