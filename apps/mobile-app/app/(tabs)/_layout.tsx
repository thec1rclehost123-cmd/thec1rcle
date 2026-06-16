import { Tabs } from 'expo-router';
import { View, StyleSheet, Pressable, DeviceEventEmitter, Dimensions, Text } from 'react-native';
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

const TAB_LABELS: Record<VisibleRoute, string> = {
  explore: 'Explore',
  inbox: 'Chat',
  social: 'Dating',
  tickets: 'Tickets',
  venues: 'Venues',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH - 40;
const TAB_ITEM_WIDTH = (TAB_BAR_WIDTH - 8) / 5;

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  // Only show the 5 visible routes
  const visibleRoutes = state.routes.filter((r: any) =>
    (VISIBLE_ROUTES as readonly string[]).includes(r.name),
  );

  const activeIndex = visibleRoutes.findIndex((r: any) => r.name === activeRouteName);
  const highlightOffset = useSharedValue(activeIndex > -1 ? activeIndex : 0);

  useEffect(() => {
    if (activeIndex > -1) {
      highlightOffset.value = withTiming(activeIndex, { duration: 200 });
    }
  }, [activeIndex]);

  const highlightStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: highlightOffset.value * TAB_ITEM_WIDTH }],
    };
  });

  const isScrollingDown = useSharedValue(false);
  const lastScrollY = useSharedValue(0);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tabBarScroll', (y: number) => {
      if (y > lastScrollY.value + 5 && y > 50) {
        isScrollingDown.value = true;
      } else if (y < lastScrollY.value - 5 || y <= 50) {
        isScrollingDown.value = false;
      }
      lastScrollY.value = y;
    });
    return () => sub.remove();
  }, []);

  const tabBarStyle = useAnimatedStyle(() => {
    const scale = withTiming(isScrollingDown.value ? 0.88 : 1, { duration: 250 });
    const translateY = withTiming(isScrollingDown.value ? 15 : 0, { duration: 250 });
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const handlePress = (route: any) => {
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
        { bottom: insets.bottom > 0 ? insets.bottom : 16 },
        tabBarStyle,
      ]}
    >
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.tabBarContent}>
        <Animated.View style={[styles.highlightWrapper, highlightStyle]}>
          <View style={styles.activeHighlight} />
        </Animated.View>
        {visibleRoutes.map((route: any) => {
          const isFocused = activeRouteName === route.name;
          const Icon = TAB_ICONS[route.name as VisibleRoute];
          if (!Icon) return null;
          const IconComp = Icon as any;

          return (
            <Pressable key={route.key} onPress={() => handlePress(route)} style={styles.tabItem}>
              <View style={styles.iconWrap}>
                <IconComp size={22} color="#fff" strokeWidth={isFocused ? 2.5 : 2.0} />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {TAB_LABELS[route.name as VisibleRoute]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
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
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 10, 0.25)', // Dark base for glass
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tabBarContent: {
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
  highlightWrapper: {
    position: 'absolute',
    left: 4, // aligns with paddingHorizontal
    top: 0,
    bottom: 0,
    width: TAB_ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeHighlight: {
    width: 60,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Icon container — active background capsule
  iconWrap: {
    width: 60,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
  },
  tabLabelActive: {
    color: '#fff',
  },
});
