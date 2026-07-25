'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Clock, CheckCircle2, AlertCircle, Search, CreditCard } from 'lucide-react';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { AppleHeroStat } from '@/components/ui/AppleHeroStat';
import { VenueStatStrip } from '@/components/ui/VenueStatStrip';
import { BentoCard } from '@/components/ui/BentoCard';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

type PayoutRow = {
  id: string;
  amountPaise: number;
  requestedAt: string | null;
  completedAt?: string | null;
  status: string;
  destination: string | null;
};

type PayoutResponse = {
  payouts?: PayoutRow[];
  balance?: { availablePaise?: number; pendingPaise?: number; currency?: string };
  bankAccount?: { bankName?: string; last4?: string | null } | null;
  withdrawalsEnabled?: boolean;
  error?: string;
};

function fmtCurrency(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((Number(paise) || 0) / 100);
}

export default function PayoutsPage() {
  const { getIdToken } = useDashboardAuth();
  const [data, setData] = useState<PayoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const response = await fetch('/api/venue/finance/payouts', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await response.json().catch(() => ({}))) as PayoutResponse;
      if (!response.ok) throw new Error(body.error || 'Unable to load payouts');
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load payouts');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const payouts = data?.payouts || [];
  const filtered = useMemo(
    () => payouts.filter((p) => p.id.toLowerCase().includes(search.toLowerCase())),
    [payouts, search],
  );
  const totalSettled = payouts
    .filter((p) => ['completed', 'paid', 'settled', 'cleared'].includes(p.status))
    .reduce((s, p) => s + p.amountPaise, 0);
  const bankLabel = data?.bankAccount
    ? `${data.bankAccount.bankName || 'Bank account'}${
        data.bankAccount.last4 ? ` •••• ${data.bankAccount.last4}` : ''
      }`
    : 'No payout account';

  const exportCsv = useCallback(() => {
    if (!payouts.length) return;
    const rows = [
      ['Payout ID', 'Requested At', 'Amount Paise', 'Currency', 'Destination', 'Status'],
      ...payouts.map((p) => [
        p.id,
        p.requestedAt || '',
        String(p.amountPaise),
        data?.balance?.currency || 'INR',
        p.destination || '',
        p.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `venue-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [data?.balance?.currency, payouts]);

  return (
    <VenuePageShell
      title="Payouts"
      subtitle="Track your earnings and bank transfers"
      actions={
        <VenueActionButton variant="secondary" onClick={exportCsv} disabled={!payouts.length}>
          <Download className="w-4 h-4" /> Export CSV
        </VenueActionButton>
      }
    >
      {/* Hero balance */}
      <AppleHeroStat
        label="AVAILABLE BALANCE"
        value={loading ? '—' : fmtCurrency(data?.balance?.availablePaise || 0)}
        subtitle={
          error
            ? 'Canonical payout data is temporarily unavailable'
            : `${fmtCurrency(data?.balance?.pendingPaise || 0)} pending · ${bankLabel}`
        }
      />

      {/* Financial strip */}
      <VenueStatStrip
        stats={[
          {
            label: 'TOTAL SETTLED',
            value: fmtCurrency(totalSettled),
          },
          {
            label: 'PENDING PAYOUT',
            value: loading ? '—' : fmtCurrency(data?.balance?.pendingPaise || 0),
          },
          {
            label: 'ACTIVE BANK',
            value: loading ? '—' : bankLabel,
            icon: <CreditCard className="w-3.5 h-3.5" />,
          },
        ]}
        columns={3}
      />

      {/* Payout history */}
      <BentoCard
        header={
          <>
            <span className="v-label">TRANSFER HISTORY</span>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: 'var(--v-text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search by ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-[12px] rounded-xl outline-none focus:ring-1"
                style={{
                  background: 'var(--v-elevated)',
                  color: 'var(--v-text-primary)',
                  border: '1px solid var(--v-border)',
                  width: 180,
                }}
              />
            </div>
          </>
        }
        padding="sm"
      >
        {error ? (
          <div className="flex items-center justify-between gap-4 px-5 py-8">
            <p className="text-sm" style={{ color: 'var(--v-error)' }}>
              {error}
            </p>
            <VenueActionButton variant="secondary" onClick={() => void load()}>
              Retry
            </VenueActionButton>
          </div>
        ) : null}

        {/* Table header */}
        <div
          className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr] px-5 py-3 rounded-xl mb-1"
          style={{ background: 'var(--v-elevated)' }}
        >
          {['PAYOUT ID', 'DATE', 'AMOUNT', 'DESTINATION', 'STATUS'].map((h) => (
            <span
              key={h}
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--v-text-muted)' }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-1">
          {loading ? (
            <div
              className="px-5 py-10 text-center text-sm"
              style={{ color: 'var(--v-text-muted)' }}
            >
              Loading canonical payouts…
            </div>
          ) : filtered.length === 0 && !error ? (
            <div
              className="px-5 py-10 text-center text-sm"
              style={{ color: 'var(--v-text-muted)' }}
            >
              No payouts found.
            </div>
          ) : null}
          {filtered.map((p) => {
            const ok = ['completed', 'paid', 'settled', 'cleared'].includes(p.status);
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr] px-5 py-3 rounded-xl items-center transition-colors hover:brightness-125"
                style={{ background: 'var(--v-elevated)' }}
              >
                <span
                  className="text-[12px] font-bold tabular-nums"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  #{p.id}
                </span>
                <div className="flex items-center gap-2">
                  <Clock
                    className="w-3 h-3 flex-shrink-0"
                    style={{ color: 'var(--v-text-muted)' }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--v-text-secondary)' }}>
                    {p.requestedAt ? new Date(p.requestedAt).toLocaleDateString('en-IN') : '—'}
                  </span>
                </div>
                <span
                  className="text-[14px] font-bold tabular-nums"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {fmtCurrency(p.amountPaise)}
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full w-fit"
                  style={{ background: 'var(--v-card)', color: 'var(--v-text-muted)' }}
                >
                  {p.destination || bankLabel}
                </span>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{
                      background: ok ? 'var(--v-success-bg)' : 'var(--v-error-bg)',
                      color: ok ? 'var(--v-success)' : 'var(--v-error)',
                    }}
                  >
                    {ok ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" /> Settled
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-2.5 h-2.5" /> Retrying
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </BentoCard>
    </VenuePageShell>
  );
}
