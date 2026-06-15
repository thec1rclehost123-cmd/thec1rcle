'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Lock, Clock } from 'lucide-react';
import type { PromoterPayoutAccount } from '@/lib/server/promoterSettingsStore';

interface Props {
  payout: PromoterPayoutAccount | null;
  promoterId: string;
  token: string;
  onUpdated: (payout: PromoterPayoutAccount) => void;
}

export function PayoutConfig({ payout, promoterId, token, onUpdated }: Props) {
  const [form, setForm] = useState({
    bankName: payout?.bankName ?? '',
    accountNumber: payout?.accountNumber ?? '',
    ifsc: payout?.ifsc ?? '',
    upiId: payout?.upiId ?? '',
    threshold: payout?.threshold ?? 500,
  });
  const [originalAccountNumber] = useState(payout?.accountNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [holdUntil, setHoldUntil] = useState<string | null>(payout?.holdUntil ?? null);
  const [showReAuth, setShowReAuth] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthLoading, setReAuthLoading] = useState(false);

  const accountNumberChanged =
    form.accountNumber !== originalAccountNumber && originalAccountNumber !== '';

  const doSave = async (reAuthToken?: string) => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/partners/promoters/settings/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promoterId,
          ...form,
          accountNumberChanged,
          ...(reAuthToken ? { reAuthToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      onUpdated(data.payout);
      setHoldUntil(data.holdUntil ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (accountNumberChanged) {
      setShowReAuth(true);
    } else {
      doSave();
    }
  };

  const handleReAuth = async () => {
    setReAuthLoading(true);
    setError('');
    try {
      // Re-authenticate client-side and get a fresh token
      const { getFirebaseAuth } = await import('@/lib/firebase/client');
      const auth = await getFirebaseAuth();
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      if (!auth.currentUser || !auth.currentUser.email) {
        setError('No authenticated user found.');
        return;
      }
      const credential = EmailAuthProvider.credential(auth.currentUser.email, reAuthPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      const freshToken = await auth.currentUser.getIdToken(true);
      setShowReAuth(false);
      setReAuthPassword('');
      await doSave(freshToken);
    } catch (e: any) {
      setError(
        e.code === 'auth/wrong-password' ? 'Incorrect password.' : 'Re-authentication failed.',
      );
    } finally {
      setReAuthLoading(false);
    }
  };

  const isOnHold = holdUntil && new Date(holdUntil) > new Date();

  return (
    <div className="space-y-5">
      {/* Hold banner */}
      {isOnHold && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Payout on hold</p>
            <p className="text-[11px] text-amber-400/70 mt-0.5">
              Payouts are paused until {new Date(holdUntil!).toLocaleString('en-IN')} following your
              account number change.
            </p>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Bank Name"
          value={form.bankName}
          onChange={(v) => setForm((f) => ({ ...f, bankName: v }))}
          placeholder="e.g. HDFC Bank"
        />
        <Field
          label="Account Number"
          value={form.accountNumber}
          onChange={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
          placeholder="Enter account number"
          sensitive
        />
        <Field
          label="IFSC Code"
          value={form.ifsc}
          onChange={(v) => setForm((f) => ({ ...f, ifsc: v.toUpperCase() }))}
          placeholder="HDFC0001234"
        />
        <Field
          label="UPI ID"
          value={form.upiId}
          onChange={(v) => setForm((f) => ({ ...f, upiId: v }))}
          placeholder="you@upi"
        />
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">
            Payout Threshold (₹)
          </label>
          <input
            type="number"
            min={100}
            value={form.threshold}
            onChange={(e) => setForm((f) => ({ ...f, threshold: parseInt(e.target.value) || 500 }))}
            className="w-32 px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-default text-sm text-text-primary focus:outline-none focus:border-violet-500/50"
          />
          <p className="text-[11px] text-text-tertiary mt-1">
            Payouts will only process above this amount.
          </p>
        </div>
      </div>

      {accountNumberChanged && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <Lock className="w-3.5 h-3.5" />
          Changing your account number requires re-authentication and triggers a 24-hour hold.
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
        ) : null}
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Payout Info'}
      </button>

      {/* Re-auth modal */}
      {showReAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-elevated border border-border-default rounded-[2rem] p-8 w-full max-w-sm mx-4 space-y-5">
            <div>
              <h3 className="text-base font-bold text-text-primary">Confirm Your Identity</h3>
              <p className="text-xs text-text-tertiary mt-1">
                Enter your password to authorize this account number change.
              </p>
            </div>
            <input
              type="password"
              value={reAuthPassword}
              onChange={(e) => setReAuthPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReAuth()}
              placeholder="Current password"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-default text-sm text-text-primary focus:outline-none focus:border-violet-500/50"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReAuth(false);
                  setReAuthPassword('');
                  setError('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-surface-tertiary text-sm font-semibold text-text-secondary hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReAuth}
                disabled={reAuthLoading || !reAuthPassword}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              >
                {reAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  sensitive = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  sensitive?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={sensitive && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-default text-sm text-text-primary focus:outline-none focus:border-violet-500/50 transition-colors pr-12"
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary hover:text-text-secondary"
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  );
}
