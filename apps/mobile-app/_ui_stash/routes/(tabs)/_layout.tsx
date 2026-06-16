import { Tabs } from 'expo-router';
import { View, StyleSheet, Pressable, DeviceEventEmitter, Text } from 'react-native';
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
import { colors } from '@/lib/design/theme';

const VISIBLE_ROUTES = ['explore', 'inbox', 'social', 'tickets', 'venues'] as const;
type VisibleRoute = (typeof VISIBLE_ROUTES)[number];

const TAB_CONFIG: Record<VisibleRoute, { icon: LucideIcon; label: string }> = {
  explore: { icon: Compass, label: 'Explore' },
  inbox: { icon: MessageCircle, label: 'Inbox' },
  social: { icon: Heart, label: 'Social' },
  tickets: { icon: Ticket, label: 'Tickets' },
  venues: { icon: MapPin, label: 'Venues' },
};

function TabItem({ route, index, isActive, onPress }: any) {
  const config = TAB_CONFIG[route.name as VisibleRoute];

  const iconAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isActive ? 1 : 0.5, { duration: 200 }),
      transform: [{ scale: withSpring(isActive ? 1.05 : 1) }],
    };
  }, [isActive]);

  if (!config) return null;
  const Icon = config.icon;

  return (
    <Pressable onPress={() => onPress(route, index)} style={styles.tabItem}>
      <Animated.View style={[styles.iconWrap, iconAnimStyle]}>
        <Icon
          size={24}
          color={isActive ? colors.iris : '#FFFFFF'}
          strokeWidth={isActive ? 2.5 : 2}
        />
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const barTranslateY = useSharedValue(0);
  const barOpacity = useSharedValue(1);

  // Listen to scroll events to hide/show tab bar
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tabBarScroll', ({ hide }: { hide: boolean }) => {
      barTranslateY.value = withSpring(hide ? 120 : 0, { damping: 22, stiffness: 220, mass: 0.8 });
      barOpacity.value = withTiming(hide ? 0 : 1, { duration: 180 });
    });
    return () => sub.remove();
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: barTranslateY.value }],
    opacity: barOpacity.value,
  }));

  const visibleRoutes = state.routes.filter((r: any) =>
    (VISIBLE_ROUTES as readonly string[]).includes(r.name),
  );

  const handlePress = (route: any, index: number) => {
    barTranslateY.value = withSpring(0, { damping: 20, stiffness: 250, mass: 0.7 });
    barOpacity.value = withTiming(1, { duration: 150 });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isFocused = state.routes[state.index]?.name === route.name;
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
        containerStyle,
      ]}
    >
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />

      <View style={styles.tabsRow}>
        {visibleRoutes.map((route: any, index: number) => (
          <TabItem
            key={route.key}
            route={route}
            index={index}
            isActive={state.routes[state.index]?.name === route.name}
            onPress={handlePress}
          />
        ))}
      </View>
    </Animated.View>
  );
}

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

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 32,
    overflow: 'hidden', // needed for BlurView
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
