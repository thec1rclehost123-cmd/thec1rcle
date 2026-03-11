import "../global.css";
import { useEffect, useCallback, useRef, useState } from "react";
import { Stack, router, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initAuthListener, useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { subscribeToDeepLinks, parseDeepLink } from "@/lib/deeplinks";
import {
    addNotificationReceivedListener,
    addNotificationResponseListener,
    refreshPushToken,
} from "@/lib/notifications";
import { apiFetch } from "@/lib/api";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { hasCompletedOnboarding } from "@/app/onboarding";
import { hasCompletedProfileSetup } from "@/app/profile-setup";
import { colors } from "@/lib/design/theme";
import { QueryProvider } from "@/components/providers/QueryProvider";

// Prevent auto-hide until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore if already hidden
});

/**
 * Auth-based navigation guard
 * Automatically redirects based on auth state
 */
function useProtectedRoute(user: unknown) {
    const segments = useSegments();
    const navigationState = useRootNavigationState();
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
    const [profileSetupChecked, setProfileSetupChecked] = useState(false);

    // Check onboarding status once on mount
    useEffect(() => {
        hasCompletedOnboarding().then((completed) => {
            setNeedsOnboarding(!completed);
            setOnboardingChecked(true);
        });
    }, []);

    // Check profile setup when user logs in
    useEffect(() => {
        if (!user) {
            setProfileSetupChecked(false);
            return;
        }
        hasCompletedProfileSetup().then((completed) => {
            setNeedsProfileSetup(!completed);
            setProfileSetupChecked(true);
        });
    }, [user]);

    useEffect(() => {
        // Wait for navigation + onboarding check to be ready
        if (!navigationState?.key || !onboardingChecked) return;

        const inAuthGroup = segments[0] === "(auth)";
        const inOnboarding = segments[0] === "onboarding";
        const inScanner = segments[0] === "scanner";
        const inProfileSetup = segments[0] === "profile-setup";

        // Scanner routes are public — no auth needed (security staff)
        if (inScanner) return;

        // First-time user — show onboarding before auth
        if (needsOnboarding && !inOnboarding && !user) {
            router.replace("/onboarding");
            return;
        }

        if (!user && !inAuthGroup && !inOnboarding) {
            router.replace("/(auth)/login");
        } else if (user && (inAuthGroup || inOnboarding)) {
            // Just authenticated — check profile setup
            if (profileSetupChecked && needsProfileSetup) {
                router.replace("/profile-setup");
            } else if (profileSetupChecked) {
                router.replace("/(tabs)/explore");
            }
        } else if (user && inProfileSetup && profileSetupChecked && !needsProfileSetup) {
            // Profile setup already done — skip to tabs
            router.replace("/(tabs)/explore");
        }
    }, [user, segments, navigationState?.key, onboardingChecked, needsOnboarding, needsProfileSetup, profileSetupChecked]);
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

    // Refresh push token whenever the authenticated user changes
    useEffect(() => {
        if (user?.uid) {
            refreshPushToken(user.uid).catch(() => {});
        }
    }, [user?.uid]);

    // Handle deep links
    useEffect(() => {
        const unsubscribe = subscribeToDeepLinks((url) => {
            console.log("[DeepLink] Received:", url);
            const { type, params } = parseDeepLink(url);

            // Regex for UUID validation (v4)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            // Regex for alphanumeric transfer codes (e.g. 6-12 chars)
            const codeRegex = /^[A-Z0-9]{6,12}$/i;

            switch (type) {
                case "event":
                    if (params.id && uuidRegex.test(params.id)) {
                        router.push({ pathname: "/event/[id]", params: { id: params.id } });
                    } else {
                        console.warn("[DeepLink] Invalid event ID:", params.id);
                    }
                    break;
                case "transfer":
                    if (params.code && codeRegex.test(params.code)) {
                        router.push({ pathname: "/transfer", params: { code: params.code } });
                    } else {
                        console.warn("[DeepLink] Invalid transfer code:", params.code);
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
            if (data?.eventId) {
                router.push({ pathname: "/event/[id]", params: { id: data.eventId as string } });
            } else if (data?.orderId) {
                router.push("/(tabs)/tickets");
            } else if (data?.chatId) {
                router.push(`/social/dm/${data.chatId}`);
            } else if (data?.navigateTo === "notifications") {
                router.push("/notifications");
            }
        });

        return () => {
            receivedSub.remove();
            responseSub.remove();
        };
    }, []);

    // Track app state for background/foreground; refresh push token on resume
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === "active"
            ) {
                if (user?.uid) {
                    refreshPushToken(user.uid).catch(() => {});
                }
            }
            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener("change", handleAppStateChange);
        return () => subscription.remove();
    }, [user?.uid]);

    // Hide splash when ready
    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded && initialized) {
            await SplashScreen.hideAsync();
        }
    }, [fontsLoaded, initialized]);

    // Use auth-based navigation guard
    useProtectedRoute(user);

    // Show nothing while loading (splash screen is visible)
    if (!fontsLoaded || !initialized) {
        return null;
    }

    // ─── ORDER RECOVERY ───
    // If the app was killed mid-payment, check for a pending order on cold start.
    useEffect(() => {
        if (!initialized || !user) return;

        const pendingOrderId = useCartStore.getState().pendingPaymentOrderId;
        if (!pendingOrderId) return;

        apiFetch(`/api/orders/${pendingOrderId}`)
            .then((order: any) => {
                if (order?.status === "confirmed" || order?.status === "checked_in") {
                    useCartStore.getState().setPendingPaymentOrderId(null);
                    useCartStore.getState().clearCart();
                    router.replace({
                        pathname: "/checkout/success",
                        params: { orderId: pendingOrderId, recovered: "true" },
                    });
                } else if (
                    order?.status === "cancelled" ||
                    order?.status === "refunded" ||
                    order?.status === "payment_failed"
                ) {
                    useCartStore.getState().setPendingPaymentOrderId(null);
                }
                // If still payment_pending — leave the pendingOrderId in place; user can retry
            })
            .catch(() => {
                // Network error during recovery check — leave pending order, retry next session
            });
    }, [initialized, user]);

    return (
        <QueryProvider>
            <ErrorBoundary>
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
                                {/* Onboarding (first-time users) */}
                                <Stack.Screen
                                    name="onboarding"
                                    options={{
                                        headerShown: false,
                                        animation: "fade",
                                    }}
                                />

                                {/* Auth Flow */}
                                <Stack.Screen
                                    name="(auth)"
                                    options={{
                                        headerShown: false,
                                        animation: "fade",
                                    }}
                                />

                                {/* Profile Setup (first sign-in) */}
                                <Stack.Screen
                                    name="profile-setup"
                                    options={{
                                        headerShown: false,
                                        animation: "slide_from_bottom",
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

                                {/* Scanner (No auth — security staff) */}
                                <Stack.Screen
                                    name="scanner"
                                    options={{
                                        headerShown: false,
                                        animation: "slide_from_bottom",
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
            </ErrorBoundary>
        </QueryProvider>
    );
}
