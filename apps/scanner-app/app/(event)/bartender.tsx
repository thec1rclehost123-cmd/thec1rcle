import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { verifyWalletQr, submitCustomDebit } from '@/lib/api/bartender';
import { useEvent } from '@/store/eventContext';

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

type ScreenState =
  | 'SCANNING'
  | 'WALLET_LOADED'
  | 'AMOUNT_INPUT'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'ERROR';

const NUMPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['₹0', '00', '⌫'],
];

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function getDeviceId(): string {
  const installId = (Constants as any).installationId || 'device';
  return `${Constants.platform?.os || 'mobile'}-${installId}`.substring(0, 40);
}

export default function BartenderScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [screenState, setScreenState] = useState<ScreenState>('SCANNING');
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [amountInput, setAmountInput] = useState('');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { eventData } = useEvent();
  const lastScannedRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resultScale = useSharedValue(0);
  const resultOpacity = useSharedValue(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (screenState === 'SCANNING') {
      setAmountInput('');
      idempotencyKeyRef.current = null;
    }
  }, [screenState]);

  const showResult = (type: 'success' | 'error') => {
    resultScale.value = withSpring(1, { damping: 15 });
    resultOpacity.value = withTiming(1, { duration: 200 });
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleBarCodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (screenState !== 'SCANNING' || data === lastScannedRef.current) return;
      lastScannedRef.current = data;
      setScreenState('WALLET_LOADED');

      try {
        const result = await verifyWalletQr(data);
        if (!mountedRef.current) return;

        if (!result.success) {
          setErrorMessage(result.error || 'Invalid wallet QR');
          setScreenState('ERROR');
          showResult('error');
          return;
        }

        setWalletInfo(result.wallet);
        setScreenState('AMOUNT_INPUT');
        setAmountInput('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: any) {
        if (!mountedRef.current) return;
        setErrorMessage(err.message || 'Failed to verify QR');
        setScreenState('ERROR');
        showResult('error');
      }
    },
    [screenState],
  );

  const handleNumpadPress = (key: string) => {
    if (key === '⌫') {
      setAmountInput((prev) => prev.slice(0, -1));
      return;
    }
    // ₹0 acts as two zeros
    if (key === '₹0') {
      setAmountInput((prev) => prev + '00');
      return;
    }
    if (key === '00') {
      setAmountInput((prev) => prev + '00');
      return;
    }
    if (key === '0') {
      setAmountInput((prev) => prev + '0');
      return;
    }
    // 1-9 digits
    if (/^[1-9]$/.test(key)) {
      setAmountInput((prev) => prev + key);
    }
  };

  const handleCharge = async () => {
    if (!walletInfo || !amountInput) return;

    const amountPaise = parseInt(amountInput, 10) * 100; // convert rupees to paise
    if (amountPaise <= 0) return;
    if (amountPaise > walletInfo.currentBalancePaise) {
      setErrorMessage('Amount exceeds available balance');
      setScreenState('ERROR');
      showResult('error');
      return;
    }

    idempotencyKeyRef.current = randomUUID();
    setScreenState('SUBMITTING');

    try {
      const result = await submitCustomDebit({
        walletId: walletInfo.id,
        customAmountPaise: amountPaise,
        idempotencyKey: idempotencyKeyRef.current,
        deviceId: getDeviceId(),
        eventCodeId: eventData?.codeId || 'bartender',
        operatorId: eventData?.codeId || `scanner_${eventData?.code}`,
      });

      if (!mountedRef.current) return;

      if (!result.success) {
        setErrorMessage(result.message || result.error || 'Charge failed');
        setScreenState('ERROR');
        showResult('error');
        return;
      }

      setSuccessData({
        amountPaise,
        newBalancePaise: result.balanceAfterPaise ?? walletInfo.currentBalancePaise - amountPaise,
      });
      setScreenState('SUCCESS');
      showResult('success');

      successTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setWalletInfo(null);
          setAmountInput('');
          setSuccessData(null);
          setErrorMessage(null);
          setScreenState('SCANNING');
          lastScannedRef.current = null;
        }
      }, 3000);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setErrorMessage(err.message || 'Network error');
      setScreenState('ERROR');
      showResult('error');
    }
  };

  const handleReset = () => {
    setWalletInfo(null);
    setAmountInput('');
    setSuccessData(null);
    setErrorMessage(null);
    setScreenState('SCANNING');
    lastScannedRef.current = null;
    idempotencyKeyRef.current = null;
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-background-primary items-center justify-center">
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background-primary items-center justify-center px-6">
        <Ionicons name="camera-outline" size={64} color="#71717A" />
        <Text className="text-text-primary text-xl font-bold mt-4 text-center">
          Camera Access Required
        </Text>
        <Text className="text-text-secondary text-center mt-2 mb-6">
          We need camera permission to scan wallet QR codes
        </Text>
        <TouchableOpacity onPress={requestPermission} className="bg-accent px-8 py-4 rounded-xl">
          <Text className="text-white font-bold text-lg">Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const showCamera = screenState === 'SCANNING' || screenState === 'WALLET_LOADED';

  return (
    <View className="flex-1 bg-background-primary">
      {/* Camera — visible during SCANNING / WALLET_LOADED */}
      {showCamera && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={flashEnabled}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={screenState === 'SCANNING' ? handleBarCodeScanned : undefined}
        />
      )}

      {/* Scanning Overlay */}
      {screenState === 'SCANNING' && (
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-4 py-3 bg-black/60">
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-success mr-2 opacity-80" />
              <Text className="text-white font-medium">Bartender Mode</Text>
            </View>
          </View>

          <View className="flex-1 items-center justify-center">
            <View
              style={{
                width: SCAN_AREA_SIZE,
                height: SCAN_AREA_SIZE,
                borderWidth: 3,
                borderColor: '#FFFFFF',
                borderRadius: 24,
              }}
            >
              <View className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-xl" />
              <View className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-xl" />
              <View className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-xl" />
              <View className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-xl" />
            </View>
            <Text className="text-white/80 mt-6 text-center">Scan guest Pay-at-Bar QR code</Text>
          </View>

          <View className="flex-row items-center justify-center gap-8 pb-8 bg-black/60 pt-4">
            <TouchableOpacity
              onPress={() => setFlashEnabled(!flashEnabled)}
              className={`w-14 h-14 rounded-full items-center justify-center ${flashEnabled ? 'bg-warning' : 'bg-white/20'}`}
            >
              <Ionicons name={flashEnabled ? 'flash' : 'flash-off'} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Wallet Loading */}
      {screenState === 'WALLET_LOADED' && (
        <View className="flex-1 items-center justify-center bg-black/80">
          <ActivityIndicator color="#6366F1" size="large" />
          <Text className="text-text-secondary mt-4">Loading wallet...</Text>
        </View>
      )}

      {/* AMOUNT INPUT — Full numpad */}
      {screenState === 'AMOUNT_INPUT' && walletInfo && (
        <SafeAreaView className="flex-1 bg-background-primary" edges={['top', 'bottom']}>
          {/* Guest Info Bar */}
          <View className="bg-background-secondary px-6 py-4 border-b border-border">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-text-primary text-xl font-bold">{walletInfo.guestName}</Text>
                <Text className="text-text-secondary text-sm mt-1">
                  Balance: {formatPaise(walletInfo.currentBalancePaise)}
                </Text>
              </View>
              <TouchableOpacity onPress={handleReset} className="p-2">
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount Display */}
          <View className="flex-1 justify-center items-center px-6">
            <Text className="text-text-muted text-sm mb-2">Enter Amount</Text>
            <Text className="text-text-primary text-5xl font-bold tracking-wider">
              {amountInput ? `₹${amountInput}` : '₹0'}
            </Text>
            {amountInput && (
              <Text className="text-text-secondary text-sm mt-2">
                Balance after:{' '}
                {formatPaise(walletInfo.currentBalancePaise - parseInt(amountInput, 10) * 100)}
              </Text>
            )}
          </View>

          {/* Numpad */}
          <View className="px-4 pb-6">
            {NUMPAD_KEYS.map((row, rowIdx) => (
              <View key={rowIdx} className="flex-row justify-center gap-3 mb-3">
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleNumpadPress(key)}
                    className={`w-24 h-16 rounded-xl items-center justify-center ${key === '⌫' ? 'bg-background-secondary' : 'bg-accent/20'}`}
                    activeOpacity={0.7}
                  >
                    <Text className="text-text-primary text-2xl font-bold">{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Charge Button */}
            <TouchableOpacity
              onPress={handleCharge}
              disabled={!amountInput}
              className={`mt-4 py-5 rounded-xl items-center ${amountInput ? 'bg-success' : 'bg-background-secondary'}`}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-xl tracking-wider">
                CHARGE ₹{amountInput || '0'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {/* SUBMITTING */}
      {screenState === 'SUBMITTING' && (
        <View className="flex-1 items-center justify-center bg-background-primary">
          <ActivityIndicator color="#6366F1" size="large" />
          <Text className="text-text-secondary mt-4">Processing charge...</Text>
        </View>
      )}

      {/* SUCCESS */}
      {screenState === 'SUCCESS' && successData && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center bg-background-primary px-6"
        >
          <View className="w-20 h-20 rounded-full bg-success/20 items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
          </View>
          <Text className="text-text-primary text-3xl font-bold">Charged!</Text>
          <Text className="text-text-secondary text-lg mt-2">
            {formatPaise(successData.amountPaise)}
          </Text>
          <Text className="text-text-muted text-base mt-4">
            New balance: {formatPaise(successData.newBalancePaise)}
          </Text>
        </Animated.View>
      )}

      {/* ERROR */}
      {screenState === 'ERROR' && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center bg-background-primary px-6"
        >
          <View className="w-20 h-20 rounded-full bg-error/20 items-center justify-center mb-6">
            <Ionicons name="close-circle" size={48} color="#EF4444" />
          </View>
          <Text className="text-text-primary text-2xl font-bold mb-2">Charge Failed</Text>
          <Text className="text-text-secondary text-center mb-8">{errorMessage}</Text>
          <View className="flex-row gap-4">
            {walletInfo && (
              <TouchableOpacity
                onPress={() => {
                  setScreenState('AMOUNT_INPUT');
                  setErrorMessage(null);
                }}
                className="bg-accent px-8 py-4 rounded-xl"
              >
                <Text className="text-white font-bold text-lg">Retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleReset}
              className="bg-background-secondary px-8 py-4 rounded-xl"
            >
              <Text className="text-text-primary font-bold text-lg">New Scan</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
