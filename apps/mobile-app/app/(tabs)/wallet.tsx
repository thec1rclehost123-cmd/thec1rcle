import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { colors, gradients, typography } from '@/lib/design/theme';
import { trackScreen } from '@/lib/analytics';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api';
import { Wallet, ArrowDownUp, Clock } from 'lucide-react-native';

const ticketFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatTxnTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatTxnDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

export default function WalletScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrJwt, setQrJwt] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number>(0);
  const [qrRefreshError, setQrRefreshError] = useState(false);

  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const cardWidth = Math.min(width - 48, 380);
  const qrSize = 180;

  useEffect(() => {
    mountedRef.current = true;
    trackScreen('Wallet');
    loadWallet();
    return () => {
      mountedRef.current = false;
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, []);

  const loadWallet = async () => {
    if (!user?.uid) return;
    try {
      const data = await apiFetch('/api/v1/cover-charge/me');
      if (!mountedRef.current) return;
      if (data.wallet) {
        setWallet(data.wallet);
        setTransactions(data.transactions || []);
        if (data.wallet.state === 'ACTIVE') {
          fetchQrJwt(data.wallet.id);
        }
      } else {
        setWallet(null);
        setTransactions([]);
      }
    } catch {
      if (mountedRef.current) setWallet(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const fetchQrJwt = async (walletId: string) => {
    try {
      const data = await apiFetch(`/api/v1/cover-charge/wallet/${walletId}/qr-jwt`);
      if (!mountedRef.current) return;
      setQrJwt(data.jwt);
      setQrExpiresAt(new Date(data.expiresAt).getTime());
      setQrRefreshError(false);

      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      qrTimerRef.current = setInterval(() => {
        fetchQrJwt(walletId);
      }, 55_000);
    } catch {
      // Don't destroy the existing valid QR on background refresh failure.
      // Keep the old JWT on screen and schedule a retry.
      if (!mountedRef.current) return;
      setQrRefreshError(true);
      if (!qrTimerRef.current) {
        qrTimerRef.current = setInterval(() => {
          fetchQrJwt(walletId);
        }, 55_000);
      }
    }
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  };

  const qrRotating = !!qrJwt;
  const qrTimeLeft = qrExpiresAt ? Math.max(0, Math.floor((qrExpiresAt - Date.now()) / 1000)) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.12)', 'rgba(5,5,6,0)']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Wallet size={24} color={colors.iris} strokeWidth={2.2} />
            <Text style={styles.headerTitle}>Cover Wallet</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <Text style={styles.loadingText}>Loading wallet...</Text>
          </View>
        ) : !wallet ? (
          <View style={styles.center}>
            <Wallet size={48} color="rgba(255,255,255,0.15)" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Active Wallet</Text>
            <Text style={styles.emptySubtitle}>
              Buy a ticket with cover charge to activate your digital wallet.
            </Text>
          </View>
        ) : (
          <>
            {/* Glassmorphism Card */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.cardWrap}>
              <View style={[styles.glassCard, { width: cardWidth }]}>
                <BlurView
                  experimentalBlurMethod="dimezisBlurView"
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0.08)',
                    'rgba(244,74,34,0.05)',
                    'rgba(255,255,255,0.02)',
                  ]}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                />

                {/* Wallet State Badge */}
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.stateBadge,
                      {
                        backgroundColor:
                          wallet.state === 'ACTIVE'
                            ? 'rgba(0,214,143,0.15)'
                            : wallet.state === 'PENDING'
                              ? 'rgba(255,170,0,0.15)'
                              : 'rgba(255,61,113,0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stateBadgeText,
                        {
                          color:
                            wallet.state === 'ACTIVE'
                              ? colors.success
                              : wallet.state === 'PENDING'
                                ? colors.warning
                                : colors.error,
                        },
                      ]}
                    >
                      {wallet.state === 'ACTIVE'
                        ? 'ACTIVE'
                        : wallet.state === 'PENDING'
                          ? 'LOCKED'
                          : wallet.state}
                    </Text>
                  </View>
                </View>

                {/* Balance */}
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>{formatRupees(wallet.currentBalancePaise)}</Text>
                <Text style={styles.openingBalance}>
                  Opening: {formatRupees(wallet.openingBalancePaise)}
                </Text>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* QR Code Section (only when ACTIVE) */}
                {wallet.state === 'ACTIVE' ? (
                  <View style={styles.qrSection}>
                    <Text style={styles.qrLabel}>Pay at Bar</Text>
                    <Text style={styles.qrHint}>
                      Show this QR to the bartender to pay from your cover balance
                    </Text>
                    <View style={styles.qrContainer}>
                      {qrRotating ? (
                        <>
                          <BlurView
                            experimentalBlurMethod="dimezisBlurView"
                            intensity={30}
                            tint="light"
                            style={StyleSheet.absoluteFill}
                          />
                          <QRCode
                            value={qrJwt}
                            size={qrSize}
                            color="#161616"
                            backgroundColor="transparent"
                          />
                        </>
                      ) : (
                        <View style={styles.qrPlaceholder}>
                          <Text style={styles.qrPlaceholderText}>Tap to load QR</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.qrTimerRow}>
                      <Clock size={12} color="rgba(255,255,255,0.35)" />
                      <Text style={styles.qrTimerText}>Refreshes in {qrTimeLeft}s</Text>
                    </View>
                    {qrRefreshError && (
                      <Text style={styles.qrRetryText}>
                        Could not refresh — previous code still active
                      </Text>
                    )}
                  </View>
                ) : wallet.state === 'PENDING' ? (
                  <View style={styles.lockedBanner}>
                    <Text style={styles.lockedIcon}>🔒</Text>
                    <Text style={styles.lockedTitle}>Wallet Locked</Text>
                    <Text style={styles.lockedSubtitle}>
                      Check in at the venue to unlock your cover balance.
                    </Text>
                  </View>
                ) : null}

                {/* Termination info */}
                {wallet.terminationTime && (
                  <Text style={styles.terminationText}>
                    Valid until {formatTxnDate(wallet.terminationTime)} at{' '}
                    {formatTxnTime(wallet.terminationTime)}
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Transaction History */}
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <ArrowDownUp size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                <Text style={styles.historyTitle}>Transaction History</Text>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Text style={styles.historyEmptyText}>No transactions yet</Text>
                </View>
              ) : (
                transactions.map((txn: any, i: number) => (
                  <View key={txn.id || i} style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyItemName}>
                        {txn.presetItemName ||
                          (txn.type === 'TOP_UP'
                            ? 'Top Up'
                            : txn.type === 'REVERSAL'
                              ? 'Reversal'
                              : txn.type === 'DEBIT'
                                ? 'Charge'
                                : txn.type)}
                      </Text>
                      <Text style={styles.historyTime}>
                        {formatTxnDate(txn.createdAt)} {formatTxnTime(txn.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyAmount,
                        {
                          color:
                            txn.type === 'DEBIT' || txn.type === 'EXPIRY_FORFEIT'
                              ? colors.error
                              : colors.success,
                        },
                      ]}
                    >
                      {txn.type === 'DEBIT' || txn.type === 'EXPIRY_FORFEIT' ? '-' : '+'}
                      {formatRupees(txn.amountPaise)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050506',
  },
  scrollView: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    fontFamily: ticketFont.bold,
  },

  // Loading
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },

  // Empty
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Card
  cardWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  glassCard: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stateBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    fontFamily: ticketFont.black,
    marginTop: 4,
  },
  openingBalance: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 4,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },

  // QR
  qrSection: {
    alignItems: 'center',
  },
  qrLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  qrHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  qrContainer: {
    width: 200,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  qrPlaceholderText: {
    color: 'rgba(0,0,0,0.3)',
    fontSize: 13,
    fontWeight: '600',
  },
  qrTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  qrTimerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  qrRetryText: {
    color: 'rgba(255,170,0,0.6)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },

  // Locked
  lockedBanner: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  lockedIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  lockedTitle: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '700',
  },
  lockedSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },

  // Termination
  terminationText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },

  // History
  historySection: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  historyTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historyEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  historyEmptyText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  historyLeft: {
    flex: 1,
  },
  historyItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: ticketFont.bold,
  },
});
