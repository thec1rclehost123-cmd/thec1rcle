import React, { useEffect, useState } from 'react';
import { AppState, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { apiFetch } from '@/lib/api';

interface CoverTicketCardProps {
    walletId: string;
}

interface WalletSnap {
    id: string;
    currentBalancePaise: number;
    openingBalancePaise: number;
    state: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'TERMINATED';
    terminationTime?: string;
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
    return `Expires ${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function CoverTicketCard({ walletId }: CoverTicketCardProps) {
    const [wallet, setWallet] = useState<WalletSnap | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        
        async function fetchWallet() {
            if (!walletId) return;
            if (AppState.currentState !== "active") return;
            try {
                const response = await apiFetch<{ wallet: WalletSnap }>(`/api/v1/cover-charge/wallet/${walletId}`, {
                    requireAuth: true
                });
                if (active && response.wallet) {
                    setWallet(response.wallet);
                }
            } catch (e) {} finally {
                if (active) setLoading(false);
            }
        }

        fetchWallet();
        const interval = setInterval(fetchWallet, 10000); // 10s poll

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [walletId]);

    if (loading || !wallet) return null;

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
                    {!isExpired ? formatExpiryLabel(wallet.terminationTime) : 'Expired'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, color: 'rgba(255,255,255,0.5)' },
    frozenBadge: { fontSize: 9, fontWeight: '700', color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
    expiredBadge: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
    barBackground: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 6, overflow: 'hidden' },
    barFill: { height: 4, borderRadius: 2, backgroundColor: '#a855f7' },
    barExpired: { backgroundColor: 'rgba(255,255,255,0.2)' },
    balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    balance: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
    balanceExpired: { color: 'rgba(255,255,255,0.35)' },
    opening: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    expiry: { flex: 1, textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.35)' },
});
