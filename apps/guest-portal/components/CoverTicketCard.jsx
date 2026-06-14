'use client';

/**
 * CoverTicketCard — Guest Portal Web Component
 *
 * Renders Cover Wallet balance and recent transactions
 * inside the ticket detail view.
 *
 * Reads the initial wallet summary from the grouped guest wallet payload.
 * Only renders if rules.showBalanceToGuest is true.
 */

import { useEffect, useState } from 'react';
import { fetchCoverChargeWallet } from '../features/tickets/api/coverWalletApi';

function formatPaise(paise) {
    return `₹${(paise / 100).toFixed(2)}`;
}

function formatExpiryLabel(terminationTime) {
    if (!terminationTime) return '';
    const t = new Date(terminationTime);
    if (isNaN(t.getTime())) return '';
    return `Expires ${t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

function formatCountdown(terminationTime) {
    if (!terminationTime) return null;
    const now = Date.now();
    const end = new Date(terminationTime).getTime();
    const diff = end - now;
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `Expires in ${h}h ${m}m`;
}

function ProgressBar({ percent, expired }) {
    const color = expired
        ? 'bg-white/20'
        : percent > 60
            ? 'bg-emerald-500'
            : percent > 25
                ? 'bg-violet-500'
                : 'bg-zinc-400';
    return (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
                className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            />
        </div>
    );
}

export function CoverTicketCard({ walletId, initialWallet = null }) {
    const [wallet, setWallet] = useState(initialWallet);
    const [loading, setLoading] = useState(!initialWallet);
    const [showHistory, setShowHistory] = useState(false);
    const [countdown, setCountdown] = useState(null);

    // Fallback fetch only when a summary was not included in the wallet payload.
    useEffect(() => {
        if (!walletId || initialWallet) return;
        
        const fetchWallet = async () => {
            try {
                const data = await fetchCoverChargeWallet(walletId);
                if (data?.wallet) setWallet(data.wallet);
                setLoading(false);
            } catch {
                setLoading(false);
            }
        };

        fetchWallet();
    }, [initialWallet, walletId]);

    // Expiry countdown (every 60s, only after 2 AM IST)
    useEffect(() => {
        const terminationTime = wallet?.rules?.terminationTime;
        if (!terminationTime) return;

        const update = () => {
            const hour = new Date().getHours();
            if (hour >= 2 || hour < 8) setCountdown(formatCountdown(terminationTime));
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, [wallet?.rules?.terminationTime]);

    if (loading || !wallet) return null;
    if (!wallet.rules?.showBalanceToGuest) return null;

    const isExpired = wallet.state === 'EXPIRED' || wallet.state === 'TERMINATED';
    const isFrozen = wallet.state === 'FROZEN';
    const percent = wallet.openingBalancePaise > 0
        ? (wallet.currentBalancePaise / wallet.openingBalancePaise) * 100
        : 0;

    return (
        <div className="mt-4 pt-4 border-t border-white/10">
            {/* Header row */}
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
                    <span className="text-[9px] font-bold text-white/30 bg-white/[0.08] px-1.5 py-0.5 rounded">
                        EXPIRED
                    </span>
                )}
            </div>

            {/* Glow progress bar */}
            <ProgressBar percent={percent} expired={isExpired} />

            {/* Balance row */}
            <div className="flex items-baseline gap-1.5 mt-2">
                <span className={`text-base font-bold ${isExpired ? 'text-white/35' : 'text-white'}`}>
                    {formatPaise(wallet.currentBalancePaise)}
                </span>
                <span className="text-xs text-white/35">
                    / {formatPaise(wallet.openingBalancePaise)}
                </span>
                {countdown && (
                    <span className="ml-auto text-[10px] text-white/30">{countdown}</span>
                )}
                {!countdown && !isExpired && (
                    <span className="ml-auto text-[10px] text-white/30">
                        {formatExpiryLabel(wallet.rules?.terminationTime)}
                    </span>
                )}
                {isExpired && (
                    <span className="ml-auto text-[10px] text-white/30">Expired</span>
                )}
            </div>

            {/* Transaction history toggle */}
            {wallet.rules?.showTransactionHistory && (
                <button
                    onClick={() => setShowHistory(h => !h)}
                    className="mt-2 text-[11px] text-violet-400/70 hover:text-violet-400 transition-colors"
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
        if (!walletId) return;

        const fetchTxns = async () => {
            try {
                const data = await fetchCoverChargeWallet(walletId);
                if (data?.txns) setTxns(data.txns);
            } catch {
                // silently fail
            }
        };

        fetchTxns();
        const id = setInterval(fetchTxns, 15000);
        return () => clearInterval(id);
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
                        {txn.operatorName && (
                            <span className="text-white/30 ml-1">· {txn.operatorName}</span>
                        )}
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
