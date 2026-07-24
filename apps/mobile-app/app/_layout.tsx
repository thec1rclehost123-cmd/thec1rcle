import '../global.css';
import { useCallback, useEffect } from 'react';
import { Alert, NativeModules, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { colors } from '@/lib/design/theme';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { DemoDataProvider } from '@/components/DemoDataProvider';
import { PremiumPaywallModal } from '@/components/subscription/PremiumPaywallModal';
import { initSentry } from '@/lib/sentry';
import { initAuthListener, useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { subscribeToDeepLinks, handleDeepLink, handleProtectedRoute } from '@/lib/deeplinks';
import { addNotificationResponseListener } from '@/lib/notifications';
import { apiFetch } from '@/lib/api';
import { discardPendingCheckout } from '@/lib/payments';
import { useProfileStore } from '@/store/profileStore';
import { useFirstRunStore } from '@/store/firstRunStore';
import { resolveFirstRunStage } from '@/lib/firstRun';

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Expo may already have hidden it during a fast refresh.
});

export default function RootLayout() {
  const RootGestureHandlerView = GestureHandlerRootView;

  useEffect(() => initAuthListener(), []);

  useEffect(() => {
    const configureAndroidNavigationBar = async () => {
      if (Platform.OS !== 'android') return;
      if (!NativeModules.ExpoNavigationBar) return;

      try {
        const NavigationBar = await import('expo-navigation-bar');

        await Promise.all([
          NavigationBar.setBackgroundColorAsync(colors.base.DEFAULT),
          NavigationBar.setButtonStyleAsync('light'),
        ]);
      } catch {
        // The Android client may not include ExpoNavigationBar yet; app startup must still continue.
      }
    };

    configureAndroidNavigationBar();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToDeepLinks((url) => {
      // Expo Router automatically navigates native URLs that match file routes.
      // Keep this subscriber for auth gating and legacy route rewrites without
      // pushing a duplicate host/venue screen on top of Expo Router's route.
      handleDeepLink(url, { nativeFileRouteAlreadyHandled: true });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (!data) return;
      const { type, eventId, conversationId, matchId } = data as Record<string, string>;
      const segment = (value: string) => encodeURIComponent(value);
      switch (type) {
        case 'event_reminder':
        case 'event_update':
          if (eventId) handleProtectedRoute(`/event/${segment(eventId)}`);
          break;
        case 'new_message':
          if (conversationId) handleProtectedRoute(`/social/dm/${segment(conversationId)}`);
          break;
        case 'match':
          if (matchId) handleProtectedRoute(`/social/matches/${segment(matchId)}`);
          break;
        case 'dm_request':
          if (conversationId) handleProtectedRoute(`/social/dm/${segment(conversationId)}`);
          break;
        case 'ticket_update':
          if (eventId) handleProtectedRoute(`/event/${segment(eventId)}`);
          break;
        default:
          handleProtectedRoute('/notifications');
          break;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubHydrate: (() => void) | null = null;
    let recoveryStartedFor: string | null = null;

    const recoverPendingPayment = async () => {
      const { pendingPaymentOrderId, pendingReservation, items } = useCartStore.getState();
      const user = useAuthStore.getState().user;

      if (!user || !pendingPaymentOrderId) return;
      if (
        resolveFirstRunStage(
          user,
          useProfileStore.getState().profile,
          useFirstRunStore.getState().snapshot,
        ) !== 'complete'
      )
        return;
      if (recoveryStartedFor === pendingPaymentOrderId) return;
      recoveryStartedFor = pendingPaymentOrderId;

      // First, poll server to check if order is already confirmed (via webhook)
      try {
        const response = await apiFetch<{
          success: boolean;
          order?: { status: string };
        }>(`/api/v1/orders/${pendingPaymentOrderId}?includeEvent=false`, {
          requireAuth: true,
        });
        const orderStatus = response?.order?.status;
        if (orderStatus === 'confirmed') {
          // Payment already captured server-side — clear recovery state
          useCartStore.getState().setPendingPaymentOrderId(null);
          useCartStore.getState().clearPendingReservation();
          return;
        }
      } catch {
        // Server unreachable — fall through to local recovery dialog
      }

      const hasValidReservation =
        pendingReservation && new Date(pendingReservation.expiresAt).getTime() > Date.now();

      // If reservation is still valid, silently let checkout screen handle it
      if (hasValidReservation) return;

      resumeTimer = setTimeout(() => {
        Alert.alert('Resume Payment?', 'You have an incomplete payment from a previous session.', [
          {
            text: 'Cancel Payment',
            style: 'destructive',
            onPress: () => {
              void discardPendingCheckout().catch(() => {
                Alert.alert(
                  'Cancellation failed',
                  'The pending ticket hold is still active. Please try again.',
                );
              });
            },
          },
          {
            text: 'Resume Payment',
            onPress: () => {
              const eventId = items[0]?.eventId;
              if (eventId) {
                router.replace(`/checkout/${eventId}`);
              } else {
                router.replace('/checkout');
              }
            },
          },
        ]);
      }, 1000);
    };

    if (useCartStore.persist.hasHydrated()) {
      void recoverPendingPayment();
    } else {
      unsubHydrate = useCartStore.persist.onFinishHydration(() => {
        recoverPendingPayment();
      });
    }
    const unsubscribeAuth = useAuthStore.subscribe(() => {
      if (useCartStore.persist.hasHydrated()) void recoverPendingPayment();
    });

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      if (unsubHydrate) unsubHydrate();
      unsubscribeAuth();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  return (
    <QueryProvider>
      <DemoDataProvider>
        <ErrorBoundary>
          <SafeAreaProvider>
            <RootGestureHandlerView
              style={{ flex: 1, backgroundColor: colors.base.DEFAULT }}
              onLayout={onLayoutRootView}
            >
              <View style={{ flex: 1, backgroundColor: colors.base.DEFAULT }}>
                <StatusBar style="light" backgroundColor={colors.base.DEFAULT} />
                <OfflineBanner />
                <ThemeProvider value={DarkTheme}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.base.DEFAULT },
                      navigationBarColor: colors.base.DEFAULT,
                      animation: 'slide_from_right',
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(first-run)" />
                    <Stack.Screen name="profile-setup" />
                    <Stack.Screen name="profile-creation" />
                    <Stack.Screen name="social-setup" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="dating/match"
                      options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                    />
                  </Stack>
                </ThemeProvider>
                <PremiumPaywallModal />
              </View>
            </RootGestureHandlerView>
          </SafeAreaProvider>
        </ErrorBoundary>
      </DemoDataProvider>
    </QueryProvider>
  );
}
