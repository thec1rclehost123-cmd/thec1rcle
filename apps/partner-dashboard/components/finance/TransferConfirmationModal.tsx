'use client';

import { useState } from 'react';
import { X, Wallet2, Landmark, ShieldCheck, ArrowUpRight, Loader2 } from 'lucide-react';
import { formatINR } from '@/lib/finance/definitions';

export interface PromoterAccount {
  id: string;
  bankName: string;
  last4: string;
  isDefault?: boolean;
  paymentType?: 'bank_account' | 'debit_card';
}

export function TransferConfirmationModal({
  available,
  pending,
  instantAvailable,
  payoutAccount,
  onClose,
  onSubmit,
  onAddPayoutMethod,
}: {
  available: number;
  pending: number;
  instantAvailable: number;
  payoutAccount: PromoterAccount | null;
  onClose: () => void;
  onSubmit: (amount: number, accountId: string) => Promise<void>;
  onAddPayoutMethod: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!payoutAccount) return;
    if (available < 100) {
      setError('Minimum transfer amount is ₹100.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSubmit(available, payoutAccount.id);
    } catch (err: any) {
      setError(err.message || 'Failed to process transfer.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={!submitting ? onClose : undefined}
      />
      <div
        className="relative w-full max-w-[540px] overflow-hidden rounded-[30px]"
        style={{
          background: 'linear-gradient(180deg, rgba(20,22,31,0.96) 0%, rgba(15,16,22,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 18% 0%, rgba(94,194,255,0.24) 0%, transparent 28%), radial-gradient(circle at 100% 0%, rgba(47,99,255,0.22) 0%, transparent 35%)',
          }}
        />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.24em]"
                style={{ color: 'rgba(255,255,255,0.42)' }}
              >
                Confirm Transfer
              </p>
              <h2 className="mt-2 text-[28px] font-black tracking-[-0.03em] text-white">
                Review wallet details
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div
            className="mt-6 overflow-hidden rounded-[26px] p-5"
            style={{
              background:
                'linear-gradient(145deg, rgba(94,194,255,0.34) 0%, rgba(47,99,255,0.3) 52%, rgba(21,50,184,0.28) 100%)',
              border: '1px solid rgba(255,255,255,0.16)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/14 text-white">
                <Wallet2 size={18} />
              </div>
              <span className="rounded-full border border-white/20 bg-black/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                Available
              </span>
            </div>
            <div className="mt-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/62">
                Ready to transfer
              </p>
              <div className="mt-2 text-[40px] font-black tracking-[-0.04em] text-white tabular-nums">
                {formatINR(available)}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div
              className="rounded-[22px] p-4"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#93c5fd' }}
                >
                  <Landmark size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] font-black uppercase tracking-[0.18em]"
                    style={{ color: 'rgba(255,255,255,0.42)' }}
                  >
                    Payout destination
                  </p>
                  {payoutAccount ? (
                    <>
                      <p className="mt-2 text-[16px] font-semibold text-white">
                        {payoutAccount.bankName}
                      </p>
                      <p className="mt-1 text-[13px]" style={{ color: 'rgba(255,255,255,0.56)' }}>
                        {payoutAccount.paymentType === 'debit_card' ? 'Debit Card' : 'Bank Account'}{' '}
                        ending in {payoutAccount.last4}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-[16px] font-semibold text-white">
                        No payout method connected
                      </p>
                      <p className="mt-1 text-[13px]" style={{ color: 'rgba(255,255,255,0.56)' }}>
                        Add a bank account or debit card before requesting a transfer.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-[20px] p-4"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <p
                  className="text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ color: 'rgba(255,255,255,0.42)' }}
                >
                  Pending
                </p>
                <p className="mt-2 text-[22px] font-bold tabular-nums text-white">
                  {formatINR(pending)}
                </p>
              </div>
              <div
                className="rounded-[20px] p-4"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <p
                  className="text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ color: 'rgba(255,255,255,0.42)' }}
                >
                  Instant
                </p>
                <p className="mt-2 text-[22px] font-bold tabular-nums text-white">
                  {formatINR(instantAvailable)}
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-3 rounded-[20px] p-4"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.16)',
              }}
            >
              <ShieldCheck size={18} style={{ color: '#86efac', flexShrink: 0, marginTop: 2 }} />
              <p className="text-[13px] leading-6" style={{ color: 'rgba(255,255,255,0.72)' }}>
                Once requested, payouts are processed to your linked destination and will reflect
                within 2-4 business days.
              </p>
            </div>

            {error && (
              <div className="rounded-[16px] bg-red-500/10 border border-red-500/20 p-4 mt-2">
                <p className="text-sm font-semibold text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {payoutAccount ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting || available < 100}
                className="flex h-13 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[15px] font-bold disabled:opacity-50"
                style={{
                  background: 'linear-gradient(145deg, #4aa7ff 0%, #2f63ff 58%, #1b3fe6 100%)',
                  border: '1px solid rgba(101,170,255,0.45)',
                  color: '#fff',
                  boxShadow: '0 16px 32px rgba(47,99,255,0.24)',
                }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Transfer'}
                {!submitting && <ArrowUpRight size={16} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={onAddPayoutMethod}
                disabled={submitting}
                className="flex h-13 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[15px] font-bold disabled:opacity-50"
                style={{
                  background: 'linear-gradient(145deg, #4aa7ff 0%, #2f63ff 58%, #1b3fe6 100%)',
                  border: '1px solid rgba(101,170,255,0.45)',
                  color: '#fff',
                  boxShadow: '0 16px 32px rgba(47,99,255,0.24)',
                }}
              >
                Add Payout Method
                <ArrowUpRight size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-13 items-center justify-center rounded-[18px] px-4 py-3 text-[15px] font-bold disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
