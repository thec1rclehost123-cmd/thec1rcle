'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  Download,
  RefreshCw,
  Banknote,
  Info,
  ArrowLeft,
} from 'lucide-react';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { AppleHeroStat } from '@/components/ui/AppleHeroStat';
import { VenueStatStrip } from '@/components/ui/VenueStatStrip';
import { BentoCard } from '@/components/ui/BentoCard';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { BankSetupForm, type BankSetupData } from '@/components/finance/BankSetupForm';
import {
  formatINR,
  formatINRCompact,
  SETTLEMENT_STATUS_CONFIG,
  type PayoutRecord,
  type PayoutSettingsState,
} from '@/lib/finance/definitions';

// ── Payout Settings Page ──────────────────────────────────────────────────────

export default function VenuePayoutsSettingsClient() {
  const { profile, getIdToken } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId ?? '';

  const [showSetup, setShowSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const payoutsQuery = useQuery({
    queryKey: ['venue-payout-settings', venueId],
    queryFn: async ({ signal }) => {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const [overviewResponse, payoutsResponse, accountsResponse] = await Promise.all([
        fetch(`/api/venue/finance/overview?venueId=${venueId}&period=90d`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        }),
        fetch(`/api/venue/finance/payouts?venueId=${venueId}&limit=50`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        }),
        fetch(`/api/venue/finance/bank-accounts?venueId=${venueId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        }),
      ]);
      if (!overviewResponse.ok || !payoutsResponse.ok || !accountsResponse.ok) {
        throw new Error('Canonical payout data is unavailable.');
      }
      const [overviewBody, payoutsBody, accountsBody] = await Promise.all([
        overviewResponse.json(),
        payoutsResponse.json(),
        accountsResponse.json(),
      ]);
      const metrics = overviewBody.metrics || overviewBody.data?.metrics || {};
      const accounts = accountsBody.accounts || accountsBody.data?.accounts || [];
      return {
        availableBalance: Number(metrics.availableBalance || 0),
        totalSettled: Number(metrics.settledPayouts || 0),
        settingsState: (accounts.length > 0 ? 'active' : 'unconnected') as PayoutSettingsState,
        payouts: (payoutsBody.payouts || payoutsBody.data?.payouts || []).map((payout: any) => ({
          id: String(payout.id),
          amount: Number(payout.amount || 0),
          status: payout.status || 'pending',
          paymentMethod: payout.paymentMethod || 'bank_transfer',
          destination: payout.destination || 'Verified payout account',
          requestedAt: payout.requestedAt || payout.arrivalDate,
          completedAt: payout.completedAt,
        })),
      };
    },
    enabled: Boolean(venueId),
  });
  const settingsState = payoutsQuery.data?.settingsState ?? 'unconnected';
  const payouts = (payoutsQuery.data?.payouts ?? []) as PayoutRecord[];
  const loading = payoutsQuery.isLoading || payoutsQuery.isFetching;
  const totalSettled = payoutsQuery.data?.totalSettled ?? 0;
  const availableBalance = payoutsQuery.data?.availableBalance ?? 0;
  const loadError =
    payoutsQuery.error instanceof Error
      ? payoutsQuery.error.message
      : payoutsQuery.isError
        ? 'Canonical payout data is unavailable.'
        : '';

  const handleBankSetup = useCallback(
    async (data: BankSetupData) => {
      if (!venueId) return;
      setSubmitting(true);
      setSubmitError('');
      try {
        const token = typeof getIdToken === 'function' ? await getIdToken() : '';
        const res = await fetch('/api/venue/finance/bank-accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error || 'Failed to save bank account.');
        }
        setShowSetup(false);
        await payoutsQuery.refetch();
      } catch (err: any) {
        setSubmitError(err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [venueId, getIdToken, payoutsQuery],
  );

  return (
    <VenuePageShell
      title="Payout Settings"
      subtitle="Bank account, payout schedule, and settlement history"
      actions={
        <VenueActionButton variant="ghost" onClick={() => payoutsQuery.refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </VenueActionButton>
      }
    >
      {loadError && (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-[13px]"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}
        >
          {loadError}
        </div>
      )}
      {/* Payout status card */}
      {settingsState === 'unconnected' && !showSetup ? (
        <UnconnectedPayoutState venueId={venueId} onStartSetup={() => setShowSetup(true)} />
      ) : settingsState === 'unconnected' && showSetup ? (
        <div
          className="rounded-[var(--v-r-xl)] overflow-hidden p-8"
          style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
        >
          <button
            onClick={() => setShowSetup(false)}
            className="flex items-center gap-1.5 text-[12px] font-semibold mb-6"
            style={{ color: 'var(--v-text-muted)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <h2 className="text-[20px] font-bold mb-1" style={{ color: 'var(--v-text-primary)' }}>
            Set Up Payout Bank Account
          </h2>
          <p className="text-[13px] mb-6" style={{ color: 'var(--v-text-secondary)' }}>
            Enter your bank details to start receiving payouts from events.
          </p>
          <BankSetupForm
            onSubmit={handleBankSetup}
            submitting={submitting}
            error={submitError}
            submitLabel="Save & Continue"
            getAuthToken={getIdToken as () => Promise<string>}
          />
        </div>
      ) : (
        <>
          {/* Hero available balance */}
          <AppleHeroStat
            label="AVAILABLE BALANCE"
            value={loading ? '—' : formatINR(availableBalance)}
            subtitle="Ledger-settled balance"
            loading={loading}
            noData={!loading && !availableBalance}
          />

          {/* Stats */}
          <VenueStatStrip
            columns={2}
            stats={[
              {
                label: 'TOTAL SETTLED (90D)',
                value: loading ? '—' : formatINRCompact(totalSettled),
                loading,
              },
              { label: 'PAYOUT MUTATIONS', value: 'Provider verification pending' },
            ]}
          />

          {/* Payout history */}
          <PayoutHistoryTable payouts={payouts} loading={loading} />
        </>
      )}

      {/* Bank account section */}
      <BankAccountSection state={settingsState} />
    </VenuePageShell>
  );
}

// ── Unconnected State ─────────────────────────────────────────────────────────

function UnconnectedPayoutState({
  venueId,
  onStartSetup,
}: {
  venueId: string;
  onStartSetup?: () => void;
}) {
  return (
    <div
      className="rounded-[var(--v-r-xl)] overflow-hidden"
      style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
    >
      {/* Trust header */}
      <div className="px-8 py-10 text-center" style={{ borderBottom: '1px solid var(--v-border)' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(var(--v-orange-rgb, 244,74,34),0.12)' }}
        >
          <Banknote className="w-7 h-7" style={{ color: 'var(--v-orange)' }} />
        </div>
        <h2 className="text-[20px] font-bold mb-2" style={{ color: 'var(--v-text-primary)' }}>
          Connect a Bank Account
        </h2>
        <p className="text-[14px] max-w-sm mx-auto" style={{ color: 'var(--v-text-secondary)' }}>
          Set up payouts to receive your venue's earnings directly to your bank account. Secure,
          fast, and compliant.
        </p>
      </div>

      {/* Trust signals */}
      <div
        className="grid grid-cols-3 divide-x"
        style={{ borderBottom: '1px solid var(--v-border)', borderColor: 'var(--v-border)' }}
      >
        {[
          { icon: ShieldCheck, label: 'Bank-grade encryption', desc: '256-bit TLS + data at rest' },
          { icon: CheckCircle2, label: 'RBI compliant', desc: 'Regulated payout rails' },
          { icon: Clock, label: 'T+1 settlements', desc: 'Next business day payouts' },
        ].map((t) => (
          <div key={t.label} className="px-6 py-5 text-center">
            <t.icon className="w-5 h-5 mx-auto mb-2" style={{ color: '#34D399' }} />
            <p className="text-[12px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
              {t.label}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--v-text-muted)' }}>
              {t.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Blocked capabilities */}
      <div className="px-8 py-6" style={{ borderBottom: '1px solid var(--v-border)' }}>
        <p
          className="text-[11px] font-bold uppercase tracking-widest mb-3"
          style={{ color: 'var(--v-text-muted)' }}
        >
          UNLOCKED AFTER SETUP
        </p>
        <div className="grid grid-cols-2 gap-2">
          {['Payout history & receipts', 'Tax document generation', 'PDF statements'].map((cap) => (
            <div key={cap} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#34D399' }} />
              <span className="text-[12px]" style={{ color: 'var(--v-text-secondary)' }}>
                {cap}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-8 py-6 flex items-center gap-3">
        <button
          onClick={onStartSetup}
          className="flex-1 py-3.5 rounded-xl text-[14px] font-bold transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'var(--v-orange)', color: '#fff' }}
        >
          Start Payout Setup
        </button>
      </div>
    </div>
  );
}

// ── Bank Account Section ──────────────────────────────────────────────────────

function BankAccountSection({ state }: { state: PayoutSettingsState }) {
  return (
    <BentoCard
      header={
        <div className="flex items-center justify-between w-full">
          <span className="v-label">BANK ACCOUNT</span>
          {state === 'active' && (
            <span className="text-[11px]" style={{ color: 'var(--v-text-muted)' }}>
              Managed through verified setup
            </span>
          )}
        </div>
      }
    >
      {state === 'unconnected' ? (
        <div className="flex items-center gap-3 py-2">
          <Info className="w-4 h-4 shrink-0" style={{ color: 'var(--v-text-muted)' }} />
          <p className="text-[13px]" style={{ color: 'var(--v-text-muted)' }}>
            No bank account connected. Complete setup above to enable payouts.
          </p>
        </div>
      ) : (
        <div
          className="flex items-center gap-4 p-4 rounded-xl"
          style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.12)' }}
          >
            <Building2 className="w-5 h-5" style={{ color: '#34D399' }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
              Verified payout account
            </p>
            <p className="text-[12px]" style={{ color: 'var(--v-text-muted)' }}>
              Sensitive account details are available only from the finance API.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}
            >
              Verified
            </span>
          </div>
        </div>
      )}
    </BentoCard>
  );
}

// ── Payout History Table ──────────────────────────────────────────────────────

function PayoutHistoryTable({ payouts, loading }: { payouts: PayoutRecord[]; loading: boolean }) {
  const exportCsv = useCallback(() => {
    const rows = [
      ['Payout ID', 'Amount', 'Status', 'Requested At', 'Completed At'],
      ...payouts.map((payout) => [
        payout.id,
        String(payout.amount),
        payout.status,
        payout.requestedAt || '',
        payout.completedAt || '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'venue-payouts.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [payouts]);

  return (
    <BentoCard
      header={
        <div className="flex items-center justify-between w-full">
          <span className="v-label">SETTLEMENT HISTORY</span>
          <button
            onClick={exportCsv}
            disabled={payouts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{
              background: 'var(--v-elevated)',
              color: 'var(--v-text-secondary)',
              border: '1px solid var(--v-border)',
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      }
      loading={loading}
      empty={!loading && payouts.length === 0}
      emptyTitle="No payout history yet"
      emptyIcon={<Banknote className="w-8 h-8" />}
      padding="sm"
    >
      <div className="divide-y" style={{ borderColor: 'var(--v-border)' }}>
        {payouts.map((p) => {
          const cfg = SETTLEMENT_STATUS_CONFIG[p.status];
          return (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${cfg.bg}` }}
              >
                <Banknote className="w-4 h-4" style={{ color: cfg.text }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
                  {formatINR(p.amount)}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--v-text-muted)' }}>
                  {p.destination} ·{' '}
                  {new Date(p.requestedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <span
                className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
                style={{ background: cfg.bg, color: cfg.text }}
              >
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
