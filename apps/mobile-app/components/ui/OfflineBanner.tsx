/**
 * OfflineBanner
 * Compact floating pill — shown only when genuinely offline.
 *
 * False-positive fix:
 *   isInternetReachable starts as null on many devices (especially Android)
 *   while the reachability probe is still running.
 *   We only mark offline when isConnected is explicitly false OR
 *   isInternetReachable is explicitly false (not null).
 *   We also debounce by 1.5 s to absorb momentary blips.
 */
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OfflineBannerProps {
  message?: string;
}

export function OfflineBanner({ message = 'No internet connection' }: OfflineBannerProps) {
  const [status, setStatus] = useState<'online' | 'offline' | 'back'>('online');
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Animated values
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backOnlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);

  const show = (s: 'offline' | 'back') => {
    setStatus(s);
    setVisible(true);
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 200 });
  };

  const hide = () => {
    translateY.value = withSpring(-80, { damping: 18, stiffness: 220 });
    opacity.value = withTiming(0, { duration: 250 });
    setTimeout(() => setVisible(false), 300);
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isConnected === false is always offline
      // isInternetReachable === false means probe failed (null = still checking → trust isConnected)
      const isOffline = state.isConnected === false || state.isInternetReachable === false;

      // Debounce to avoid blips (Wi-Fi handoff, screen wake, etc.)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (isOffline) {
          wasOfflineRef.current = true;
          show('offline');
          // Clear any pending "back online" hide
          if (backOnlineRef.current) clearTimeout(backOnlineRef.current);
        } else if (wasOfflineRef.current) {
          // We recovered — briefly show "Back online" then dismiss
          wasOfflineRef.current = false;
          show('back');
          backOnlineRef.current = setTimeout(hide, 2200);
        }
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (backOnlineRef.current) clearTimeout(backOnlineRef.current);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const isOffline = status === 'offline';

  return (
    <Animated.View
      style={[styles.wrapper, { top: insets.top + 8 }, animatedStyle]}
      pointerEvents="none"
    >
      <View style={[styles.pill, isOffline ? styles.pillOffline : styles.pillOnline]}>
        <View style={[styles.dot, isOffline ? styles.dotOffline : styles.dotOnline]} />
        <Text style={styles.text}>{isOffline ? message : 'Back online'}</Text>
      </View>
    </Animated.View>
  );
}

// Hook for checking network status — unchanged API
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Same conservative logic: null = still probing → assume connected
      const connected = state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected);
      setConnectionType(state.type);
    });

    return () => unsubscribe();
  }, []);

  return { isConnected, connectionType };
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  pillOffline: {
    backgroundColor: 'rgba(20, 20, 22, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    shadowColor: '#F87171',
  },
  pillOnline: {
    backgroundColor: 'rgba(20, 20, 22, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
    shadowColor: '#34D399',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOffline: {
    backgroundColor: '#F87171',
  },
  dotOnline: {
    backgroundColor: '#34D399',
  },
  text: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

export default OfflineBanner;
