'use client';

import type { ReactNode } from 'react';
import {
  HelpCircle,
  Pencil,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowDownLeft,
  Minus,
  Wallet2,
} from 'lucide-react';

export interface FinanceRow {
  label: string;
  value: ReactNode;
  helpLabel?: string;
}

export interface FinanceSettingRow {
  label: string;
  value: ReactNode;
}

export interface FinanceBankAccount {
  id: string;
  name: string;
  detail: string;
  badge?: string;
  onClick?: () => void;
}

export interface FinancePayoutRow {
  id: string;
  date: string;
  detail?: ReactNode;
  amount: string;
  status: string;
  statusTone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  userName?: string;
  headline?: string;
  subtitle?: ReactNode;
  avatar?: string;
}

interface PartnerFinanceSurfaceProps {
  balanceRows: FinanceRow[];
  settingsRows: FinanceSettingRow[];
  bankAccounts: FinanceBankAccount[];
  payouts: FinancePayoutRow[];
  balanceActionLabel?: string;
  onBalanceAction?: () => void;
  balanceActionDisabled?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  lastUpdatedLabel?: string | null;
  payoutsLoading?: boolean;
  payoutsEmptyTitle?: string;
  payoutsEmptyDescription?: string;
  onAddBank?: () => void;
  onEditBanks?: () => void;
  bankEmptyLabel?: string;
  leftFooter?: ReactNode;
  payoutsFooter?: ReactNode;
  balanceVariant?: 'default' | 'wallet';
  payoutsVariant?: 'default' | 'pill';
}

const statusToneMap: Record<
  NonNullable<FinancePayoutRow['statusTone']>,
  { bg: string; color: string; border: string }
> = {
  success: { bg: 'rgba(34,197,94,0.14)', color: '#86efac', border: 'rgba(34,197,94,0.18)' },
  warning: { bg: 'rgba(245,158,11,0.14)', color: '#fcd34d', border: 'rgba(245,158,11,0.2)' },
  danger: { bg: 'rgba(239,68,68,0.14)', color: '#fca5a5', border: 'rgba(239,68,68,0.2)' },
  info: { bg: 'rgba(59,130,246,0.14)', color: '#93c5fd', border: 'rgba(59,130,246,0.2)' },
  neutral: {
    bg: 'rgba(255,255,255,0.04)',
    color: 'var(--v-text-secondary)',
    border: 'var(--v-border)',
  },
};

function FinanceCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[28px] px-6 py-7"
      style={{
        background: 'rgba(24,24,28,0.96)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <p
          className="text-[11px] font-black uppercase tracking-[0.26em]"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          {title}
        </p>
        {actions}
      </div>
      {children}
    </section>
  );
}

