/**
 * Cover Charge Scanner Screen
 *
 * Mode: CHARGE ONLY — this screen is only reachable when the operator
 * authenticated with a 'charge' type event_code.
 *
 * Flow:
 *   IDLE → SCANNING → WALLET_LOADED → CONFIRM_DEBIT → SUBMITTING → SUCCESS/ERROR
 *
 * Offline: hard-blocked. Displays a notice and prevents the charge flow.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ActivityIndicator, Vibration, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useScannerStore } from '@/store/scannerStore';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { PresetGrid, PresetItem } from '../../components/scanner/PresetGrid';
import { formatPaise } from '@c1rcle/core/cover-charge-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenState =
    | 'IDLE'
    | 'SCANNING'
    | 'WALLET_LOADED'
    | 'CONFIRM_DEBIT'
    | 'SUBMITTING'
    | 'SUCCESS'
    | 'DEBIT_ERROR';

interface WalletContext {
    walletId: string;
    currentBalancePaise: number;
    openingBalancePaise: number;
    terminationTime: string;
    guestFirstName: string;
    state: string;
    rules: {
        allowedPresetItems: PresetItem[];
        showBalanceToGuest: boolean;
        maxChargeAmountPaise: number;
    };
}

interface PendingDebit {
    item: PresetItem;
    quantity: number;
}

// ---------------------------------------------------------------------------
// Props (passed via route params from scan.tsx when canCharge is true)
// ---------------------------------------------------------------------------

interface Props {
    eventCodeId: string;
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    deviceId: string;
    gatewayUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoverChargeScreen() {
    const router = useRouter();
    const { eventData } = useScannerStore();

    const currentUser = getFirebaseAuth().currentUser;
    const operatorId = currentUser?.uid ?? '';
    const deviceId = `mobile-${operatorId}`;
    const eventCodeId = eventData?.codeId ?? '';
    const gatewayUrl = process.env.EXPO_PUBLIC_GATEWAY_URL || 'http://localhost:4000';

    const [state, setState] = useState<ScreenState>('IDLE');
    const [wallet, setWallet] = useState<WalletContext | null>(null);
    const [pendingDebit, setPendingDebit] = useState<PendingDebit | null>(null);
    const [lastResult, setLastResult] = useState<{ itemName: string; amountPaise: number; newBalance: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isOffline, setIsOffline] = useState(false);

    // Idempotency key for current pending debit — generated once per charge attempt
    const idempotencyKeyRef = useRef<string>('');

    // ---------------------------------------------------------------------------
    // Network detection
    // ---------------------------------------------------------------------------

    React.useEffect(() => {
        const unsub = NetInfo.addEventListener((netState) => {
            setIsOffline(!netState.isConnected);
        });
        return () => unsub();
    }, []);

    // ---------------------------------------------------------------------------
    // Load wallet after QR scan
    // ---------------------------------------------------------------------------

    const loadWalletFromQr = useCallback(async (walletId: string, guestUserId: string) => {
        setState('SCANNING');
        try {
            const res = await fetch(`${gatewayUrl}/api/v1/cover-charge/wallet/${walletId}`, {
                headers: { 'Authorization': `Bearer ${await getAuthToken()}` },
            });
            const data = await res.json();

            if (!res.ok || !data.wallet) {
                setErrorMessage(data.error || 'Wallet not found');
                setState('DEBIT_ERROR');
                return;
            }

            if (data.wallet.state !== 'ACTIVE') {
                setErrorMessage(`Wallet is ${data.wallet.state}. Cannot charge.`);
                setState('DEBIT_ERROR');
                return;
            }

            setWallet({
                walletId: data.wallet.id,
                currentBalancePaise: data.wallet.currentBalancePaise,
                openingBalancePaise: data.wallet.openingBalancePaise,
                terminationTime: data.wallet.terminationTime,
                guestFirstName: data.wallet.guestFirstName || 'Guest',
                state: data.wallet.state,
                rules: {
                    allowedPresetItems: data.wallet.allowedPresetItems || [],
                    showBalanceToGuest: data.wallet.showBalanceToGuest ?? true,
                    maxChargeAmountPaise: data.wallet.maxChargeAmountPaise || 0,
                },
            });
            setState('WALLET_LOADED');
        } catch {
            setErrorMessage('Failed to load wallet. Check your connection.');
            setState('DEBIT_ERROR');
        }
    }, [gatewayUrl]);

    // ---------------------------------------------------------------------------
    // Debit flow
    // ---------------------------------------------------------------------------

    const onItemSelected = useCallback((item: PresetItem) => {
        if (!wallet) return;

        if (item.amountPaise > wallet.currentBalancePaise) {
            Alert.alert(
                'Insufficient Balance',
                `${wallet.guestFirstName}'s wallet has ${formatPaise(wallet.currentBalancePaise)} remaining. ${item.name} costs ${formatPaise(item.amountPaise)}.`,
            );
            return;
        }

        // Generate idempotency key for this charge attempt
        idempotencyKeyRef.current = crypto.randomUUID();
        setPendingDebit({ item, quantity: 1 });
        setState('CONFIRM_DEBIT');
    }, [wallet]);

    const onConfirmDebit = useCallback(async () => {
        if (!wallet || !pendingDebit) return;
        if (isOffline) {
            Alert.alert('No Connection', 'Cover Wallet charges require a live connection. Connect to venue Wi-Fi or mobile data.');
            return;
        }

        setState('SUBMITTING');

        try {
            const res = await fetch(`${gatewayUrl}/api/v1/cover-charge/debit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`,
                },
                body: JSON.stringify({
                    walletId: wallet.walletId,
                    presetItemId: pendingDebit.item.id,
                    quantity: pendingDebit.quantity,
                    idempotencyKey: idempotencyKeyRef.current,
                    operatorId,
                    operatorName: '',
                    operatorRole: 'staff',
                    deviceId,
                    eventCodeId,
                    isOnline: true,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setErrorMessage(data.message || 'Charge failed');
                setState('DEBIT_ERROR');
                return;
            }

            Vibration.vibrate(100);
            setWallet(prev => prev ? { ...prev, currentBalancePaise: data.balanceAfterPaise } : prev);
            setLastResult({
                itemName: data.receipt.itemName,
                amountPaise: data.receipt.amountPaise,
                newBalance: data.balanceAfterPaise,
            });
            setState('SUCCESS');

            // Auto-return to IDLE after 3 seconds
            setTimeout(() => {
                setState('WALLET_LOADED');
                setLastResult(null);
                setPendingDebit(null);
            }, 3000);

        } catch {
            setErrorMessage('Network error. Tap retry — the charge will not be duplicated.');
            setState('DEBIT_ERROR');
        }
    }, [wallet, pendingDebit, isOffline, operatorId, deviceId, eventCodeId, gatewayUrl]);

    const onRetry = useCallback(() => {
        // Retry uses the SAME idempotencyKey — server deduplicates
        setState('CONFIRM_DEBIT');
    }, []);

    const onCancel = useCallback(() => {
        setState('IDLE');
        setWallet(null);
        setPendingDebit(null);
        setErrorMessage('');
        idempotencyKeyRef.current = '';
    }, []);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    if (isOffline) {
        return (
            <View style={styles.offlineContainer}>
                <Text style={styles.offlineTitle}>No Connection</Text>
                <Text style={styles.offlineBody}>
                    Cover Wallet charges require a live connection.{'\n'}
                    Connect to venue Wi-Fi or mobile data.
                </Text>
            </View>
        );
    }

    if (state === 'IDLE') {
        return (
            <View style={styles.container}>
                <Text style={styles.modeLabel}>CHARGE MODE</Text>
                <Text style={styles.idlePrompt}>Scan guest's ticket QR to load their wallet</Text>
                {/* QR scanner component would go here */}
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backBtnText}>← Back to Mode Select</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (state === 'SCANNING') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.loadingText}>Loading wallet...</Text>
            </View>
        );
    }

    if ((state === 'WALLET_LOADED' || state === 'SUCCESS') && wallet) {
        return (
            <View style={styles.container}>
                {/* Wallet header */}
                <View style={styles.walletHeader}>
                    <Text style={styles.guestName}>{wallet.guestFirstName}</Text>
                    <View style={styles.balanceChip}>
                        <Text style={styles.balanceLabel}>COVER WALLET</Text>
                        <Text style={styles.balanceValue}>{formatPaise(wallet.currentBalancePaise)}</Text>
                    </View>
                </View>

                {/* Success receipt overlay */}
                {state === 'SUCCESS' && lastResult && (
                    <View style={styles.successBanner}>
                        <Text style={styles.successText}>✓ Charged</Text>
                        <Text style={styles.successDetail}>{lastResult.itemName} · −{formatPaise(lastResult.amountPaise)}</Text>
                        <Text style={styles.successBalance}>New balance: {formatPaise(lastResult.newBalance)}</Text>
                    </View>
                )}

                {/* Preset items */}
                <Text style={styles.sectionTitle}>SELECT ITEM</Text>
                <PresetGrid
                    items={wallet.rules.allowedPresetItems}
                    onSelect={onItemSelected}
                    disabled={state === 'SUCCESS'}
                />

                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                    <Text style={styles.cancelBtnText}>Done / New Scan</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (state === 'CONFIRM_DEBIT' && wallet && pendingDebit) {
        const newBalance = wallet.currentBalancePaise - pendingDebit.item.amountPaise;
        return (
            <View style={styles.container}>
                <Text style={styles.confirmTitle}>Confirm Charge</Text>
                <View style={styles.confirmCard}>
                    <Text style={styles.confirmItemName}>{pendingDebit.item.name}</Text>
                    <Text style={styles.confirmAmount}>−{formatPaise(pendingDebit.item.amountPaise * pendingDebit.quantity)}</Text>
                    <Text style={styles.confirmBalance}>Remaining: {formatPaise(newBalance)}</Text>
                    <Text style={styles.confirmGuest}>Guest: {wallet.guestFirstName}</Text>
                </View>
                <TouchableOpacity style={styles.confirmBtn} onPress={onConfirmDebit}>
                    <Text style={styles.confirmBtnText}>CHARGE NOW</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setState('WALLET_LOADED')}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (state === 'SUBMITTING') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.loadingText}>Processing charge...</Text>
            </View>
        );
    }

    if (state === 'DEBIT_ERROR') {
        return (
            <View style={styles.container}>
                <Text style={styles.errorTitle}>Charge Failed</Text>
                <Text style={styles.errorBody}>{errorMessage}</Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={onRetry}>
                    <Text style={styles.confirmBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return null;
}

// Placeholder — replace with actual Firebase Auth token retrieval
async function getAuthToken(): Promise<string> {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    return token || '';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    offlineContainer: {
        flex: 1,
        backgroundColor: '#0a0a0f',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    offlineTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ef4444',
        marginBottom: 12,
    },
    offlineBody: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 22,
    },
    modeLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 2,
        color: '#a855f7',
        marginBottom: 24,
    },
    idlePrompt: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginTop: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
    },
    walletHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    guestName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
    },
    balanceChip: {
        backgroundColor: 'rgba(168,85,247,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.3)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'flex-end',
    },
    balanceLabel: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: 'rgba(168,85,247,0.7)',
    },
    balanceValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#a855f7',
    },
    successBanner: {
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.3)',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
    },
    successText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#22c55e',
    },
    successDetail: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    successBalance: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: 'rgba(255,255,255,0.35)',
        marginBottom: 12,
    },
    confirmTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 24,
    },
    confirmCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
    },
    confirmItemName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 8,
    },
    confirmAmount: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ef4444',
        marginBottom: 8,
    },
    confirmBalance: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
    },
    confirmGuest: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
    },
    confirmBtn: {
        backgroundColor: '#a855f7',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 10,
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    cancelBtn: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
    },
    backBtn: {
        marginTop: 'auto' as any,
        paddingVertical: 14,
        alignItems: 'center',
    },
    backBtnText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ef4444',
        marginBottom: 12,
    },
    errorBody: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 32,
        lineHeight: 20,
    },
});
