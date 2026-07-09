/**
 * CoverDeductionOverlay
 *
 * Shown in the scanner app when a cover-charge ticket is scanned.
 * Staff selects a preset item (or enters a custom amount) and taps Process.
 *
 * Rules enforced here:
 *  - Offline is hard-blocked (no offline cover charges)
 *  - Insufficient balance blocks Process button with cash fallback message
 *  - Every tap generates a fresh idempotencyKey (randomUUID) to prevent double-charge
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import { PresetGrid } from './PresetGrid';
import { submitDebit } from '@/lib/scanner/api';
import { WalletContext, PresetItem } from '@/lib/scanner/types';

interface Props {
  wallet: WalletContext;
  sessionToken: string;
  paymentQrJwt: string;
  deviceId: string;
  eventCodeId: string;
  operatorId: string;
  operatorName: string;
  onSuccess: (newBalancePaise: number) => void;
  onDismiss: () => void;
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

function randomKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function CoverDeductionOverlay({
  wallet,
  sessionToken,
  paymentQrJwt,
  deviceId,
  eventCodeId,
  operatorId,
  operatorName,
  onSuccess,
  onDismiss,
}: Props) {
  const [selectedPreset, setSelectedPreset] = useState<PresetItem | null>(null);
  const [customAmountStr, setCustomAmountStr] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successState, setSuccessState] = useState<{ charged: number; newBalance: number } | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedAmountPaise = showCustom
    ? parseInt(customAmountStr) || 0
    : (selectedPreset?.amountPaise ?? 0);

  const balance = wallet.currentBalancePaise;
  const deficit = selectedAmountPaise - balance;
  const isInsufficientBalance = selectedAmountPaise > 0 && deficit > 0;
  const canProcess =
    selectedAmountPaise > 0 && Boolean(paymentQrJwt) && !isInsufficientBalance && !isProcessing;

  const handleProcess = useCallback(async () => {
    if (!canProcess) return;

    // Hard-block if offline
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert(
        'No Connection',
        'Cover charges require an internet connection. Please connect and try again.',
      );
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = randomKey();
      const result = await submitDebit(
        {
          walletId: wallet.id,
          paymentQrJwt,
          ...(showCustom
            ? { customAmountPaise: selectedAmountPaise }
            : { presetItemId: selectedPreset?.id }),
          quantity: 1,
          idempotencyKey,
          operatorId,
          operatorName,
          deviceId,
          eventCodeId,
          isOnline: true,
        },
        sessionToken,
      );

      if (result.success && result.balanceAfterPaise !== undefined) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccessState({
          charged: selectedAmountPaise,
          newBalance: result.balanceAfterPaise,
        });
      } else {
        setErrorMsg(result.error || 'Charge failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsProcessing(false);
    }
  }, [
    canProcess,
    selectedAmountPaise,
    selectedPreset,
    showCustom,
    wallet.id,
    paymentQrJwt,
    sessionToken,
    deviceId,
    eventCodeId,
    operatorId,
    operatorName,
  ]);

  const percent =
    wallet.openingBalancePaise > 0
      ? Math.max(0, Math.min(100, (balance / wallet.openingBalancePaise) * 100))
      : 0;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {successState ? (
            /* ── Success state ── */
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successCharged}>Charged {formatPaise(successState.charged)}</Text>
              <Text style={styles.successBalance}>
                New Balance: {formatPaise(successState.newBalance)}
              </Text>
              <Pressable style={styles.doneBtn} onPress={() => onSuccess(successState.newBalance)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            /* ── Normal state ── */
            <>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerLabel}>COVER WALLET</Text>
                  <Text style={styles.guestName}>{wallet.guestFirstName || 'Guest'}</Text>
                </View>
                <Pressable onPress={onDismiss} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>

              {/* Balance bar */}
              <View style={styles.balanceRow}>
                <Text style={styles.balanceAmount}>{formatPaise(balance)}</Text>
                <Text style={styles.balanceOf}>/ {formatPaise(wallet.openingBalancePaise)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${percent}%` as any,
                      backgroundColor:
                        percent > 60 ? '#34d399' : percent > 25 ? '#a855f7' : '#71717a',
                    },
                  ]}
                />
              </View>

              {/* Preset grid */}
              <Text style={styles.sectionLabel}>SELECT ITEM</Text>
              <PresetGrid
                items={wallet.rules.allowedPresetItems}
                onSelect={(item) => {
                  setSelectedPreset(item);
                  setShowCustom(false);
                  setErrorMsg(null);
                }}
                disabled={isProcessing}
              />

              {/* Custom amount toggle */}
              <Pressable
                onPress={() => {
                  setShowCustom((v) => !v);
                  setSelectedPreset(null);
                  setErrorMsg(null);
                }}
                style={styles.customToggle}
              >
                <Text style={styles.customToggleText}>
                  {showCustom ? '← Use Preset' : 'Custom Amount'}
                </Text>
              </Pressable>

              {showCustom && (
                <View style={styles.customInputRow}>
                  <Text style={styles.customPrefix}>₹</Text>
                  <TextInput
                    style={styles.customInput}
                    value={customAmountStr}
                    onChangeText={(v) => {
                      setCustomAmountStr(v.replace(/[^0-9]/g, ''));
                      setErrorMsg(null);
                    }}
                    keyboardType="number-pad"
                    placeholder="Enter amount in paise"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    maxLength={8}
                  />
                </View>
              )}

              {/* Selected item summary */}
              {selectedAmountPaise > 0 && !isInsufficientBalance && (
                <View style={styles.selectedSummary}>
                  <Text style={styles.selectedSummaryText}>
                    {showCustom ? 'Custom' : selectedPreset?.name} —{' '}
                    {formatPaise(selectedAmountPaise)}
                  </Text>
                </View>
              )}

              {/* Insufficient balance warning */}
              {isInsufficientBalance && (
                <View style={styles.insufficientBanner}>
                  <Text style={styles.insufficientText}>
                    Insufficient Balance — Collect {formatPaise(deficit)} in cash
                  </Text>
                </View>
              )}

              {/* Error */}
              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              {/* Process button */}
              <Pressable
                style={[styles.processBtn, !canProcess && styles.processBtnDisabled]}
                onPress={handleProcess}
                disabled={!canProcess}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.processBtnText}>
                    {selectedAmountPaise > 0
                      ? `Process ${formatPaise(selectedAmountPaise)}`
                      : 'Select an item'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1d',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168,85,247,0.2)',
  },
  headerLeft: { flex: 1 },
  headerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#a855f7',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 14 },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  balanceOf: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 6,
  },
  progressTrack: {
    marginHorizontal: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  customToggle: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  customToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(168,85,247,0.7)',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    paddingHorizontal: 14,
  },
  customPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#a855f7',
    marginRight: 4,
  },
  customInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    paddingVertical: 12,
  },
  selectedSummary: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a855f7',
  },
  insufficientBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  insufficientText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f87171',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#f87171',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  processBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#a855f7',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  processBtnDisabled: {
    backgroundColor: 'rgba(168,85,247,0.25)',
  },
  processBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Success state
  successContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successCharged: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  successBalance: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: '#a855f7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
