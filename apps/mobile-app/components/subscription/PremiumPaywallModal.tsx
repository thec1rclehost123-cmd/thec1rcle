import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Sparkles, X, Lock, RefreshCw } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { colors, radii, spacing } from '@/lib/design/theme';
import { useSubscriptionStore, type PremiumFeature } from '@/store/subscriptionStore';
import { apiFetch } from '@/lib/api';

type PerkMap = Record<PremiumFeature | 'default', string[]>;

const PERKS_MAP: PerkMap = {
  dailyLikes: [
    'Unlimited Daily Likes',
    '5 Ask Outs daily',
    'Zero booking fees',
    'Full likes visibility',
  ],
  askOuts: [
    'Unlimited Daily Likes',
    '5 Ask Outs daily',
    'Zero booking fees',
    'Full likes visibility',
  ],
  whoLikedMe: ['See Who Liked You', 'Unlimited Likes', 'Zero booking fees', 'Priority support'],
  rewind: [
    'Unlimited Rewinds',
    'Unlimited Daily Likes',
    '5 Ask Outs daily',
    'Full likes visibility',
  ],
  advancedFilters: [
    'Advanced Filters',
    'Vibe Tags & Intent',
    'Height & Verified Only',
    'Full likes visibility',
  ],
  premiumOnlyEvent: [
    'Exclusive Events Access',
    'Early Access Drops',
    'Zero booking fees',
    'Unlimited transfers',
  ],
  earlyAccessDrop: [
    'Early Access Drops',
    'Exclusive Events Access',
    'Zero booking fees',
    'Unlimited transfers',
  ],
  bookingFees: [
    'Zero Booking Fees',
    'Unlimited Daily Likes',
    '5 Ask Outs daily',
    'Full likes visibility',
  ],
  ticketTransfers: [
    'Unlimited Transfers',
    'Zero booking fees',
    'Exclusive Events Access',
    'Priority support',
  ],
  default: ['Unlimited Likes', '5 Ask Outs daily', 'Zero booking fees', 'Full likes visibility'],
};

function usePerks(feature: PremiumFeature | null): string[] {
  if (feature && PERKS_MAP[feature]) {
    return PERKS_MAP[feature];
  }
  return PERKS_MAP.default;
}

export function PremiumPaywallModal() {
  const paywall = useSubscriptionStore((state) => state.paywall);
  const closePaywall = useSubscriptionStore((state) => state.closePaywall);
  const hydrateFromRevenueCat = useSubscriptionStore((state) => state.hydrateFromRevenueCat);
  const restorePurchases = useSubscriptionStore((state) => state.restorePurchases);

  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  const perks = usePerks(paywall.feature);

  const slideUp = useSharedValue(0);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(slideUp.value === 0 ? 300 : 0, { duration: 250 }) }],
    opacity: withTiming(slideUp.value === 0 ? 0 : 1, { duration: 250 }),
  }));

  const loadOfferings = useCallback(async () => {
    setLoadFailed(false);
    setLoadingOfferings(true);
    setError(null);
    try {
      const result = await Purchases.getOfferings();
      const current = result.current;
      if (current?.availablePackages) {
        setOfferings(current.availablePackages);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    if (!paywall.visible) {
      slideUp.value = 0;
      return;
    }
    setError(null);
    setOfferings([]);
    setLoadFailed(false);
    slideUp.value = withTiming(1, { duration: 250 });
    loadOfferings();
  }, [paywall.visible]);

  const handlePurchase = async () => {
    if (offerings.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPurchasing(true);
    setError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(offerings[0]);
      await hydrateFromRevenueCat(customerInfo);
      await apiFetch('/api/v1/webhooks/revenuecat/sync', {
        method: 'POST',
        body: JSON.stringify({ appUserID: customerInfo.originalAppUserId }),
        requireAuth: true,
      });
      closePaywall();
    } catch (e: any) {
      if (e.userCancelled) return;
      setError(e.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      await restorePurchases();
      closePaywall();
    } catch (e: any) {
      setError(e.message || 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const isLoading = loadingOfferings || purchasing || restoring;

  return (
    <Modal visible={paywall.visible} transparent animationType="fade" onRequestClose={closePaywall}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={closePaywall} />
        <Animated.View style={[styles.sheetWrapper, sheetAnimatedStyle]}>
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={44}
            tint="dark"
            style={styles.sheetBlur}
          >
            <Pressable
              accessibilityLabel="Close paywall"
              style={styles.closeButton}
              onPress={closePaywall}
            >
              <X size={18} color="rgba(255,255,255,0.76)" strokeWidth={2.4} />
            </Pressable>

            <LinearGradient colors={['#FFE8A3', '#D99A28']} style={styles.crownWrap}>
              <Crown size={26} color="#2B1600" strokeWidth={2.6} />
            </LinearGradient>

            <Text style={styles.eyebrow}>C1RCLE Premium</Text>
            <Text style={styles.title}>{paywall.title}</Text>
            <Text style={styles.message}>{paywall.message}</Text>

            <View style={styles.perksGrid}>
              {perks.map((perk) => (
                <View key={perk} style={styles.perkPill}>
                  <Sparkles size={13} color="#F6C55B" strokeWidth={2.4} />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {!loadFailed && offerings.length > 0 && (
              <Text style={styles.pricingText}>
                {offerings[0].product.priceString}/
                {offerings[0].packageType === Purchases.PACKAGE_TYPE.LIFETIME ? 'once' : 'month'}
              </Text>
            )}

            {loadFailed ? (
              <Pressable style={styles.retryButton} onPress={loadOfferings} disabled={isLoading}>
                <RefreshCw size={16} color="#F6C55B" strokeWidth={2.4} />
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.primaryButton}
                onPress={handlePurchase}
                disabled={isLoading || offerings.length === 0}
              >
                <LinearGradient
                  colors={['#F7D06A', '#B86F17']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#241200" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {offerings.length === 0 ? 'Loading...' : 'Upgrade to Premium'}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            )}

            <Pressable style={styles.secondaryButton} onPress={closePaywall} disabled={isLoading}>
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>

            <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={isLoading}>
              {restoring ? (
                <ActivityIndicator color="rgba(255,255,255,0.48)" size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore Purchases</Text>
              )}
            </Pressable>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  sheetWrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sheetBlur: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 10,
  },
  crownWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: '#F6C55B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 6,
  },
  message: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.lg,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: 'rgba(246,197,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(246,197,91,0.22)',
  },
  perkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pricingText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(246,197,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(246,197,91,0.22)',
  },
  retryText: {
    color: '#F6C55B',
    fontSize: 15,
    fontWeight: '900',
  },
  primaryButton: {
    marginTop: spacing.xl,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  primaryGradient: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: {
    color: '#241200',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 14,
    fontWeight: '800',
  },
  restoreButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default PremiumPaywallModal;
