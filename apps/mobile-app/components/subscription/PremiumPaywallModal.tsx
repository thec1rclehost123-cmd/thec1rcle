import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Sparkles, X } from 'lucide-react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { colors, radii, spacing } from '@/lib/design/theme';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { apiFetch } from '@/lib/api';

const PERKS = ['Unlimited Likes', '5 Ask Outs daily', 'Zero booking fees', 'Full likes visibility'];

export function PremiumPaywallModal() {
  const paywall = useSubscriptionStore((state) => state.paywall);
  const closePaywall = useSubscriptionStore((state) => state.closePaywall);
  const hydrateFromRevenueCat = useSubscriptionStore((state) => state.hydrateFromRevenueCat);

  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paywall.visible) return;
    setError(null);
    Purchases.getOfferings()
      .then((result) => {
        const current = result.current;
        if (current?.availablePackages) {
          setOfferings(current.availablePackages);
        }
      })
      .catch(() => {});
  }, [paywall.visible]);

  const handlePurchase = async () => {
    if (offerings.length === 0) return;
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

  return (
    <Modal visible={paywall.visible} transparent animationType="fade" onRequestClose={closePaywall}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={closePaywall} />
        <View style={styles.sheet}>
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
            {PERKS.map((perk) => (
              <View key={perk} style={styles.perkPill}>
                <Sparkles size={13} color="#F6C55B" strokeWidth={2.4} />
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {offerings.length > 0 && (
            <Text style={styles.pricingText}>
              {offerings[0].product.priceString}/
              {offerings[0].packageType === Purchases.PACKAGE_TYPE.LIFETIME ? 'once' : 'month'}
            </Text>
          )}

          <Pressable
            style={styles.primaryButton}
            onPress={handlePurchase}
            disabled={purchasing || offerings.length === 0}
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
          <Pressable style={styles.secondaryButton} onPress={closePaywall} disabled={purchasing}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
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
  sheet: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
});

export default PremiumPaywallModal;
