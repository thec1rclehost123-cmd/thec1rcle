import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useScannerStore } from '@/store/scannerStore';
import {
  processQRScan,
  recordStaffDeny,
  fetchWalletByOrder,
  getScannerDeviceId,
} from '@/lib/scanner';
import { ScanResultData, ScanResultType, WalletContext } from '@/lib/scanner/types';
import { colors, gradients } from '@/lib/design/theme';
import { CoverDeductionOverlay } from '@/components/scanner/CoverDeductionOverlay';

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.68;

type TierBadge = { label: string; bg: string; fg: string };
function getTierBadge(entryType: string): TierBadge | null {
  switch (entryType?.toLowerCase()) {
    case 'stag':
      return { label: 'STAG  ·  MALE ONLY', bg: 'rgba(251,191,36,0.18)', fg: colors.warning };
    case 'female':
      return { label: 'FEMALE ONLY', bg: 'rgba(236,72,153,0.18)', fg: '#EC4899' };
    case 'couple':
      return { label: 'COUPLE ENTRY', bg: 'rgba(99,102,241,0.18)', fg: '#818CF8' };
    case 'vip':
      return { label: 'VIP ACCESS', bg: 'rgba(168,85,247,0.18)', fg: '#a855f7' };
    default:
      return null;
  }
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [showCoupleModal, setShowCoupleModal] = useState(false);
  const [pendingCoupleData, setPendingCoupleData] = useState<any>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [coverWallet, setCoverWallet] = useState<WalletContext | null>(null);
  const [showCoverOverlay, setShowCoverOverlay] = useState(false);
  const [pendingCoverResult, setPendingCoverResult] = useState<any>(null);
  const [scannerDeviceId, setScannerDeviceId] = useState('');

  const { eventData, clearEvent, sessionToken } = useScannerStore();
  const lastScannedRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resultScale = useSharedValue(0);
  const resultOpacity = useSharedValue(0);

  useEffect(() => {
    if (!eventData?.valid) {
      router.replace('/scanner' as any);
      return;
    }
    if (eventData?.stats) {
      setEntryCount(eventData.stats.totalEntered);
    }
    getScannerDeviceId()
      .then((id) => setScannerDeviceId(id))
      .catch(() => {});
  }, []);

  const showResultOverlay = (result: ScanResultData) => {
    setScanResult(result);
    resultScale.value = withSpring(1, { damping: 15 });
    resultOpacity.value = withTiming(1, { duration: 200 });

    if (result.type === 'valid') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (result.type === 'already_scanned') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    scanTimeoutRef.current = setTimeout(() => dismissResult(), 3000);
  };

  const dismissResult = () => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    resultScale.value = withSpring(0);
    resultOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => {
      setScanResult(null);
      setIsScanning(true);
      lastScannedRef.current = null;
    }, 200);
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (!isScanning || data === lastScannedRef.current) return;
    setIsScanning(false);
    lastScannedRef.current = data;

    try {
      const result = await processQRScan(
        {
          qrData: data,
          eventId: eventData?.event.id || '',
          eventCode: eventData?.code || '',
          gate: eventData?.gate,
          venueId: eventData?.event.venueId,
        },
        sessionToken || eventData?.sessionToken,
      );

      // H10: Session expired — code revoked mid-session
      if (result.result === 'session_expired') {
        Alert.alert(
          'Session Expired',
          'Your scanner code has been revoked. Please get a new code.',
          [
            {
              text: 'OK',
              onPress: () => {
                clearEvent();
                router.replace('/scanner' as any);
              },
            },
          ],
        );
        return;
      }

      if (result.success && result.ticket?.entryType === 'couple') {
        setPendingCoupleData(result);
        setShowCoupleModal(true);
        return;
      }

      // Cover charge: fetch wallet and show deduction overlay
      if (result.success && result.ticket?.entryType === 'cover' && result.ticket?.orderId) {
        const walletResult = await fetchWalletByOrder(
          result.ticket.orderId,
          sessionToken || eventData?.sessionToken || '',
        );
        if ('wallet' in walletResult && walletResult.wallet.state === 'ACTIVE') {
          setCoverWallet(walletResult.wallet);
          setPendingCoverResult(result);
          setShowCoverOverlay(true);
          return;
        }
        // Wallet not active or not found — fall through to normal entry
      }

      handleScanResult(result);
    } catch (error: any) {
      showResultOverlay({ type: 'invalid', message: error.message || 'Scan failed' });
    }
  };

  const handleScanResult = (result: any) => {
    if (result.success) {
      setEntryCount((prev) => prev + (result.ticket?.quantity || 1));
      showResultOverlay({
        type: 'valid',
        message: result.message || 'Entry approved!',
        guest: {
          name: result.ticket?.userName || 'Guest',
          ticketType: result.ticket?.ticketName || 'Entry',
          quantity: result.ticket?.quantity || 1,
          entryType: result.ticket?.entryType || 'general',
        },
      });
    } else {
      showResultOverlay({
        type: result.result || 'invalid',
        message: result.error || 'Invalid ticket',
        previousScan: result.previousScan
          ? {
              time: result.previousScan.scannedAt,
              by: result.previousScan.scannedBy?.name || '',
            }
          : undefined,
      });
    }
  };

  const handleCoupleConfirm = (present: boolean) => {
    setShowCoupleModal(false);
    if (present && pendingCoupleData) {
      handleScanResult(pendingCoupleData);
    } else {
      showResultOverlay({ type: 'invalid', message: 'Couple entry requires both guests present' });
    }
    setPendingCoupleData(null);
  };

  const handleExit = () => {
    clearEvent();
    router.replace('/scanner' as any);
  };

  const resultAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: resultScale.value }],
    opacity: resultOpacity.value,
  }));

  const getResultColor = (type: ScanResultType): string => {
    if (type === 'valid') return colors.success;
    if (type === 'already_scanned') return colors.warning;
    if (type === 'network_error') return colors.warning;
    return colors.error;
  };

  const getResultIcon = (type: ScanResultType): string => {
    if (type === 'valid') return '✅';
    if (type === 'already_scanned') return '⚠️';
    if (type === 'network_error') return '📡';
    return '❌';
  };

  const getResultTitle = (type: ScanResultType): string => {
    if (type === 'valid') return 'Entry Approved';
    if (type === 'already_scanned') return 'Already Scanned';
    if (type === 'network_error') return 'Connection Issue';
    return 'Entry Denied';
  };

  // Permission: loading
  if (!permission) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  // Permission: not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 56 }}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSubtitle}>We need camera permission to scan ticket QR codes</Text>
        <Pressable onPress={requestPermission} style={styles.permButton}>
          <LinearGradient
            colors={gradients.primary as [string, string]}
            style={styles.permButtonInner}
          >
            <Text style={styles.permButtonText}>Grant Permission</Text>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashEnabled}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* L6: Capacity warning banner */}
        {(() => {
          const capacity = eventData?.event.capacity || 500;
          const pct = entryCount / capacity;
          if (pct < 0.8) return null;
          const isCritical = pct >= 0.95;
          return (
            <View
              style={[
                styles.capacityBanner,
                { backgroundColor: isCritical ? 'rgba(239,68,68,0.9)' : 'rgba(251,191,36,0.9)' },
              ]}
            >
              <Text style={[styles.capacityBannerText, { color: isCritical ? '#fff' : '#000' }]}>
                {isCritical ? 'VENUE NEAR CAPACITY' : `${Math.round(pct * 100)}% FULL`}
              </Text>
            </View>
          );
        })()}

        {/* Top Bar — Event info + navigation */}
        <SafeAreaView edges={['top']}>
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>SCANNING</Text>
              </View>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {eventData?.event.title}
              </Text>
              {eventData?.gate && <Text style={styles.gateText}>{eventData.gate}</Text>}
            </View>
            <View style={styles.topBarRight}>
              <View style={styles.counterBadge}>
                <Text style={styles.counterNumber}>{entryCount}</Text>
                <Text style={styles.counterLabel}>entered</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* Scan Frame */}
        <View style={styles.scanFrameContainer}>
          <View
            style={[
              styles.scanFrame,
              {
                borderColor: scanResult ? getResultColor(scanResult.type) : 'rgba(255,255,255,0.4)',
              },
            ]}
          >
            {/* Corner accents */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>Point camera at ticket QR code</Text>
        </View>

        {/* Bottom Controls */}
        <SafeAreaView edges={['bottom']}>
          <View style={styles.bottomBar}>
            {/* Navigation Buttons Row */}
            <View style={styles.navRow}>
              {eventData?.permissions.canDoorEntry && (
                <Pressable
                  onPress={() => router.push('/scanner/door-entry' as any)}
                  style={styles.navButton}
                >
                  <Text style={styles.navIcon}>🚪</Text>
                  <Text style={styles.navLabel}>Door Entry</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => setFlashEnabled(!flashEnabled)}
                style={[styles.flashButton, flashEnabled && styles.flashActive]}
              >
                <Text style={{ fontSize: 24 }}>{flashEnabled ? '⚡' : '🔦'}</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/scanner/stats' as any)}
                style={styles.navButton}
              >
                <Text style={styles.navIcon}>📊</Text>
                <Text style={styles.navLabel}>Stats</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/scanner/guestlist' as any)}
                style={styles.navButton}
              >
                <Text style={styles.navIcon}>👥</Text>
                <Text style={styles.navLabel}>Guests</Text>
              </Pressable>

              {eventData?.permissions.canWalkIn && (
                <Pressable
                  onPress={() => router.push('/scanner/walk-ins' as any)}
                  style={styles.navButton}
                >
                  <Text style={styles.navIcon}>🚶</Text>
                  <Text style={styles.navLabel}>Walk-ins</Text>
                </Pressable>
              )}
            </View>

            {/* Exit Button */}
            <Pressable onPress={handleExit} style={styles.exitButton}>
              <Text style={styles.exitText}>Exit Scanner</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      {/* Scan Result Overlay */}
      {scanResult && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, resultAnimatedStyle, { zIndex: 100 }]}
        >
          <Pressable
            onPress={dismissResult}
            style={[styles.resultOverlay, { backgroundColor: getResultColor(scanResult.type) }]}
          >
            <Text style={{ fontSize: 96 }}>{getResultIcon(scanResult.type)}</Text>
            <Text style={styles.resultTitle}>{getResultTitle(scanResult.type)}</Text>

            {scanResult.guest && scanResult.type === 'valid' && (
              <View style={styles.resultGuestInfo}>
                <Text style={styles.resultGuestName}>{scanResult.guest.name}</Text>
                <View style={styles.resultBadgeRow}>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeText}>{scanResult.guest.ticketType}</Text>
                  </View>
                  {scanResult.guest.quantity > 1 && (
                    <View style={styles.resultBadge}>
                      <Text style={styles.resultBadgeText}>×{scanResult.guest.quantity}</Text>
                    </View>
                  )}
                </View>
                {/* Gender / tier badge */}
                {(() => {
                  const badge = getTierBadge(scanResult.guest?.entryType || '');
                  if (!badge) return null;
                  return (
                    <View style={[styles.tierBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.tierBadgeText, { color: badge.fg }]}>{badge.label}</Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Staff deny override — valid scans only */}
            {scanResult.type === 'valid' && (
              <Pressable
                onPress={() => {
                  dismissResult();
                  recordStaffDeny(
                    {
                      qrData: lastScannedRef.current || '',
                      eventId: eventData?.event.id || '',
                      eventCode: eventData?.code || '',
                      gate: eventData?.gate,
                      reason: 'staff_visual_check',
                    },
                    sessionToken || eventData?.sessionToken,
                  );
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }}
                style={styles.denyOverrideBtn}
              >
                <Text style={styles.denyOverrideBtnText}>DENY ENTRY</Text>
              </Pressable>
            )}

            {scanResult.type === 'already_scanned' && scanResult.previousScan && (
              <View style={styles.resultPrevScan}>
                <Text style={styles.resultPrevText}>Scanned at {scanResult.previousScan.time}</Text>
                {scanResult.previousScan.by && (
                  <Text style={styles.resultPrevBy}>by {scanResult.previousScan.by}</Text>
                )}
              </View>
            )}

            {scanResult.type !== 'valid' && scanResult.type !== 'already_scanned' && (
              <Text style={styles.resultMessage}>{scanResult.message}</Text>
            )}

            <Text style={styles.resultDismissHint}>Tap anywhere to continue</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Cover Charge Deduction Overlay */}
      {showCoverOverlay && coverWallet && (
        <CoverDeductionOverlay
          wallet={coverWallet}
          sessionToken={sessionToken || eventData?.sessionToken || ''}
          deviceId={scannerDeviceId}
          eventCodeId={eventData?.codeId || ''}
          operatorId={eventData?.codeId || ''}
          operatorName="Staff"
          onSuccess={(newBalance) => {
            setShowCoverOverlay(false);
            setCoverWallet(null);
            if (pendingCoverResult) handleScanResult(pendingCoverResult);
            setPendingCoverResult(null);
          }}
          onDismiss={() => {
            setShowCoverOverlay(false);
            setCoverWallet(null);
            setPendingCoverResult(null);
            setIsScanning(true);
            lastScannedRef.current = null;
          }}
        />
      )}

      {/* Couple Confirm Modal */}
      <Modal visible={showCoupleModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>👫</Text>
            <Text style={styles.modalTitle}>Couple Entry</Text>
            {pendingCoupleData?.ticket?.userName && (
              <Text style={styles.modalSubtitle}>{pendingCoupleData.ticket.userName}</Text>
            )}
            <Text style={styles.modalQuestion}>Is the partner present for this couple entry?</Text>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => handleCoupleConfirm(false)}
                style={[styles.modalBtn, styles.modalBtnNo]}
              >
                <Text style={styles.modalBtnNoText}>No</Text>
              </Pressable>
              <Pressable
                onPress={() => handleCoupleConfirm(true)}
                style={[styles.modalBtn, styles.modalBtnYes]}
              >
                <Text style={styles.modalBtnYesText}>Yes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.goldMetallic, fontSize: 16 },
  permTitle: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  permSubtitle: {
    color: colors.goldMetallic,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  permButton: { borderRadius: 16, overflow: 'hidden' },
  permButtonInner: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  permButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  topBarLeft: { flex: 1, marginRight: 12 },
  topBarRight: {},
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  liveText: { color: colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  eventTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  gateText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  counterBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  counterNumber: { color: '#fff', fontSize: 22, fontWeight: '800' },
  counterLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  scanFrameContainer: { alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    borderWidth: 2,
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
  scanHint: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 16, textAlign: 'center' },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  navButton: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  navIcon: { fontSize: 24, marginBottom: 4 },
  navLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  flashButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashActive: { backgroundColor: colors.warning },
  exitButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  exitText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' },

  // Result overlay
  resultOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 20,
    textAlign: 'center',
  },
  resultGuestInfo: { alignItems: 'center', marginTop: 20 },
  resultGuestName: { color: 'rgba(255,255,255,0.9)', fontSize: 24, fontWeight: '700' },
  resultBadgeRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  resultBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resultBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultEntryType: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 12,
    textTransform: 'capitalize',
  },
  resultPrevScan: { alignItems: 'center', marginTop: 20 },
  resultPrevText: { color: 'rgba(255,255,255,0.9)', fontSize: 16 },
  resultPrevBy: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 },
  resultMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  resultDismissHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 40 },

  // Capacity banner
  capacityBanner: { paddingVertical: 6, alignItems: 'center' },
  capacityBannerText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },

  // Tier badge
  tierBadge: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  tierBadgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },

  // Staff deny override
  denyOverrideBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  denyOverrideBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  // Couple modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.base[50],
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  modalTitle: { color: colors.gold, fontSize: 24, fontWeight: '800', marginTop: 12 },
  modalSubtitle: { color: colors.goldMetallic, fontSize: 16, marginTop: 4 },
  modalQuestion: {
    color: colors.goldMetallic,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButtons: { flexDirection: 'row', gap: 16, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnNo: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    borderColor: colors.error,
  },
  modalBtnNoText: { color: colors.error, fontSize: 18, fontWeight: '700' },
  modalBtnYes: { backgroundColor: colors.success },
  modalBtnYesText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
