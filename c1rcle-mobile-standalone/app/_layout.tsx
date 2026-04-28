import "../global.css";
import { useEffect, useCallback, useRef } from "react";
import { Stack, router, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initAuthListener, useAuthStore } from "@/store/authStore";
import { subscribeToDeepLinks, parseDeepLink } from "@/lib/deeplinks";
import {
    addNotificationReceivedListener,
    addNotificationResponseListener,
} from "@/lib/notifications";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { colors } from "@/lib/design/theme";

// Prevent auto-hide until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore if already hidden
});

/**
 * Auth-based navigation guard
 * Automatically redirects based on auth state
 */
function useProtectedRoute(user: unknown, isReady: boolean) {
    const segments = useSegments();
    const navigationState = useRootNavigationState();

    useEffect(() => {
        // Wait for navigation to be ready and auth to be initialized
        if (!navigationState?.key || !isReady) return;

        const inAuthGroup = segments[0] === "(auth)";
        const inTabsGroup = segments[0] === "(tabs)";

        // Use setTimeout to ensure layout is mounted
        const timer = setTimeout(() => {
            try {
                if (!user && !inAuthGroup) {
                    // Redirect to login if not authenticated and not already in auth group
                    router.replace("/(auth)/login");
                } else if (user && inAuthGroup) {
                    // Redirect to main app if authenticated but in auth group
                    router.replace("/(tabs)/explore");
                }
            } catch (e) {
                console.warn("[Navigation] Error during redirect:", e);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [user, segments, navigationState?.key, isReady]);
}

/**
 * Root Layout Component
 * Handles: Auth, Navigation, Theming, Deep Links, Notifications
 */
export default function RootLayout() {
    const { initialized, user } = useAuthStore();
    const appState = useRef(AppState.currentState);

    // Load custom fonts (empty for now - using system fonts)
    const [fontsLoaded] = useFonts({});

    // Initialize Firebase auth listener on mount
    useEffect(() => {
        const unsubscribe = initAuthListener();
        return unsubscribe;
    }, []);

    // Handle deep links
    useEffect(() => {
        const unsubscribe = subscribeToDeepLinks((url) => {
            console.log("[DeepLink] Received:", url);
            const { type, params } = parseDeepLink(url);
            const { setPromoterCode } = require("@/store/cartStore").useCartStore.getState();

            // Check for promoter parameter in any link
            if (params.promoter || params.ref) {
                setPromoterCode(params.promoter || params.ref);
            }

            switch (type) {
                case "event":
                    if (params.id || params.eventId) {
                        router.push({ pathname: "/event/[id]", params: { id: params.id || params.eventId } });
                    }
                    break;
                case "ticket":
                    if (params.id || params.orderId) {
                        router.push({ pathname: "/ticket/[id]", params: { id: params.id || params.orderId } });
                    }
                    break;
                case "chat":
                    if (params.id || params.eventId) {
                        router.push({ pathname: "/social/group/[eventId]", params: { eventId: params.id || params.eventId } });
                    }
                    break;
                case "transfer":
                    // Navigate to transfer screen with code param
                    router.push({ pathname: "/transfer", params: { code: params.code } });
                    break;
                case "claim":
                    if (params.token || params.id) {
                        router.push({ pathname: "/claim/[token]", params: { token: params.token || params.id } });
                    }
                    break;
                case "safety":
                    router.push("/safety");
                    break;
                case "going":
                    if (params.orderId || params.id) {
                        router.push({ pathname: "/going/[orderId]", params: { orderId: params.orderId || params.id } });
                    }
                    break;
                default:
                    console.log("[DeepLink] Unknown type:", type);
            }
        });

        return unsubscribe;
    }, []);

    // Handle push notification taps
    useEffect(() => {
        const receivedSub = addNotificationReceivedListener((notification) => {
            console.log("[Notification] Received:", notification.request.content.title);
        });

        const responseSub = addNotificationResponseListener((response) => {
            const data = response.notification.request.content.data;

            // Navigate based on notification payload
            if (data?.type === "ticket_confirmed" || data?.orderId) {
                router.push({ pathname: "/ticket/[id]", params: { id: (data?.orderId || data?.id) as string } });
            } else if (data?.type === "event_starts_soon" || data?.eventId) {
                router.push({ pathname: "/event/[id]", params: { id: (data?.eventId || data?.id) as string } });
            } else if (data?.type === "chat_new_message" || data?.chatId) {
                // If it's a group chat, data.eventId might be provided
                if (data?.eventId) {
                    router.push({ pathname: "/social/group/[eventId]", params: { eventId: data.eventId as string } });
                } else {
                    router.push(`/social/dm/${data?.chatId || data?.id}`);
                }
            } else if (data?.type === "ticket_transferred_to_you") {
                router.push("/(tabs)/tickets");
            } else if (data?.type === "sos_acknowledged" || data?.navigateTo === "safety") {
                router.push("/safety");
            } else if (data?.navigateTo === "notifications") {
                router.push("/notifications");
            }
        });

        return () => {
            receivedSub.remove();
            responseSub.remove();
        };
    }, []);

    // Track app state for background/foreground
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === "active"
            ) {
                console.log("[App] Came to foreground");
                // Could trigger data refresh here
            }
            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener("change", handleAppStateChange);
        return () => subscription.remove();
    }, []);

    // Hide splash when ready
    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded && initialized) {
            await SplashScreen.hideAsync();
        }
    }, [fontsLoaded, initialized]);

    // Use auth-based navigation guard
    useProtectedRoute(user, initialized);

    // Show nothing while loading (splash screen is visible)
    if (!fontsLoaded || !initialized) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
                <View style={{ flex: 1, backgroundColor: colors.base.DEFAULT }}>
                    <StatusBar style="light" backgroundColor={colors.base.DEFAULT} />

                    {/* Global offline indicator */}
                    <OfflineBanner />

                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: colors.base.DEFAULT },
                            animation: "slide_from_right",
                        }}
                    >
                        {/* Auth Flow */}
                        <Stack.Screen
                            name="(auth)"
                            options={{
                                headerShown: false,
                                animation: "fade",
                            }}
                        />

                        {/* Main Tab Navigation */}
                        <Stack.Screen
                            name="(tabs)"
                            options={{
                                headerShown: false
                            }}
                        />

                        {/* Index redirect */}
                        <Stack.Screen
                            name="index"
                            options={{
                                headerShown: false
                            }}
                        />

                        {/* Event Detail */}
                        <Stack.Screen
                            name="event/[id]"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />

                        {/* Checkout Flow (Modal) */}
                        <Stack.Screen
                            name="checkout"
                            options={{
                                headerShown: false,
                                presentation: "modal",
                                animation: "slide_from_bottom",
                            }}
                        />

                        {/* Chat Screens */}
                        <Stack.Screen
                            name="chat"
                            options={{
                                headerShown: false,
                            }}
                        />

                        {/* Safety Features (Modal) */}
                        <Stack.Screen
                            name="safety"
                            options={{
                                headerShown: false,
                                presentation: "modal",
                                animation: "slide_from_bottom",
                            }}
                        />

                        {/* You're Going Celebration Screen */}
                        <Stack.Screen
                            name="going"
                            options={{
                                headerShown: false,
                                presentation: "fullScreenModal",
                                animation: "fade",
                            }}
                        />

                        {/* Ticket Transfer */}
                        <Stack.Screen
                            name="transfer"
                            options={{
                                headerShown: false,
                                presentation: "modal",
                                animation: "slide_from_bottom",
                            }}
                        />

                        {/* Social Screens */}
                        <Stack.Screen
                            name="social"
                            options={{
                                headerShown: false,
                            }}
                        />

                        {/* Notifications */}
                        <Stack.Screen
                            name="notifications"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />

                        {/* Settings */}
                        <Stack.Screen
                            name="settings"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />

                        {/* Search */}
                        <Stack.Screen
                            name="search"
                            options={{
                                headerShown: false,
                                presentation: "card",
                                animation: "fade",
                            }}
                        />

                        {/* Profile Edit (Modal) */}
                        <Stack.Screen
                            name="profile/edit"
                            options={{
                                headerShown: false,
                                presentation: "modal",
                                animation: "slide_from_bottom",
                            }}
                        />

                        {/* Legal Pages */}
                        <Stack.Screen
                            name="legal/terms"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />
                        <Stack.Screen
                            name="legal/privacy"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />
                        <Stack.Screen
                            name="legal/refunds"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />
                        <Stack.Screen
                            name="legal/guidelines"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />
                        <Stack.Screen
                            name="legal/safety"
                            options={{
                                headerShown: false,
                                presentation: "card",
                            }}
                        />
                    </Stack>
                </View>
            </GestureHandlerRootView>
        </SafeAreaProvider>
    );
}
