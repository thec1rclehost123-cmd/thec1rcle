'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  Building2,
  Plus,
  Pencil,
  Zap,
  Landmark,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { ConnectPayoutMethodModal } from '@/components/finance/ConnectPayoutMethodModal';
import { formatINR } from '@/lib/finance/definitions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BalanceData {
  available: number;
  pending: number;
  instantAvailable: number;
}

interface Payout {
  id: string;
  arrivalDate: string | null;
  amount: number;
  currency: string;
  status: 'paid' | 'in_transit' | 'failed';
  eventId?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  description?: string | null;
}

interface BankAccount {
  id: string;
  bankName: string;
  last4: string;
  isDefault: boolean;
  accountType: string;
  paymentType?: 'bank_account' | 'debit_card';
}

interface Dispute {
  id: string;
  createdAt: string | null;
  orderId: string | null;
  customerName: string;
  trackingLink: string | null;
  disputedAmount: number;
  disputeFee: number;
  disputeStatus: 'won' | 'lost' | 'under_review' | 'needs_response' | 'pending';
  curatorStatus: 'covered' | 'not_covered' | null;
}

interface Settings {
  country: string;
  currency: string;
  statementDescriptor: string;
  payoutSchedule: string;
}

type ActiveView = 'main' | 'disputes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'INR') {
  if (currency === 'INR') return formatINR(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { month: 'numeric', day: 'numeric', year: '2-digit' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

// ── Initiate Payout Modal ─────────────────────────────────────────────────────

function InitiatePayoutModal({
  available,
  currency,
  onClose,
  instantFeeRate = 0,
}: {
  available: number;
  currency: string;
  onClose: () => void;
  instantFeeRate?: number;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'standard' | 'instant'>('standard');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const max = available;
  const fee = method === 'instant' ? Number(amount || 0) * instantFeeRate : 0;

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSuccess(true);
    setLoading(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          background: 'var(--v-card)',
          border: '2px solid #f59e0b',
          boxShadow: '0 0 60px rgba(245,158,11,0.15)',
        }}
      >
        <div className="flex items-center justify-end px-6 pt-5">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10"
            style={{ color: 'var(--v-text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-8 pb-8">
          <h2 className="text-[26px] font-bold text-center text-[var(--v-text-primary)] mb-6">
            Initiate Payout
          </h2>

          {success ? (
            <p className="text-center text-[15px] font-semibold py-8" style={{ color: '#34d399' }}>
              Payout initiated successfully!
            </p>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-[20px] font-bold text-[var(--v-text-tertiary)]">
                  {currency === 'INR' ? '₹' : '$'}
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  max={max}
                  className="text-[56px] font-bold w-40 bg-transparent outline-none text-center tabular-nums"
                  style={{ color: 'var(--v-text-primary)' }}
                />
              </div>
              <p
                className="text-center text-[13px] mb-6"
                style={{ color: 'var(--v-text-tertiary)' }}
              >
                Transfer up to {fmt(max, currency)}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setMethod('standard')}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
                  style={{
                    background: method === 'standard' ? 'var(--v-elevated)' : 'var(--v-canvas)',
                    border: `1px solid ${method === 'standard' ? 'rgba(255,255,255,0.2)' : 'var(--v-border)'}`,
                  }}
                >
                  <Landmark size={24} style={{ color: 'var(--v-text-secondary)' }} />
                  <span className="text-[13px] font-bold text-[var(--v-text-primary)]">
                    2-3 Biz Days
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--v-text-tertiary)' }}>
                    No Fee
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('instant')}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
                  style={{
                    background: method === 'instant' ? 'var(--v-elevated)' : 'var(--v-canvas)',
                    border: `1px solid ${method === 'instant' ? 'rgba(255,255,255,0.2)' : 'var(--v-border)'}`,
                  }}
                >
                  <Zap size={24} style={{ color: '#a78bfa' }} />
                  <span className="text-[13px] font-bold text-[var(--v-text-primary)]">
                    INSTANT
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--v-text-tertiary)' }}>
                    3% Fee
                  </span>
                </button>
              </div>

              {method === 'instant' && Number(amount) > 0 && (
                <p
                  className="text-center text-[12px] mb-4"
                  style={{ color: 'var(--v-text-tertiary)' }}
                >
                  Fee: {fmt(fee, currency)} · You receive {fmt(Number(amount) - fee, currency)}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!amount || Number(amount) <= 0 || loading}
                className="w-full py-4 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'white',
                  color: '#000',
                  opacity: !amount || Number(amount) <= 0 ? 0.5 : 1,
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Transfer Balance
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Add Bank Account Modal ────────────────────────────────────────────────────

function AddBankModal({
  onClose,
  onAdded,
  venueId,
  getToken,
}: {
  onClose: () => void;
  onAdded: () => void;
  venueId: string;
  getToken: () => Promise<string>;
}) {
  return (
    <ConnectPayoutMethodModal
      title="Connect Payout Method"
      endpoint="/api/partners/venues/finance/bank-accounts"
      bodyBase={{ venueId }}
      getHeaders={async () => {
        const token = await getToken();
        return {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
      }}
      onClose={onClose}
      onAdded={onAdded}
    />
  );
}

// ── Disputes View ─────────────────────────────────────────────────────────────

function DisputesView({
  venueId,
  onBack,
  getToken,
}: {
  venueId: string;
  onBack: () => void;
  getToken: () => Promise<string>;
}) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/partners/venues/finance/disputes?venueId=${venueId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await res.json();
        setDisputes(d.disputes || []);
      } catch (err) {
        console.error('[Finance] Failed to load disputes:', err);
      }
      setLoading(false);
    })();
  }, [venueId]);

  const statusBadge = (s: Dispute['disputeStatus']) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      won: { label: 'WON', bg: '#22c55e', color: '#fff' },
      lost: { label: 'LOST', bg: '#ef4444', color: '#fff' },
      under_review: { label: 'UNDER REVIEW', bg: '#6b7280', color: '#fff' },
      needs_response: { label: 'NEEDS RESPONSE', bg: '#6b7280', color: '#fff' },
      pending: { label: 'PENDING', bg: '#6b7280', color: '#fff' },
    };
    const c = map[s] ?? map.pending;
    return (
      <span
        className="px-3 py-1 rounded text-[11px] font-black uppercase"
        style={{ background: c.bg, color: c.color }}
      >
        {c.label}
      </span>
    );
  };

  const curatorBadge = (s: Dispute['curatorStatus']) => {
    if (!s) return null;
    return (
      <span
        className="px-3 py-1 rounded text-[11px] font-black uppercase"
        style={{ background: '#22c55e', color: '#fff' }}
      >
        {s === 'covered' ? 'COVERED' : 'TBD'}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-[14px] font-semibold transition-colors"
          style={{ color: 'var(--v-text-tertiary)' }}
        >
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      <h1 className="text-[32px] font-black tracking-tight text-[var(--v-text-primary)] mb-1">
        Disputes
      </h1>
      <p className="text-[14px] mb-8" style={{ color: 'var(--v-text-tertiary)' }}>
        C1rcle automatically fights disputes (chargebacks) for you. View their status and other info
        below.
      </p>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
      >
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: 'var(--v-text-tertiary)' }}
            />
          </div>
        ) : disputes.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[15px]" style={{ color: 'var(--v-text-tertiary)' }}>
              No disputes found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--v-border)' }}>
                  {[
                    'Dispute Created',
                    'Order',
                    'Customer Name',
                    'Tracking Link',
                    'Disputed Amount',
                    'Dispute Fee',
                    'Status',
                    'Curator',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-[12px] font-bold"
                      style={{ color: 'var(--v-text-tertiary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: '1px solid var(--v-border)' }}
                  >
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {fmtDateTime(d.createdAt)}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {d.orderId ? `#${d.orderId}` : '—'}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {d.customerName}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'var(--v-text-tertiary)' }}
                    >
                      {d.trackingLink || '—'}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px] tabular-nums font-semibold"
                      style={{ color: 'var(--v-text-primary)' }}
                    >
                      {fmt(d.disputedAmount)}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px] tabular-nums"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {fmt(d.disputeFee)}
                    </td>
                    <td className="px-5 py-4">{statusBadge(d.disputeStatus)}</td>
                    <td className="px-5 py-4">{curatorBadge(d.curatorStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Finance Page ─────────────────────────────────────────────────────────

export default function VenueFinancePageClient() {
  const { profile, getIdToken } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId ?? '';

  const getToken = useCallback(async (): Promise<string> => {
    return typeof getIdToken === 'function' ? await getIdToken() : '';
  }, [getIdToken]);

  // Views
  const [view, setView] = useState<ActiveView>('main');

  // Balance
  const [balance, setBalance] = useState<BalanceData>({
    available: 0,
    pending: 0,
    instantAvailable: 0,
  });
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Payouts
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Banks
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Settings (local state until we wire a save endpoint)
  const [settings, setSettings] = useState<Settings>({
    country: 'India',
    currency: 'INR',
    statementDescriptor: 'C1RCLE',
    payoutSchedule: 'weekly',
  });

  // Modals
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [instantFeeRate, setInstantFeeRate] = useState(0);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchBalance = useCallback(async () => {
    if (!venueId) return;
    setBalanceLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/partners/venues/finance/overview?venueId=${venueId}&period=30d`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const d = await res.json();
      const m = d.metrics;
      setBalance({
        available: m?.availableBalance || 0,
        pending: m?.pendingPayouts || 0,
        instantAvailable: m?.availableBalance || 0,
      });
    } catch (err) {
      console.error('[Finance] Failed to load balance:', err);
    }
    setBalanceLoading(false);
  }, [venueId, getToken]);

  const fetchPayouts = useCallback(
    async (p = 1) => {
      if (!venueId) return;
      setPayoutsLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/partners/venues/finance/payouts?venueId=${venueId}&page=${p}&limit=10`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        const d = await res.json();
        setPayouts(d.payouts || []);
        setHasMore(d.hasMore || false);
      } catch (err) {
        console.error('[Finance] Failed to load payouts:', err);
      }
      setPayoutsLoading(false);
    },
    [venueId, getToken],
  );

  const fetchAccounts = useCallback(async () => {
    if (!venueId) return;
    setAccountsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/partners/venues/finance/bank-accounts?venueId=${venueId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      setAccounts(d.accounts || []);
    } catch (err) {
      console.error('[Finance] Failed to load bank accounts:', err);
    }
    setAccountsLoading(false);
  }, [venueId, getToken]);

  useEffect(() => {
    fetchBalance();
    fetchPayouts(1);
    fetchAccounts();
  }, [fetchBalance, fetchPayouts, fetchAccounts]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/finance/payout-config', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data?.instantFeeRate != null) setInstantFeeRate(data.instantFeeRate);
      } catch (err) {
        console.error('[Finance] Failed to load payout config:', err);
      }
    })();
  }, [getToken]);

  const handlePageChange = (next: number) => {
    setPage(next);
    fetchPayouts(next);
  };

  const removeAccount = async (accountId: string) => {
    const token = await getToken();
    await fetch(
      `/api/partners/venues/finance/bank-accounts?venueId=${venueId}&accountId=${accountId}`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    fetchAccounts();
  };

  // ── Payout status badge ────────────────────────────────────────────────────

  const payoutBadge = (status: Payout['status']) => {
    if (status === 'in_transit') {
      return (
        <span
          className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase"
          style={{ background: '#06b6d4', color: '#fff' }}
        >
          IN TRANSIT
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span
          className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          FAILED
        </span>
      );
    }
    return (
      <span
        className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase"
        style={{ background: '#22c55e', color: '#000' }}
      >
        PAID
      </span>
    );
  };

  // ── Disputes view ──────────────────────────────────────────────────────────

  if (view === 'disputes') {
    return (
      <div className="max-w-[1400px] mx-auto">
        <DisputesView venueId={venueId} onBack={() => setView('main')} getToken={getToken} />
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-4">
          {/* BALANCE */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-widest mb-4"
              style={{ color: 'var(--v-text-tertiary)' }}
            >
              Balance
            </p>
            <div className="space-y-2 mb-5">
              {[
                { label: 'Available', value: balance.available },
                { label: 'Pending', value: balance.pending, tooltip: true },
                { label: 'Instant Available', value: balance.instantAvailable, tooltip: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span
                    className="flex items-center gap-1 text-[14px]"
                    style={{ color: 'var(--v-text-secondary)' }}
                  >
                    {row.label}
                    {row.tooltip && (
                      <HelpCircle size={12} style={{ color: 'var(--v-text-tertiary)' }} />
                    )}
                  </span>
                  {balanceLoading ? (
                    <span
                      className="w-20 h-4 rounded animate-pulse"
                      style={{ background: 'var(--v-elevated)' }}
                    />
                  ) : (
                    <span
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: 'var(--v-text-primary)' }}
                    >
                      {fmt(row.value)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              className="w-full py-3 rounded-xl text-[13px] font-bold transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: 'var(--v-elevated)',
                color: 'var(--v-text-primary)',
                border: '1px solid var(--v-border)',
              }}
            >
              Transfer Balance
            </button>
          </div>

          {/* SETTINGS */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-widest mb-4"
              style={{ color: 'var(--v-text-tertiary)' }}
            >
              Settings
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
                  Country
                </span>
                <span className="text-[14px]" style={{ color: 'var(--v-text-primary)' }}>
                  🇮🇳
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
                  Currency
                </span>
                <span className="text-[14px]" style={{ color: 'var(--v-text-primary)' }}>
                  INR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
                  Statement Descriptor
                </span>
                <span
                  className="text-[13px] font-medium truncate ml-4 max-w-[140px]"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {settings.statementDescriptor}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[14px] shrink-0" style={{ color: 'var(--v-text-secondary)' }}>
                  Payout Schedule
                </span>
                <div className="w-32">
                  <Select
                    value={settings.payoutSchedule}
                    onChange={(e) => setSettings((s) => ({ ...s, payoutSchedule: e.target.value }))}
                    options={[
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                    ]}
                    className="py-1 px-3 text-[12px] h-9 bg-transparent border-white/10 hover:bg-white/5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BANKS & DEBIT CARDS */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-[11px] font-black uppercase tracking-widest"
                style={{ color: 'var(--v-text-tertiary)' }}
              >
                Banks &amp; Debit Cards
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                  style={{ border: '1px solid var(--v-border)' }}
                >
                  <Pencil size={12} style={{ color: 'var(--v-text-tertiary)' }} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                  style={{ border: '1px solid var(--v-border)' }}
                >
                  <Plus size={12} style={{ color: 'var(--v-text-tertiary)' }} />
                </button>
              </div>
            </div>

            {accountsLoading ? (
              <div
                className="h-16 rounded-xl animate-pulse"
                style={{ background: 'var(--v-elevated)' }}
              />
            ) : accounts.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowAddBankModal(true)}
                className="w-full py-4 rounded-xl text-[13px] font-semibold border-2 border-dashed transition-colors hover:border-white/20"
                style={{ borderColor: 'var(--v-border)', color: 'var(--v-text-tertiary)' }}
              >
                + Add Bank Account
              </button>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--v-canvas)' }}
                    >
                      <Landmark size={18} style={{ color: 'var(--v-text-tertiary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--v-text-primary)] truncate">
                        {acc.paymentType === 'debit_card'
                          ? `${acc.bankName} Debit Card`
                          : acc.bankName}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--v-text-tertiary)' }}>
                        {acc.paymentType === 'debit_card' ? 'Card' : 'Account'} {'•'.repeat(7)}
                        {acc.last4}
                      </p>
                      {acc.isDefault && (
                        <span
                          className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--v-canvas)', color: 'var(--v-text-tertiary)' }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAccount(acc.id)}
                      className="text-[11px] hover:text-red-400 transition-colors"
                      style={{ color: 'var(--v-text-tertiary)' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DISPUTES BUTTON */}
          <button
            type="button"
            onClick={() => setView('disputes')}
            className="w-full py-3.5 rounded-2xl text-[13px] font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            style={{
              background: 'var(--v-card)',
              color: 'var(--v-text-secondary)',
              border: '1px solid var(--v-border)',
            }}
          >
            <AlertCircle size={14} /> View Disputes
          </button>
        </div>

        {/* ── RIGHT COLUMN — PAYOUTS ── */}
        <div
          className="rounded-2xl"
          style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
        >
          <div
            className="flex items-center justify-between px-6 pt-6 pb-4 border-b"
            style={{ borderColor: 'var(--v-border)' }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: 'var(--v-text-tertiary)' }}
            >
              Payouts
            </p>
            <button
              type="button"
              onClick={() => fetchPayouts(page)}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ border: '1px solid var(--v-border)' }}
            >
              <RefreshCw size={12} style={{ color: 'var(--v-text-tertiary)' }} />
            </button>
          </div>

          {payoutsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl animate-pulse"
                  style={{ background: 'var(--v-elevated)' }}
                />
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[15px]" style={{ color: 'var(--v-text-tertiary)' }}>
                No payouts yet.
              </p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--v-text-tertiary)' }}>
                Payouts will appear here once events start generating revenue.
              </p>
            </div>
          ) : (
            <>
              {/* Header row */}
              <div
                className="grid grid-cols-[1fr_auto_auto] px-6 py-3 border-b"
                style={{ borderColor: 'var(--v-border)' }}
              >
                <span className="text-[12px] font-bold" style={{ color: 'var(--v-text-tertiary)' }}>
                  Arrival Date
                </span>
                <span
                  className="text-[12px] font-bold mr-16"
                  style={{ color: 'var(--v-text-tertiary)' }}
                >
                  Amount
                </span>
                <span />
              </div>

              {/* Rows */}
              <div>
                {payouts.map((p, i) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center px-6 py-4 hover:bg-white/[0.02] transition-colors"
                    style={{
                      borderBottom: i < payouts.length - 1 ? '1px solid var(--v-border)' : 'none',
                    }}
                  >
                    <span className="text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
                      <span className="block">{fmtDate(p.arrivalDate)}</span>
                      {(p.eventName || p.description) && (
                        <span
                          className="mt-1 block text-[12px]"
                          style={{ color: 'var(--v-text-tertiary)' }}
                        >
                          {p.eventName
                            ? `${p.eventName}${p.eventDate ? ` · ${new Date(p.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
                            : p.description}
                        </span>
                      )}
                    </span>
                    <span
                      className="text-[14px] font-semibold tabular-nums mr-6"
                      style={{ color: 'var(--v-text-primary)' }}
                    >
                      {fmt(p.amount, p.currency)}
                    </span>
                    <span>{payoutBadge(p.status)}</span>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div
                className="flex items-center justify-center gap-4 py-5 border-t"
                style={{ borderColor: 'var(--v-border)' }}
              >
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
                  style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
                >
                  <ChevronLeft size={14} style={{ color: 'var(--v-text-secondary)' }} />
                </button>
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {page}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasMore}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
                  style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
                >
                  <ChevronRight size={14} style={{ color: 'var(--v-text-secondary)' }} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPayoutModal && (
          <InitiatePayoutModal
            available={balance.available}
            currency={settings.currency}
            onClose={() => setShowPayoutModal(false)}
            instantFeeRate={instantFeeRate}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddBankModal && (
          <AddBankModal
            venueId={venueId}
            getToken={getToken}
            onClose={() => setShowAddBankModal(false)}
            onAdded={fetchAccounts}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
