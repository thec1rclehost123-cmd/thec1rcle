/**
 * CoverTicketCard
 *
 * Renders the Cover Wallet balance row inside a ticket card.
 * Subscribes to the wallet document via Firestore real-time listener.
 * Balance is displayed only if rules.showBalanceToGuest === true.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

interface CoverTicketCardProps {
    walletId: string;
}

interface WalletSnap {
    currentBalancePaise: number;
    openingBalancePaise: number;
    state: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'TERMINATED';
    rules?: {
        showBalanceToGuest: boolean;
        terminationTime: string;
    };
}

function formatPaise(paise: number): string {
    return `₹${(paise / 100).toFixed(2)}`;
}

function computeProgressPercent(current: number, opening: number): number {
    if (opening <= 0) return 0;
    return Math.max(0, Math.min(100, (current / opening) * 100));
}

function formatExpiryLabel(terminationTime?: string): string {
    if (!terminationTime) return '';
    const t = new Date(terminationTime);
    if (isNaN(t.getTime())) return '';
    const h = t.getHours();
    const m = String(t.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'AM' : 'AM'; // always AM at 5:00
    return `Expires ${h % 12 || 12}:${m} AM`;
}

export function CoverTicketCard({ walletId }: CoverTicketCardProps) {
    const [wallet, setWallet] = useState<WalletSnap | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const db = getFirestore();
        const ref = doc(db, 'cover_wallets', walletId);

        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (snap.exists()) {
                    setWallet(snap.data() as WalletSnap);
                }
                setLoading(false);
            },
            () => {
                setLoading(false);
            }
        );

        return () => unsub();
    }, [walletId]);

    if (loading || !wallet) return null;
    if (!wallet.rules?.showBalanceToGuest) return null;

    const isExpired = wallet.state === 'EXPIRED' || wallet.state === 'TERMINATED';
    const isFrozen = wallet.state === 'FROZEN';
    const progressPercent = computeProgressPercent(wallet.currentBalancePaise, wallet.openingBalancePaise);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>COVER WALLET</Text>
                {isFrozen && <Text style={styles.frozenBadge}>FROZEN</Text>}
                {isExpired && <Text style={styles.expiredBadge}>EXPIRED</Text>}
            </View>

            {/* Progress bar */}
            <View style={styles.barBackground}>
                <View
                    style={[
                        styles.barFill,
                        { width: `${progressPercent}%` as any },
                        isExpired && styles.barExpired,
                    ]}
                />
            </View>

            <View style={styles.balanceRow}>
                <Text style={[styles.balance, isExpired && styles.balanceExpired]}>
                    {formatPaise(wallet.currentBalancePaise)}
                </Text>
                <Text style={styles.opening}>
                    / {formatPaise(wallet.openingBalancePaise)}
                </Text>
                <Text style={styles.expiry}>
                    {!isExpired ? formatExpiryLabel(wallet.rules?.terminationTime) : 'Expired'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.15)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.2,
        color: 'rgba(255,255,255,0.5)',
    },
    frozenBadge: {
        fontSize: 9,
        fontWeight: '700',
        color: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,0.15)',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    expiredBadge: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.3)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    barBackground: {
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginBottom: 6,
        overflow: 'hidden',
    },
    barFill: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#a855f7',
    },
    barExpired: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    balance: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
    },
    balanceExpired: {
        color: 'rgba(255,255,255,0.35)',
    },
    opening: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
    },
    expiry: {
        flex: 1,
        textAlign: 'right',
        fontSize: 10,
        color: 'rgba(255,255,255,0.35)',
    },
});
