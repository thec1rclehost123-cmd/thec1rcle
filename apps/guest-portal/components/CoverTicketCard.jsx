'use client';

/**
 * CoverTicketCard — Guest Portal Web Component
 *
 * Renders Cover Wallet balance and recent transactions
 * inside the ticket detail view.
 *
 * Subscribes to Firestore in real time so balance stays current.
 * Only renders if rules.showBalanceToGuest is true.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseFirestore } from '../lib/firebase/client.js';

function formatPaise(paise) {
    return `₹${(paise / 100).toFixed(2)}`;
}

function formatExpiryLabel(terminationTime) {
    if (!terminationTime) return '';
    const t = new Date(terminationTime);
    if (isNaN(t.getTime())) return '';
    return `Expires ${t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

function ProgressBar({ percent, expired }) {
    return (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
                className={`h-1 rounded-full transition-all duration-500 ${expired ? 'bg-white/20' : 'bg-purple-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            />
        </div>
    );
}

export function CoverTicketCard({ walletId }) {
    const [wallet, setWallet] = useState(null);
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (!walletId) return;

        let db;
        try {
            db = getFirebaseFirestore();
        } catch {
            setLoading(false);
            return;
        }

        const walletRef = doc(db, 'cover_wallets', walletId);
        const unsub = onSnapshot(walletRef, (snap) => {
            if (snap.exists()) {
                setWallet(snap.data());
            }
            setLoading(false);
        }, () => setLoading(false));

        return () => unsub();
    }, [walletId]);

    if (loading || !wallet) return null;
    if (!wallet.rules?.showBalanceToGuest) return null;

    const isExpired = wallet.state === 'EXPIRED' || wallet.state === 'TERMINATED';
    const isFrozen = wallet.state === 'FROZEN';
    const percent = wallet.openingBalancePaise > 0
        ? (wallet.currentBalancePaise / wallet.openingBalancePaise) * 100
        : 0;

    return (
        <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                    Cover Wallet
                </span>
                {isFrozen && (
                    <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                        FROZEN
                    </span>
                )}
                {isExpired && (
                    <span className="text-[9px] font-bold text-white/30 bg-white/8 px-1.5 py-0.5 rounded">
                        EXPIRED
                    </span>
                )}
            </div>

            <ProgressBar percent={percent} expired={isExpired} />

            <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className={`text-base font-bold ${isExpired ? 'text-white/35' : 'text-white'}`}>
                    {formatPaise(wallet.currentBalancePaise)}
                </span>
                <span className="text-xs text-white/35">
                    / {formatPaise(wallet.openingBalancePaise)}
                </span>
                <span className="ml-auto text-[10px] text-white/30">
                    {!isExpired ? formatExpiryLabel(wallet.rules?.terminationTime) : 'Expired'}
                </span>
            </div>

            {/* Transaction history toggle */}
            {wallet.rules?.showTransactionHistory && (
                <button
                    onClick={() => setShowHistory(h => !h)}
                    className="mt-2 text-[11px] text-purple-400/70 hover:text-purple-400 transition-colors"
                >
                    {showHistory ? 'Hide activity' : 'View activity'}
                </button>
            )}

            {showHistory && wallet.rules?.showTransactionHistory && (
                <TxnHistory walletId={walletId} />
            )}

            {/* Disclosure notice */}
            <p className="mt-3 text-[10px] text-white/25 leading-relaxed">
                Cover Wallet credit is valid only at this venue during this event.
                Unused balance expires at {formatExpiryLabel(wallet.rules?.terminationTime)} and is non-refundable.
            </p>
        </div>
    );
}

function TxnHistory({ walletId }) {
    const [txns, setTxns] = useState([]);

    useEffect(() => {
        let db;
        try {
            db = getFirebaseFirestore();
        } catch {
            return;
        }

        const { collection, query, orderBy, limit, onSnapshot: fbOnSnapshot } = require('firebase/firestore');
        const q = query(
            collection(db, 'cover_wallets', walletId, 'txns'),
            orderBy('createdAt', 'desc'),
            limit(20),
        );

        const unsub = fbOnSnapshot(q, (snap) => {
            setTxns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => unsub();
    }, [walletId]);

    if (txns.length === 0) {
        return <p className="mt-2 text-xs text-white/25">No activity yet.</p>;
    }

    return (
        <div className="mt-2 space-y-1.5">
            {txns.map(txn => (
                <div key={txn.id} className="flex justify-between items-center text-xs">
                    <span className="text-white/60">
                        {txn.presetItemName || txn.type}
                        {txn.quantity > 1 && ` ×${txn.quantity}`}
                    </span>
                    <span className={txn.type === 'DEBIT' ? 'text-red-400' : 'text-green-400'}>
                        {txn.type === 'DEBIT' ? '−' : '+'}
                        {formatPaise(txn.amountPaise)}
                    </span>
                </div>
            ))}
        </div>
    );
}
