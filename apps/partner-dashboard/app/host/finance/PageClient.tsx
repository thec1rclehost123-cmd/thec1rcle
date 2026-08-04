'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Zap,
  Landmark,
} from 'lucide-react';
import { WalletPopover } from '@/components/wallet/WalletPopover';
import { AnimatePresence, motion } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import {
  PartnerFinanceSurface,
  type FinanceBankAccount,
  type FinancePayoutRow,
  type FinanceRow,
  type FinanceSettingRow,
} from '@/components/finance/PartnerFinanceSurface';
import { ConnectPayoutMethodModal } from '@/components/finance/ConnectPayoutMethodModal';
import { formatINR } from '@/lib/finance/definitions';

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
  dailyPayouts: boolean;
}

type ActiveView = 'main' | 'disputes';

function fmt(amount: number, currency = 'INR') {
  if (currency === 'INR') return formatINR(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function fmtDate(iso: string | null) {
  if (!iso) return 'Upcoming payout';
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

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="relative h-7 w-12 rounded-full transition-colors"
      style={{
        background: on ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
        style={{ left: 3, transform: on ? 'translateX(21px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function AddBankModal({
  onClose,
  onAdded,
  hostId,
  getAuthHeaders,
}: {
  onClose: () => void;
  onAdded: () => void;
  hostId: string;
  getAuthHeaders: (includeJson?: boolean) => Promise<Record<string, string>>;
}) {
  return (
    <ConnectPayoutMethodModal
      title="Connect Payout Method"
      endpoint="/api/partners/hosts/finance/bank-accounts"
      bodyBase={{ hostId }}
      getHeaders={async () => await getAuthHeaders(true)}
      onClose={onClose}
      onAdded={onAdded}
    />
  );
}

function DisputesView({
  hostId,
  onBack,
  getAuthHeaders,
}: {
  hostId: string;
  onBack: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
}) {
  const disputesQuery = useQuery({
    queryKey: ['host-finance-disputes', hostId],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/partners/hosts/finance/disputes?hostId=${hostId}`, {
        headers: await getAuthHeaders(),
        signal,
      });
      if (!response.ok) throw new Error('Failed to load disputes');
      const data = await response.json();
      return (data.disputes || []) as Dispute[];
    },
    enabled: Boolean(hostId),
  });
  const disputes = disputesQuery.data ?? [];
  const loading = disputesQuery.isLoading;

  return (
    <div className="mx-auto max-w-[1280px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-[14px] font-semibold"
        style={{ color: 'rgba(255,255,255,0.52)' }}
      >
        <ChevronLeft size={16} /> Back
      </button>

      <h1
        className="text-[40px] font-bold tracking-tight"
        style={{ color: 'rgba(255,255,255,0.96)' }}
      >
        Disputes
      </h1>
      <p className="mb-8 mt-2 text-[14px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
        C1rcle automatically fights disputes for you. Review their status here.
      </p>

      <div
        className="overflow-hidden rounded-[28px]"
        style={{ background: '#17171b', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: 'rgba(255,255,255,0.42)' }}
            />
          </div>
        ) : disputes.length === 0 ? (
          <div
            className="py-20 text-center text-[15px]"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            No disputes found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {[
                    'Dispute Created',
                    'Order',
                    'Customer Name',
                    'Tracking Link',
                    'Disputed Amount',
                    'Dispute Fee',
                    'Status',
                    'Curator',
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-4 text-[12px] font-bold"
                      style={{ color: 'rgba(255,255,255,0.42)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disputes.map((dispute) => (
                  <tr key={dispute.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      {fmtDateTime(dispute.createdAt)}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      {dispute.orderId ? `#${dispute.orderId}` : '—'}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      {dispute.customerName}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px]"
                      style={{ color: 'rgba(255,255,255,0.42)' }}
                    >
                      {dispute.trackingLink || '—'}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px] font-semibold tabular-nums"
                      style={{ color: 'rgba(255,255,255,0.92)' }}
                    >
                      {fmt(dispute.disputedAmount)}
                    </td>
                    <td
                      className="px-5 py-4 text-[13px] tabular-nums"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      {fmt(dispute.disputeFee)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                        style={{
                          borderColor: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        {dispute.disputeStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-[12px]"
                      style={{ color: 'rgba(255,255,255,0.52)' }}
                    >
                      {dispute.curatorStatus || '—'}
                    </td>
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

export default function HostFinancePageClient() {
  const { profile, user } = useDashboardAuth();
  const hostId = profile?.activeMembership?.partnerId as string | undefined;

  const [view, setView] = useState<ActiveView>('main');
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<Settings>({
    country: 'India',
    currency: 'INR',
    statementDescriptor: 'C1RCLE',
    dailyPayouts: false,
  });
  const [showAddBankModal, setShowAddBankModal] = useState(false);

  const getAuthHeaders = useCallback(
    async (includeJson = false) => {
      const token = user ? await user.getIdToken() : '';
      return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    },
    [user],
  );

  const balanceQuery = useQuery({
    queryKey: ['host-finance-balance', hostId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/partners/hosts/finance/overview?hostId=${hostId}&period=30d`, {
        headers: await getAuthHeaders(),
        signal,
      });
      if (!res.ok) throw new Error('Failed to load finance balance');
      const data = await res.json();
      const metrics = data.metrics;
      return {
        available: metrics?.availableBalance || 0,
        pending: metrics?.pendingPayouts || 0,
        instantAvailable: metrics?.availableBalance || 0,
      } as BalanceData;
    },
    enabled: Boolean(hostId && user),
  });

  const payoutsQuery = useQuery({
    queryKey: ['host-finance-payouts', hostId, page],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/partners/hosts/finance/payouts?hostId=${hostId}&page=${page}&limit=10`,
        {
          headers: await getAuthHeaders(),
          signal,
        },
      );
      if (!res.ok) throw new Error('Failed to load payouts');
      const data = await res.json();
      return {
        payouts: (data.payouts || []) as Payout[],
        hasMore: Boolean(data.hasMore),
      };
    },
    enabled: Boolean(hostId && user),
  });

  const accountsQuery = useQuery({
    queryKey: ['host-finance-accounts', hostId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/partners/hosts/finance/bank-accounts?hostId=${hostId}`, {
        headers: await getAuthHeaders(),
        signal,
      });
      if (!res.ok) throw new Error('Failed to load payout accounts');
      const data = await res.json();
      return (data.accounts || []) as BankAccount[];
    },
    enabled: Boolean(hostId && user),
  });

  const handleRefreshAll = () => {
    void Promise.all([balanceQuery.refetch(), payoutsQuery.refetch(), accountsQuery.refetch()]);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const removeAccount = useCallback(
    async (accountId: string) => {
      if (!hostId) return;
      await fetch(
        `/api/partners/hosts/finance/bank-accounts?hostId=${hostId}&accountId=${accountId}`,
        {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        },
      );
      await accountsQuery.refetch();
    },
    [accountsQuery, getAuthHeaders, hostId],
  );

  const balance = balanceQuery.data ?? { available: 0, pending: 0, instantAvailable: 0 };
  const balanceLoading = balanceQuery.isLoading;
  const payouts = payoutsQuery.data?.payouts ?? [];
  const hasMore = payoutsQuery.data?.hasMore ?? false;
  const payoutsLoading = payoutsQuery.isLoading || payoutsQuery.isFetching;
  const accounts = accountsQuery.data ?? [];
  const accountsLoading = accountsQuery.isLoading;
  const refreshedTimestamp = Math.max(
    balanceQuery.dataUpdatedAt,
    payoutsQuery.dataUpdatedAt,
    accountsQuery.dataUpdatedAt,
  );
  const refreshedAt = refreshedTimestamp ? new Date(refreshedTimestamp) : null;

  const balanceRows = useMemo<FinanceRow[]>(
    () => [
      { label: 'Available', value: balanceLoading ? '...' : fmt(balance.available) },
      {
        label: 'Pending',
        value: balanceLoading ? '...' : fmt(balance.pending),
        helpLabel: 'Funds settling from recent events.',
      },
      {
        label: 'Instant Available',
        value: balanceLoading ? '...' : fmt(balance.instantAvailable),
        helpLabel: 'Eligible for instant transfer.',
      },
    ],
    [balance.available, balance.instantAvailable, balance.pending, balanceLoading],
  );

  const settingsRows = useMemo<FinanceSettingRow[]>(
    () => [
      { label: 'Country', value: 'India' },
      { label: 'Currency', value: settings.currency },
      { label: 'Statement Descriptor', value: settings.statementDescriptor },
      {
        label: 'Payout Schedule',
        value: (
          <span className="inline-flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {settings.dailyPayouts ? 'Daily' : 'Weekly'} <ChevronDown size={14} />
            </span>
            <Toggle
              on={settings.dailyPayouts}
              onChange={(value) => setSettings((prev) => ({ ...prev, dailyPayouts: value }))}
            />
          </span>
        ),
      },
    ],
    [settings.currency, settings.dailyPayouts, settings.statementDescriptor],
  );

  const bankAccounts = useMemo<FinanceBankAccount[]>(
    () =>
      accountsLoading
        ? []
        : accounts.map((account) => ({
            id: account.id,
            name:
              account.paymentType === 'debit_card'
                ? `${account.bankName} Debit Card`
                : account.bankName,
            detail: `${account.paymentType === 'debit_card' ? 'Card' : 'Account'} •••• ${account.last4}`,
            badge: account.isDefault ? 'Default' : undefined,
            onClick: () => removeAccount(account.id),
          })),
    [accounts, accountsLoading, removeAccount],
  );

  const payoutRows = useMemo<FinancePayoutRow[]>(
    () =>
      payouts.map((payout) => ({
        id: payout.id,
        date: fmtDate(payout.arrivalDate),
        detail: payout.eventName
          ? `${payout.eventName}${payout.eventDate ? ` · ${new Date(payout.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
          : payout.description || 'Host settlement',
        amount: fmt(payout.amount, payout.currency),
        status:
          payout.status === 'in_transit'
            ? 'In Transit'
            : payout.status === 'failed'
              ? 'Failed'
              : 'Paid',
        statusTone:
          payout.status === 'paid' ? 'success' : payout.status === 'failed' ? 'danger' : 'info',
      })),
    [payouts],
  );

  if (!hostId) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <h1
          className="mb-5 text-[44px] font-bold tracking-tight"
          style={{ color: 'rgba(255,255,255,0.96)' }}
        >
          Finance
        </h1>
        <div
          className="h-[720px] animate-pulse rounded-[28px]"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
      </div>
    );
  }

  if (view === 'disputes') {
    return (
      <DisputesView
        hostId={hostId}
        onBack={() => setView('main')}
        getAuthHeaders={() => getAuthHeaders()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-5 flex items-center justify-between">
        <h1
          className="text-[44px] font-bold tracking-tight"
          style={{ color: 'rgba(255,255,255,0.96)' }}
        >
          Finance
        </h1>
        <WalletPopover />
      </div>

      <PartnerFinanceSurface
        balanceRows={balanceRows}
        settingsRows={settingsRows}
        bankAccounts={bankAccounts}
        payouts={payoutRows}
        onRefresh={handleRefreshAll}
        refreshing={payoutsLoading || balanceLoading}
        lastUpdatedLabel={
          refreshedAt
            ? `Last updated ${refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : null
        }
        payoutsLoading={payoutsLoading}
        payoutsEmptyTitle="No payouts yet."
        payoutsEmptyDescription="Payouts will appear here once events start generating revenue."
        onEditBanks={() => {}}
        onAddBank={() => setShowAddBankModal(true)}
        bankEmptyLabel={accountsLoading ? 'Loading accounts...' : '+ Add Bank Account'}
        leftFooter={
          <button
            type="button"
            onClick={() => setView('disputes')}
            className="w-full rounded-[20px] border px-4 py-3.5 text-[13px] font-bold"
            style={{
              background: 'rgba(24,24,28,0.96)',
              borderColor: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            View Disputes
          </button>
        }
        payoutsFooter={
          payouts.length ? (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.52)',
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <span
                className="text-[14px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.88)' }}
              >
                {page}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasMore}
                className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.52)',
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          ) : null
        }
      />

      <AnimatePresence>
        {showAddBankModal ? (
          <AddBankModal
            hostId={hostId}
            onClose={() => setShowAddBankModal(false)}
            onAdded={() => void accountsQuery.refetch()}
            getAuthHeaders={getAuthHeaders}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