function getFinanceInitials(value?: string) {
  if (!value) return 'CI';
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function PartnerFinanceSurface({
  balanceRows,
  settingsRows,
  bankAccounts,
  payouts,
  balanceActionLabel,
  onBalanceAction,
  balanceActionDisabled = false,
  onRefresh,
  refreshing = false,
  lastUpdatedLabel,
  payoutsLoading = false,
  payoutsEmptyTitle = 'No payouts yet.',
  payoutsEmptyDescription = 'Payouts will appear here once revenue starts flowing.',
  onAddBank,
  onEditBanks,
  bankEmptyLabel = '+ Add Bank Account',
  leftFooter,
  payoutsFooter,
  balanceVariant = 'default',
  payoutsVariant = 'default',
}: PartnerFinanceSurfaceProps) {
  const primaryBalance = balanceRows[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5">
        {balanceVariant === 'wallet' ? (
          <section>
            <div
              className="relative rounded-[28px] p-5"
              style={{
                background:
                  'linear-gradient(145deg, rgba(94,194,255,0.34) 0%, rgba(47,99,255,0.3) 52%, rgba(21,50,184,0.28) 100%)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 24px 50px rgba(24,60,255,0.18)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 28,
                  pointerEvents: 'none',
                  background:
                    'radial-gradient(circle at 18% 14%, rgba(255,255,255,0.28) 0%, transparent 26%), radial-gradient(circle at 85% 0%, rgba(120,185,255,0.26) 0%, transparent 30%)',
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/14 text-white backdrop-blur">
                  <Wallet2 size={18} />
                </div>
                <span className="rounded-full border border-white/20 bg-black/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                  {primaryBalance?.label || 'Balance'}
                </span>
              </div>

              <div className="relative mt-7">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/62">
                  Wallet Balance
                </p>
                <div className="mt-2 text-[40px] font-black tracking-[-0.04em] text-white tabular-nums">
                  {primaryBalance?.value}
                </div>
              </div>

              <div className="relative mt-6 grid gap-3">
                {balanceRows.slice(1).map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-[18px] border px-4 py-3"
                    style={{
                      borderColor: 'rgba(255,255,255,0.14)',
                      background: 'rgba(7,16,52,0.18)',
                      backdropFilter: 'blur(18px)',
                      WebkitBackdropFilter: 'blur(18px)',
                    }}
                  >
                    <span
                      className="flex items-center gap-1.5 text-[13px] font-semibold"
                      style={{ color: 'rgba(255,255,255,0.74)' }}
                    >
                      {row.label}
                      {row.helpLabel ? (
                        <span className="group relative flex items-center">
                          <HelpCircle
                            size={13}
                            style={{ color: 'rgba(255,255,255,0.34)', cursor: 'help' }}
                          />
                          <div
                            className="absolute bottom-full left-[-10px] mb-2 w-max max-w-[240px] rounded-[10px] p-2.5 text-[12px] font-medium leading-[1.4] opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none z-[100]"
                            style={{
                              background: 'rgba(15,15,20,0.98)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: 'rgba(255,255,255,0.9)',
                              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                              backdropFilter: 'blur(12px)',
                            }}
                          >
                            {row.helpLabel}
                          </div>
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="text-[15px] font-semibold tabular-nums"
                      style={{ color: '#fff' }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {balanceActionLabel && onBalanceAction ? (
                <button
                  type="button"
                  onClick={onBalanceAction}
                  disabled={balanceActionDisabled}
                  className="relative mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] px-4 text-[14px] font-bold transition-opacity disabled:cursor-not-allowed"
                  style={{
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                    opacity: balanceActionDisabled ? 0.45 : 1,
                  }}
                >
                  {balanceActionLabel}
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <FinanceCard title="Balance">
            <>
              <div className="space-y-3.5">
                {balanceRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span
                      className="flex items-center gap-1.5 text-[14px]"
                      style={{ color: 'rgba(255,255,255,0.66)' }}
                    >
                      {row.label}
                      {row.helpLabel ? (
                        <span className="group relative flex items-center">
                          <HelpCircle
                            size={13}
                            style={{ color: 'rgba(255,255,255,0.28)', cursor: 'help' }}
                          />
                          <div
                            className="absolute bottom-full left-[-10px] mb-2 w-max max-w-[240px] rounded-[10px] p-2.5 text-[12px] font-medium leading-[1.4] opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none z-[100]"
                            style={{
                              background: 'rgba(15,15,20,0.98)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: 'rgba(255,255,255,0.9)',
                              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                              backdropFilter: 'blur(12px)',
                            }}
                          >
                            {row.helpLabel}
                          </div>
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="text-[15px] font-semibold tabular-nums"
                      style={{ color: 'rgba(255,255,255,0.92)' }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {balanceActionLabel && onBalanceAction ? (
                <button
                  type="button"
                  onClick={onBalanceAction}
                  disabled={balanceActionDisabled}
                  className="mt-7 w-full rounded-[18px] px-4 py-3.5 text-[14px] font-bold transition-opacity disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.92)',
                    opacity: balanceActionDisabled ? 0.45 : 1,
                  }}
                >
                  {balanceActionLabel}
                </button>
              ) : null}
            </>
          </FinanceCard>
        )}

        <FinanceCard title="Settings">
          <div className="space-y-5">
            {settingsRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-5">
                <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.66)' }}>
                  {row.label}
                </span>
                <div
                  className="min-w-0 text-right text-[14px] font-medium"
                  style={{ color: 'rgba(255,255,255,0.92)' }}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </FinanceCard>

        <FinanceCard
          title="Banks & Debit Cards"
          actions={
            <div className="flex items-center gap-2">
              {onEditBanks ? (
                <button
                  type="button"
                  onClick={onEditBanks}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.46)',
                  }}
                >
                  <Pencil size={14} />
                </button>
              ) : null}
              {onAddBank ? (
                <button
                  type="button"
                  onClick={onAddBank}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.46)',
                  }}
                >
                  <Plus size={14} />
                </button>
              ) : null}
            </div>
          }
        >
          {bankAccounts.length ? (
            <div className="space-y-3">
              {bankAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={account.onClick}
                  className="flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderColor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{account.name}</p>
                    <p className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.46)' }}>
                      {account.detail}
                    </p>
                  </div>
                  {account.badge ? (
                    <span
                      className="ml-4 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.52)',
                      }}
                    >
                      {account.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAddBank}
              className="w-full rounded-[18px] border border-dashed px-4 py-4 text-[14px] font-semibold"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            >
              {bankEmptyLabel}
            </button>
          )}
        </FinanceCard>

        {leftFooter}
      </div>

      <section
        className="overflow-hidden rounded-[28px]"
        style={{
          background: 'rgba(24,24,28,0.96)',
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: 680,
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-7 py-6"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div>
            <p
              className="text-[11px] font-black uppercase tracking-[0.26em]"
              style={{ color: 'rgba(255,255,255,0.42)' }}
            >
              Payouts
            </p>
            {lastUpdatedLabel ? (
              <p className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {lastUpdatedLabel}
              </p>
            ) : null}
          </div>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.42)',
              }}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          ) : null}
        </div>

        {payoutsLoading ? (
          <div className="space-y-3 px-7 py-7">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-[18px]"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <div className="flex min-h-[620px] flex-col items-center justify-center px-8 text-center">
            <p className="text-[34px] font-medium" style={{ color: 'rgba(255,255,255,0.44)' }}>
              {payoutsEmptyTitle}
            </p>
            <p
              className="mt-2 max-w-[420px] text-[18px]"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              {payoutsEmptyDescription}
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 py-5 space-y-3">
              {payouts.map((payout) => {
                const tone = statusToneMap[payout.statusTone ?? 'neutral'];
                const StatusIcon =
                  payout.statusTone === 'success'
                    ? CheckCircle2
                    : payout.statusTone === 'warning'
                      ? Clock
                      : payout.statusTone === 'danger'
                        ? XCircle
                        : payout.statusTone === 'info'
                          ? ArrowDownLeft
                          : Minus;
                const initials = getFinanceInitials(payout.userName || payout.status);
                const headline = payout.headline || payout.amount;
                const subtitle = payout.subtitle || payout.detail;

                if (payoutsVariant === 'pill') {
                  return (
                    <div
                      key={payout.id}
                      className="flex items-center gap-4 rounded-[999px] px-4 py-3"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                      }}
                    >
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full shrink-0 overflow-hidden relative"
                        style={{
                          background:
                            'linear-gradient(145deg, rgba(244,106,58,0.36) 0%, rgba(94,194,255,0.28) 100%)',
                          border: '2px solid rgba(255,255,255,0.12)',
                          color: '#fff',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                        }}
                      >
                        {payout.avatar ? (
                          <img
                            src={payout.avatar}
                            alt={payout.userName || ''}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[18px] font-black tracking-[-0.04em]">
                            {initials}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[18px] font-semibold text-white">{headline}</p>
                        {subtitle ? (
                          <p
                            className="mt-1 truncate text-[13px]"
                            style={{ color: 'rgba(255,255,255,0.72)' }}
                          >
                            {subtitle}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.34)' }}>
                          {payout.date}
                        </p>
                      </div>

                      <span
                        className="shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {payout.status}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={payout.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      borderRadius: 18,
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    {/* Status icon circle */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: tone.bg,
                        border: `2px solid ${tone.border}`,
                      }}
                    >
                      <StatusIcon size={16} style={{ color: tone.color }} />
                    </div>

                    {/* Date + detail */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'rgba(255,255,255,0.88)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {headline}
                      </p>
                      {subtitle && (
                        <p
                          style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.36)',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subtitle}
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 4 }}>
                        {payout.date}
                      </p>
                    </div>

                    {/* Amount + status badge */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p
                        className="tabular-nums"
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: tone.color,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {payout.amount}
                      </p>
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: 4,
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                          borderRadius: 100,
                          padding: '2px 7px',
                        }}
                      >
                        {payout.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {payoutsFooter ? (
              <div className="border-t px-7 py-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {payoutsFooter}
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
