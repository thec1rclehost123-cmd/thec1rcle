import "../global.css";
import { useCallback } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { colors } from "@/lib/design/theme";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { DemoDataProvider } from "@/components/DemoDataProvider";
import { initSentry } from "@/lib/sentry";

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {
    // Expo may already have hidden it during a fast refresh.
});

export default function RootLayout() {
    const RootGestureHandlerView = GestureHandlerRootView as any;

    const onLayoutRootView = useCallback(async () => {
        await SplashScreen.hideAsync();
    }, []);

    return (
        <QueryProvider>
            <DemoDataProvider>
                <ErrorBoundary>
                    <SafeAreaProvider>
                        <RootGestureHandlerView style={{ flex: 1 }} onLayout={onLayoutRootView}>
                            <View style={{ flex: 1, backgroundColor: colors.base.DEFAULT }}>
                                <StatusBar style="light" backgroundColor={colors.base.DEFAULT} />
                                <Stack
                                    screenOptions={{
                                        headerShown: false,
                                        contentStyle: { backgroundColor: colors.base.DEFAULT },
                                        animation: "slide_from_right",
                                    }}
                                >
                                    <Stack.Screen name="index" />
                                    <Stack.Screen name="(tabs)" />
                                </Stack>
                            </View>
                        </RootGestureHandlerView>
                    </SafeAreaProvider>
                </ErrorBoundary>
            </DemoDataProvider>
        </QueryProvider>
    );
}
