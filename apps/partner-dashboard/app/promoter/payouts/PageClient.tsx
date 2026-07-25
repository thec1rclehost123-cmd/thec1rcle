'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  IndianRupee,
  AlertCircle,
  Landmark,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import dynamic from 'next/dynamic';

const StatTrendCard = dynamic(
  () => import('@/components/promoter/PlaceholderCharts').then((m) => m.StatTrendCard),
  { ssr: false },
);
import { formatINR, formatDate } from '@/lib/utils/format';
import { BankSetupForm, type BankSetupData } from '@/components/finance/BankSetupForm';

interface PayoutBalance {
  totalEarned: number;
  totalPaid: number;
  available: number;
  pending: number;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  requestedAt: string;
  completedAt?: string;
  eventName?: string;
  buyerName?: string;
  date?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  processing: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  cancelled: 'bg-surface-secondary text-text-tertiary border border-border-subtle',
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  processing: ArrowRight,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
};

const mp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PayoutsPage() {
  const { profile, getIdToken } = useDashboardAuth();
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [loadError, setLoadError] = useState('');

  const promoterId = profile?.activeMembership?.partnerId;

  useEffect(() => {
    if (promoterId) fetchPayoutData();
  }, [promoterId]);

  const fetchPayoutData = async () => {
    setLoadError('');
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const payoutRes = await fetch(`/api/partners/promoters/payouts?promoterId=${promoterId}`, {
        headers,
      });
      const payoutData = await payoutRes.json().catch(() => ({}));
      if (!payoutRes.ok) {
        throw new Error(payoutData.error?.message || 'Canonical payout data is unavailable');
      }
      setBalance(payoutData.balance || null);
      setPayouts(payoutData.payouts || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Canonical payout data is unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleBankSetup = useCallback(
    async (data: BankSetupData) => {
      if (!promoterId) return;
      setSubmitting(true);
      setSetupError('');
      try {
        const token = typeof getIdToken === 'function' ? await getIdToken() : '';
        const res = await fetch('/api/partners/promoters/finance/bank-accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
          },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error || 'Failed to save bank account.');
        }
        setShowSetup(false);
      } catch (err: any) {
        setSetupError(err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [promoterId, getIdToken],
  );

  return (
    <VenuePageShell
      title="Earnings & Payouts"
      actions={
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-200">
          Withdrawals unavailable during launch verification
        </span>
      }
    >
      {/* Hero band */}
      <motion.div
        {...mp(0)}
        className="relative overflow-hidden rounded-[32px] p-8"
        style={{ background: 'linear-gradient(135deg, #150d2e 0%, #0d0920 50%, #080810 100%)' }}
      >
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.12)' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-2">
              Total Earned
            </p>
            <p className="text-5xl font-black tracking-tighter tabular-nums text-white leading-none">
              {loading ? '—' : formatINR(balance?.totalEarned || 0)}
            </p>
            <p className="text-sm text-white/40 font-medium mt-2">
              {formatINR(balance?.available || 0)} available · {formatINR(balance?.pending || 0)}{' '}
              pending
            </p>
          </div>
          {balance && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300">
                  Provider verification in progress
                </p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Earnings remain visible while withdrawal mutations are disabled.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div {...mp(0.08)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTrendCard
          label="Total Earned"
          value={loading ? '—' : formatINR(balance?.totalEarned || 0)}
          color="#7c3aed"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatTrendCard
          label="Available"
          value={loading ? '—' : formatINR(balance?.available || 0)}
          color="#10b981"
          icon={<Wallet className="w-4 h-4" />}
          trendUp
        />
        <StatTrendCard
          label="Pending"
          value={loading ? '—' : formatINR(balance?.pending || 0)}
          color="#f59e0b"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatTrendCard
          label="Total Paid Out"
          value={loading ? '—' : formatINR(balance?.totalPaid || 0)}
          color="#6366f1"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
      </motion.div>

      {loadError ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4">
          <p className="text-sm text-red-200">{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchPayoutData()}
            className="rounded-xl border border-red-300/30 px-3 py-2 text-xs font-bold text-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Bank Account Setup */}
      <motion.div {...mp(0.12)}>
        {showSetup ? (
          <div className="rounded-[32px] bg-surface-elevated border border-border-default p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                  Bank Account
                </p>
                <p className="text-lg font-bold text-text-primary mt-0.5">
                  Set Up Payout Bank Account
                </p>
              </div>
              <button
                onClick={() => setShowSetup(false)}
                className="text-xs font-semibold text-text-tertiary hover:text-text-primary transition-colors"
              >
                Hide
              </button>
            </div>
            <BankSetupForm
              onSubmit={handleBankSetup}
              submitting={submitting}
              error={setupError}
              submitLabel="Save Bank Account"
              getAuthToken={getIdToken as () => Promise<string>}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowSetup(true)}
            className="w-full rounded-[32px] bg-surface-elevated border border-border-default p-5 mb-6 flex items-center gap-4 hover:bg-surface-secondary/50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-2xl bg-surface-tertiary flex items-center justify-center group-hover:bg-surface-secondary transition-colors">
              <Landmark className="w-5 h-5 text-text-tertiary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">Configure Bank Account</p>
              <p className="text-xs text-text-tertiary">
                Set up payouts to receive your earnings directly to your bank
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-tertiary ml-auto group-hover:text-text-primary transition-colors" />
          </button>
        )}
      </motion.div>

      {/* Payout History */}
      <motion.div
        {...mp(0.16)}
        className="rounded-[32px] bg-surface-elevated border border-border-default overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border-default flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
              Payout History
            </p>
            <p className="text-lg font-bold text-text-primary mt-0.5">Payout Requests</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-surface-tertiary text-xs font-bold text-text-tertiary">
            {payouts.length} total
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-surface-tertiary flex items-center justify-center mb-5">
              <Wallet className="w-7 h-7 text-text-placeholder" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">No payouts yet</h3>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {payouts.map((payout, i) => {
              const normalizedStatus = payout.status === 'cleared' ? 'completed' : payout.status;
              const StatusIcon = STATUS_ICONS[normalizedStatus] || Clock;
              return (
                <motion.div
                  key={payout.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="px-6 py-4 flex items-center justify-between hover:bg-surface-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-surface-tertiary flex items-center justify-center">
                      <IndianRupee className="w-4 h-4 text-text-tertiary" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-text-primary tabular-nums">
                        {formatINR(payout.amount)}
                      </p>
                      <p className="text-xs text-text-tertiary font-medium mt-0.5">
                        {(payout.paymentMethod || 'Payout request').replace(/_/g, ' ')} ·{' '}
                        {formatIncomeDate(payout.completedAt || payout.requestedAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${STATUS_STYLES[normalizedStatus] || STATUS_STYLES.cancelled}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {normalizedStatus === 'completed' ? 'paid' : normalizedStatus}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </VenuePageShell>
  );
}

function formatIncomeDate(value?: string) {
  return value ? formatDate(value) : 'Awaiting processing';
}
