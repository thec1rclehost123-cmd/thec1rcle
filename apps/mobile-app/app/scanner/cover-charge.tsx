/**
 * Cover-Charge Screen
 *
 * State machine: IDLE → SCANNING → WALLET_LOADED → CONFIRM_DEBIT → SUBMITTING → SUCCESS / DEBIT_ERROR
 *
 * Auth: Uses sessionToken from scannerStore — NOT Firebase currentUser (scanner is a no-auth route)
 * Idempotency: key generated once per item selection, preserved on retry, regenerated on "New Guest"
 * Offline: hard block — no queue
 * Mount guard: all setState calls guarded with mountedRef
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import { randomUUID } from 'expo-crypto';
import { useScannerStore } from '@/store/scannerStore';
import { fetchWalletByPaymentQr, submitDebit } from '@/lib/scanner';
import { WalletContext, PresetItem } from '@/lib/scanner/types';
import { PresetGrid } from '@/components/scanner/PresetGrid';
import { CoverDeductionOverlay } from '@/components/scanner/CoverDeductionOverlay';
import { colors } from '@/lib/design/theme';

type ChargeState =
  | 'IDLE'
  | 'SCANNING'
  | 'WALLET_LOADED'
  | 'CONFIRM_DEBIT'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'DEBIT_ERROR';

type NoInfer<T> = [T][T extends any ? 0 : never];

function formatPaiseCurrency(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

export default function CoverChargeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [chargeState, setChargeState] = useState<ChargeState>('IDLE');
  const [wallet, setWallet] = useState<WalletContext | null>(null);
  const [selectedItem, setSelectedItem] = useState<PresetItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<{
    itemName: string;
    amountPaise: number;
    newBalancePaise: number;
  } | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const { eventData, sessionToken } = useScannerStore();
  const mountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  // H12: idempotencyKey — generated once per item selection, never regenerated on retry
  const idempotencyKeyRef = useRef<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    Network.getNetworkStateAsync().then((state) => {
      if (mountedRef.current) setIsOffline(!state.isConnected);
    });
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!eventData?.valid) {
      router.replace('/scanner' as any);
    }
  }, []);

  const safeSetState = <T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<NoInfer<T>>,
  ) => {
    if (mountedRef.current) setter(value);
  };

  const handleQRScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (chargeState !== 'IDLE' || data === lastScannedRef.current) return;
      lastScannedRef.current = data;
      safeSetState(setChargeState, 'SCANNING');

      if (isOffline) {
        safeSetState(setErrorMessage, 'No internet connection. Connect to Wi-Fi or mobile data.');
        safeSetState(setChargeState, 'DEBIT_ERROR');
        return;
      }

      const token = sessionToken || eventData?.sessionToken;
      if (!token) {
        safeSetState(setErrorMessage, 'Scanner session expired. Please re-enter the event code.');
        safeSetState(setChargeState, 'DEBIT_ERROR');
        return;
      }

      const result = await fetchWalletByPaymentQr(data, token, {
        eventId: eventData?.event.id,
        eventCode: eventData?.code,
        venueId: eventData?.event.venueId,
        gate: eventData?.gate,
      });
      if (!mountedRef.current) return;

      if ('error' in result) {
        safeSetState(setErrorMessage, result.error);
        safeSetState(setChargeState, 'DEBIT_ERROR');
        return;
      }

      safeSetState(setWallet, result.wallet);
      safeSetState(setChargeState, 'WALLET_LOADED');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [
      chargeState,
      isOffline,
      sessionToken,
      eventData?.sessionToken,
      eventData?.event.id,
      eventData?.event.venueId,
      eventData?.code,
      eventData?.gate,
    ],
  );

  const handleItemSelect = (item: PresetItem) => {
    if (isOffline) {
      Alert.alert('No Connection', 'Connect to Wi-Fi or mobile data to charge wallets.');
      return;
    }
    if (!wallet) return;
    if (item.amountPaise > wallet.currentBalancePaise) {
      Alert.alert(
        'Insufficient Balance',
        `${wallet.guestFirstName}'s wallet has ${formatPaiseCurrency(wallet.currentBalancePaise)}.\n\nItem costs ${formatPaiseCurrency(item.amountPaise)}.`,
      );
      return;
    }
    // Generate idempotency key once for this item selection
    idempotencyKeyRef.current = randomUUID();
    safeSetState(setSelectedItem, item);
    safeSetState(setChargeState, 'CONFIRM_DEBIT');
  };

  const handleConfirmCharge = async () => {
    if (!wallet || !selectedItem || !idempotencyKeyRef.current) return;
    safeSetState(setChargeState, 'SUBMITTING');

    const token = sessionToken || eventData?.sessionToken || '';
    const result = await submitDebit(
      {
        walletId: wallet.id,
        presetItemId: selectedItem.id,
        quantity: 1,
        idempotencyKey: idempotencyKeyRef.current,
      },
      token,
    );

    if (!mountedRef.current) return;

    if (!result.success) {
      safeSetState(setErrorMessage, result.error || 'Charge failed');
      safeSetState(setChargeState, 'DEBIT_ERROR');
      return;
    }

    const newBalance =
      result.balanceAfterPaise ?? wallet.currentBalancePaise - selectedItem.amountPaise;
    if (mountedRef.current && wallet) {
      setWallet({ ...wallet, currentBalancePaise: newBalance });
    }
    if (mountedRef.current) {
      setSuccessReceipt({
        itemName: selectedItem.name,
        amountPaise: selectedItem.amountPaise,
        newBalancePaise: newBalance,
      });
    }
    safeSetState(setChargeState, 'SUCCESS');

    Vibration.vibrate([0, 100]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Auto-return to WALLET_LOADED after 3s for next item
    successTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setSuccessReceipt(null);
        setSelectedItem(null);
        setChargeState('WALLET_LOADED');
        idempotencyKeyRef.current = null;
      }
    }, 3000);
  };

  const handleRetry = () => {
    // H12: same idempotencyKey preserved — no double charge
    safeSetState(setErrorMessage, null);
    safeSetState(setChargeState, 'CONFIRM_DEBIT');
  };

  const handleCancelDebit = () => {
    idempotencyKeyRef.current = null;
    safeSetState(setSelectedItem, null);
    safeSetState(setErrorMessage, null);
    safeSetState(setWallet, null);
    lastScannedRef.current = null;
    safeSetState(setChargeState, 'IDLE');
  };

  const handleNewGuest = () => {
    idempotencyKeyRef.current = null;
    safeSetState(setSelectedItem, null);
    safeSetState(setWallet, null);
    safeSetState(setErrorMessage, null);
    lastScannedRef.current = null;
    safeSetState(setChargeState, 'IDLE');
  };

  const activeSessionToken = sessionToken || eventData?.sessionToken || '';

  if (!permission) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.iris} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSubtitle}>Needed to scan guest QR codes</Text>
        <Pressable onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const showCamera = chargeState === 'IDLE' || chargeState === 'SCANNING';

  return (
    <View style={styles.container}>
      {/* Camera — visible only in IDLE / SCANNING */}
      {showCamera && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={chargeState === 'IDLE' ? handleQRScanned : undefined}
        />
      )}

      {/* IDLE / SCANNING overlay */}
      {showCamera && (
        <View style={styles.cameraOverlay}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <View style={styles.chargeModeLabel}>
                <Text style={styles.chargeModeLabelText}>CHARGE MODE</Text>
              </View>
              <Text style={styles.eventName} numberOfLines={1}>
                {eventData?.event.title}
              </Text>
            </View>
          </SafeAreaView>

          <View style={styles.scanFrameContainer}>
            {chargeState === 'SCANNING' ? (
              <>
                <ActivityIndicator color={colors.iris} size="large" />
                <Text style={styles.scanHint}>Loading wallet...</Text>
              </>
            ) : (
              <>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>Scan guest QR to load cover wallet</Text>
              </>
            )}
          </View>

          <SafeAreaView edges={['bottom']}>
            <Pressable onPress={() => router.replace('/scanner' as any)} style={styles.exitBtn}>
              <Text style={styles.exitBtnText}>← Back</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      )}

      {/* WALLET_LOADED / SUCCESS */}
      {(chargeState === 'WALLET_LOADED' || chargeState === 'SUCCESS') && wallet && (
        <SafeAreaView style={styles.walletContainer} edges={['top', 'bottom']}>
          <View style={styles.walletHeader}>
            <Text style={styles.guestName}>{wallet.guestFirstName}</Text>
            <View style={styles.balanceChip}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceAmount}>
                {formatPaiseCurrency(wallet.currentBalancePaise)}
              </Text>
            </View>
          </View>

          {wallet.terminationTime &&
            (() => {
              const remaining = new Date(wallet.terminationTime).getTime() - Date.now();
              if (remaining < 2 * 60 * 60 * 1000 && remaining > 0) {
                const mins = Math.floor(remaining / 60000);
                return (
                  <View style={styles.terminationWarning}>
                    <Text style={styles.terminationWarningText}>Wallet expires in {mins}m</Text>
                  </View>
                );
              }
              return null;
            })()}

          {chargeState === 'SUCCESS' && successReceipt && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerTitle}>Charged!</Text>
              <Text style={styles.successBannerItem}>{successReceipt.itemName}</Text>
              <Text style={styles.successBannerAmount}>
                −{formatPaiseCurrency(successReceipt.amountPaise)}
              </Text>
              <Text style={styles.successBannerBalance}>
                New balance: {formatPaiseCurrency(successReceipt.newBalancePaise)}
              </Text>
            </View>
          )}

          <Text style={styles.selectLabel}>SELECT ITEM TO CHARGE</Text>
          <PresetGrid
            items={wallet.rules.allowedPresetItems}
            onSelect={handleItemSelect}
            disabled={chargeState === 'SUCCESS' || isOffline}
          />

          <Pressable onPress={handleNewGuest} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Done / New Guest</Text>
          </Pressable>
        </SafeAreaView>
      )}

      {chargeState === 'WALLET_LOADED' && wallet && activeSessionToken ? (
        <CoverDeductionOverlay
          wallet={wallet}
          sessionToken={activeSessionToken}
          onSuccess={() => handleNewGuest()}
          onDismiss={() => handleNewGuest()}
        />
      ) : null}

      {/* CONFIRM_DEBIT */}
      {chargeState === 'CONFIRM_DEBIT' && wallet && selectedItem && (
        <SafeAreaView style={[styles.container, styles.confirmContainer]} edges={['top', 'bottom']}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Charge</Text>
            <Text style={styles.confirmGuest}>{wallet.guestFirstName}</Text>
            <Text style={styles.confirmItem}>{selectedItem.name}</Text>
            <Text style={styles.confirmAmount}>
              −{formatPaiseCurrency(selectedItem.amountPaise)}
            </Text>
            <Text style={styles.confirmAfter}>
              Balance after:{' '}
              {formatPaiseCurrency(wallet.currentBalancePaise - selectedItem.amountPaise)}
            </Text>
          </View>

          <Pressable onPress={handleConfirmCharge} style={styles.chargeBtn}>
            <Text style={styles.chargeBtnText}>CHARGE</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              safeSetState(setChargeState, 'WALLET_LOADED');
              safeSetState(setSelectedItem, null);
              idempotencyKeyRef.current = null;
            }}
            style={styles.ghostBtn}
          >
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      )}

      {/* SUBMITTING */}
      {chargeState === 'SUBMITTING' && (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color={colors.iris} size="large" />
          <Text style={styles.submittingText}>Processing charge...</Text>
        </View>
      )}

      {/* DEBIT_ERROR */}
      {chargeState === 'DEBIT_ERROR' && (
        <SafeAreaView style={[styles.container, styles.center]} edges={['top', 'bottom']}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Charge Failed</Text>
          <Text style={styles.errorMessage}>{errorMessage || 'An error occurred.'}</Text>

          {selectedItem && wallet && (
            <Pressable onPress={handleRetry} style={styles.chargeBtn}>
              <Text style={styles.chargeBtnText}>Retry</Text>
            </Pressable>
          )}

          <Pressable onPress={handleCancelDebit} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  center: { alignItems: 'center', justifyContent: 'center' },

  permTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  permSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  primaryBtn: {
    backgroundColor: colors.iris,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Camera overlay
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    gap: 12,
  },
  chargeModeLabel: {
    backgroundColor: colors.iris,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chargeModeLabelText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  eventName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  scanFrameContainer: { alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 24,
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.iris },
  cornerTL: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  exitBtn: { alignItems: 'center', paddingVertical: 16 },
  exitBtnText: { color: colors.iris, fontSize: 16, fontWeight: '600' },

  // Wallet
  walletContainer: { flex: 1 },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  guestName: { color: '#fff', fontSize: 26, fontWeight: '800' },
  balanceChip: { alignItems: 'flex-end' },
  balanceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  balanceAmount: { color: colors.success, fontSize: 22, fontWeight: '800' },

  terminationWarning: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  terminationWarningText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  successBanner: {
    backgroundColor: 'rgba(0,214,143,0.12)',
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.3)',
    alignItems: 'center',
  },
  successBannerTitle: { color: colors.success, fontSize: 18, fontWeight: '800' },
  successBannerItem: { color: '#fff', fontSize: 15, marginTop: 4 },
  successBannerAmount: { color: colors.error, fontSize: 22, fontWeight: '800', marginTop: 4 },
  successBannerBalance: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },

  selectLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  ghostBtn: { alignItems: 'center', paddingVertical: 14, marginBottom: 8, marginHorizontal: 16 },
  ghostBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '600' },

  // Confirm
  confirmContainer: { justifyContent: 'center', paddingHorizontal: 24 },
  confirmCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  confirmTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  confirmGuest: { color: '#fff', fontSize: 22, fontWeight: '700' },
  confirmItem: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 8 },
  confirmAmount: { color: colors.error, fontSize: 36, fontWeight: '800', marginTop: 12 },
  confirmAfter: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 },

  chargeBtn: {
    backgroundColor: colors.success,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  chargeBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },

  submittingText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 16 },

  errorEmoji: { fontSize: 56, marginBottom: 12 },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  errorMessage: {
    color: colors.error,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 28,
    lineHeight: 22,
  },
});
