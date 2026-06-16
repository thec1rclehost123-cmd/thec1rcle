import { Tabs } from 'expo-router';
import { View, StyleSheet, Pressable, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Compass,
  MapPin,
  Ticket,
  MessageCircle,
  Heart,
  type LucideIcon,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import React, { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Svg, { Polygon, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors, gradients } from '@/lib/design/theme';
import { LinearGradient } from 'expo-linear-gradient';

// Spotlight Cone removed.

// ── Tab routes shown in the bar ───────────────────────────────────────────────
const VISIBLE_ROUTES = ['explore', 'inbox', 'social', 'tickets', 'venues'] as const;
type VisibleRoute = (typeof VISIBLE_ROUTES)[number];

const TAB_ICONS: Record<VisibleRoute, LucideIcon> = {
  explore: Compass,
  inbox: MessageCircle,
  social: Heart,
  tickets: Ticket,
  venues: MapPin,
};

// ── Custom floating pill tab bar ───────────────────────────────────────────────
function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Listen to scroll events emitted from screens
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tabBarScroll', ({ hide }: { hide: boolean }) => {
      translateY.value = withSpring(hide ? 120 : 0, { damping: 22, stiffness: 220, mass: 0.8 });
      opacity.value = withTiming(hide ? 0 : 1, { duration: 180 });
    });
    return () => sub.remove();
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const activeRouteName = state.routes[state.index]?.name;

  // Only show the 5 visible routes
  const visibleRoutes = state.routes.filter((r: any) =>
    (VISIBLE_ROUTES as readonly string[]).includes(r.name),
  );

  const handlePress = (route: any) => {
    // Always snap tab bar back into view on any tap
    translateY.value = withSpring(0, { damping: 20, stiffness: 250, mass: 0.7 });
    opacity.value = withTiming(1, { duration: 150 });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isFocused = activeRouteName === route.name;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <Animated.View
      style={[
        styles.tabBarContainer,
        { bottom: insets.bottom > 0 ? insets.bottom + 8 : 20 },
        animStyle,
      ]}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(44, 44, 46, 0.7)', 'rgba(28, 28, 30, 0.85)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.tabBarGradient}
      >
        {visibleRoutes.map((route: any) => {
          const isFocused = activeRouteName === route.name;
          const Icon = TAB_ICONS[route.name as VisibleRoute];
          if (!Icon) return null;
          const IconComp = Icon as any;

          return (
            <Pressable key={route.key} onPress={() => handlePress(route)} style={styles.tabItem}>
              {/* Icon — glows orange when active, no circle background */}
              <View style={styles.iconWrap}>
                <IconComp
                  size={22}
                  color={isFocused ? colors.iris : 'rgba(255,255,255,0.38)'}
                  strokeWidth={isFocused ? 2.0 : 1.7}
                />
              </View>
            </Pressable>
          );
        })}
      </LinearGradient>
    </Animated.View>
  );
}

// ── Root tab layout ────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="social" options={{ title: 'Social' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
      <Tabs.Screen name="venues" options={{ title: 'Venues' }} />
      {/* Hidden — accessed via header avatar */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="dating" options={{ href: null }} />
    </Tabs>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBarGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Bright bar at the very top — the "light source"
  spotlightBar: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.iris,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  // Icon container — no active background, icon color change conveys state
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
