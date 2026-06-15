'use client';

import { useState } from 'react';
import { X, Smartphone, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatINR } from '@/lib/utils/format';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import {
  validatePayoutAmount,
  validateUpiId,
  validateBankTransfer,
} from '@/lib/validation/paymentValidation';

interface PayoutRequestModalProps {
  availableBalance: number;
  promoterId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PayoutRequestModal({
  availableBalance,
  promoterId,
  onClose,
  onSuccess,
}: PayoutRequestModalProps) {
  const { getIdToken } = useDashboardAuth() as any;
  const [amount, setAmount] = useState(availableBalance);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const amountError = validatePayoutAmount(amount, availableBalance);
      if (amountError) throw new Error(amountError);

      if (paymentMethod === 'upi') {
        const upiError = validateUpiId(upiId);
        if (upiError) throw new Error(upiError);
      }

      if (paymentMethod === 'bank_transfer') {
        const bankError = validateBankTransfer(accountNumber, accountName, ifscCode);
        if (bankError) throw new Error(bankError);
      }

      const paymentDetails: Record<string, string> = {};
      if (paymentMethod === 'upi') {
        paymentDetails.upiId = upiId.trim();
      } else if (paymentMethod === 'bank_transfer') {
        paymentDetails.accountNumber = accountNumber.trim();
        paymentDetails.ifscCode = ifscCode.trim().toUpperCase();
        paymentDetails.accountName = accountName.trim();
      }

      const token = typeof getIdToken === 'function' ? await getIdToken() : '';

      const res = await fetch('/api/partners/promoters/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ promoterId, amount, paymentMethod, paymentDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request payout');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-[32px] bg-surface-elevated border border-border-default max-w-md w-full p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">
              Withdrawal
            </p>
            <h3 className="text-xl font-black text-text-primary">Request Payout</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-tertiary rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm font-bold">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.min(Number(e.target.value), availableBalance))}
                min={100}
                max={availableBalance}
                required
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-border-default bg-surface-secondary text-text-primary font-bold focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>
            <p className="text-[11px] text-text-placeholder mt-1.5">
              Available: {formatINR(availableBalance)} · Min: ₹100
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'upi', icon: Smartphone, label: 'UPI' },
                { id: 'bank_transfer', icon: Building2, label: 'Bank Transfer' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${
                    paymentMethod === id
                      ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                      : 'border-border-default hover:border-border-strong text-text-secondary'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-bold text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'upi' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">
                UPI ID
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="name@upi"
                required
                className="w-full px-4 py-3 rounded-2xl border border-border-default bg-surface-secondary text-text-primary font-medium focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>
          )}

          {paymentMethod === 'bank_transfer' && (
            <div className="space-y-3">
              {[
                {
                  label: 'Account Holder Name',
                  value: accountName,
                  setter: setAccountName,
                  placeholder: 'Full name',
                },
                {
                  label: 'Account Number',
                  value: accountNumber,
                  setter: setAccountNumber,
                  placeholder: '9+ digits',
                },
                {
                  label: 'IFSC Code',
                  value: ifscCode,
                  setter: (v: string) => setIfscCode(v.toUpperCase()),
                  placeholder: 'ABCD0123456',
                },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-border-default bg-surface-secondary text-text-primary font-medium focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border-default text-text-secondary font-bold rounded-2xl hover:bg-surface-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || amount < 100}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Submitting…' : `Request ${formatINR(amount)}`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
