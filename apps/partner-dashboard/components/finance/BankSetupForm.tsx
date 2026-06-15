'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Loader2, ArrowRight, Upload, X, AlertCircle } from 'lucide-react';

// ── Sanitization ────────────────────────────────────────────────────────────────
const STRIP_TAGS = /<[^>]*>/g;
const DIGITS_ONLY = /[^\d]/g;

function sanitizeText(raw: string): string {
  return raw.replace(STRIP_TAGS, '').trim().slice(0, 200);
}

function sanitizeAccountNumber(raw: string): string {
  return raw.replace(DIGITS_ONLY, '').slice(0, 20);
}

function sanitizeIfsc(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 11);
}

// ── Props & Types ───────────────────────────────────────────────────────────────

interface BankSetupFormProps {
  onSubmit: (data: BankSetupData) => Promise<void>;
  submitting: boolean;
  error?: string;
  submitLabel?: string;
  getAuthToken?: () => Promise<string>;
}

export interface BankSetupData {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
  accountType: 'savings' | 'current';
  chequeDocUrl: string;
}

const inputBg = 'rgba(255,255,255,0.03)';
const inputBorder = '1px solid rgba(255,255,255,0.08)';
const textPrimary = 'rgba(255,255,255,0.96)';
const textMuted = 'rgba(255,255,255,0.46)';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function BankSetupForm({
  onSubmit,
  submitting,
  error: externalError,
  submitLabel = 'Save & Continue',
  getAuthToken,
}: BankSetupFormProps) {
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmNumber, setConfirmNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accountType, setAccountType] = useState('');
  const [chequeDoc, setChequeDoc] = useState<string | null>(null);
  const [internalError, setInternalError] = useState('');

  const error = externalError || internalError;

  const lookupIfsc = useCallback(async () => {
    if (ifsc.length !== 11) return;
    try {
      const res = await fetch(
        `https://ifsc.razorpay.com/${encodeURIComponent(ifsc.toUpperCase())}`,
      );
      if (res.ok) {
        const data = await res.json();
        setBankName(sanitizeText(data.BANK || ''));
        setBranch(sanitizeText(data.BRANCH || ''));
      }
    } catch {
      /* silent */
    }
  }, [ifsc]);

  useEffect(() => {
    if (ifsc.length === 11) lookupIfsc();
  }, [ifsc, lookupIfsc]);

  const numbersMismatch = confirmNumber.length > 0 && accountNumber !== confirmNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInternalError('');

    const cleanName = sanitizeText(accountHolder);
    const cleanAcct = sanitizeAccountNumber(accountNumber);
    const cleanConfirm = sanitizeAccountNumber(confirmNumber);
    const cleanIfsc = sanitizeIfsc(ifsc);
    const cleanBankName = sanitizeText(bankName);
    const cleanBranch = sanitizeText(branch);

    if (!cleanName || !cleanAcct || !cleanIfsc || !accountType || !chequeDoc) {
      setInternalError('Please fill all required fields.');
      return;
    }
    if (cleanAcct !== cleanConfirm) {
      setInternalError("Account numbers don't match.");
      return;
    }
    if (cleanAcct.length < 9) {
      setInternalError('Account number must be at least 9 digits.');
      return;
    }
    if (!IFSC_REGEX.test(cleanIfsc)) {
      setInternalError('Invalid IFSC code format. Expected 11 characters (e.g., SBIN0001234).');
      return;
    }

    await onSubmit({
      accountHolderName: cleanName,
      accountNumber: cleanAcct,
      ifscCode: cleanIfsc,
      bankName: cleanBankName,
      branch: cleanBranch,
      accountType: accountType as 'savings' | 'current',
      chequeDocUrl: chequeDoc,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
    >
      {error && (
        <div
          className="flex items-center gap-2 rounded-[18px] px-4 py-3 text-[13px]"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5' }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <Field label="Account Holder Name">
        <Input
          placeholder="Exactly as on passbook"
          value={accountHolder}
          onChange={(v) => setAccountHolder(sanitizeText(v))}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Account Number">
          <Input
            type="password"
            placeholder="Enter account number"
            value={accountNumber}
            onChange={(v) => setAccountNumber(sanitizeAccountNumber(v))}
          />
        </Field>
        <Field
          label="Confirm Account Number"
          error={numbersMismatch ? "Account numbers don't match" : undefined}
        >
          <input
            type="text"
            value={confirmNumber}
            onChange={(e) => setConfirmNumber(sanitizeAccountNumber(e.target.value))}
            placeholder="Re-enter account number"
            className="w-full rounded-[18px] px-5 py-4 text-[14px] outline-none transition-all"
            style={{
              background: inputBg,
              border: numbersMismatch ? '1px solid rgba(239,68,68,0.4)' : inputBorder,
              color: textPrimary,
            }}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="IFSC Code">
          <Input
            placeholder="SBIN0001234"
            value={ifsc}
            onChange={(v) => setIfsc(sanitizeIfsc(v))}
          />
        </Field>
        <Field label="Account Type">
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="w-full rounded-[18px] px-5 py-4 text-[14px] outline-none appearance-none"
            style={{
              background: inputBg,
              border: inputBorder,
              color: accountType ? textPrimary : textMuted,
            }}
          >
            <option value="" disabled>
              Select type…
            </option>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </select>
        </Field>
      </div>

      {bankName && (
        <div
          className="flex items-center gap-2 rounded-[18px] px-4 py-3"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
        >
          <CheckCircle2 size={14} style={{ color: '#34D399' }} />
          <span className="text-[13px] font-medium" style={{ color: '#6ee7b7' }}>
            {bankName} — {branch}
          </span>
        </div>
      )}

      <Field label="Cancelled Cheque or Passbook Front">
        <ChequeUpload value={chequeDoc} onChange={setChequeDoc} getAuthToken={getAuthToken} />
      </Field>

      <button
        type="submit"
        disabled={
          submitting ||
          !accountHolder ||
          !accountNumber ||
          accountNumber !== confirmNumber ||
          !ifsc ||
          !accountType ||
          !chequeDoc
        }
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] py-4 text-[15px] font-bold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'rgba(255,255,255,0.92)', color: '#050505' }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-2"
        style={{ color: textMuted }}
      >
        {label}
      </p>
      {children}
      {error && (
        <p className="text-[11px] mt-1.5" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[18px] px-5 py-4 text-[14px] outline-none transition-all"
      style={{ background: inputBg, border: inputBorder, color: textPrimary }}
    />
  );
}

function ChequeUpload({
  value,
  onChange,
  getAuthToken,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  getAuthToken?: () => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploadError('');
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File must be under 5MB.');
      return;
    }

    let token = '';
    if (getAuthToken) {
      token = await getAuthToken();
    }

    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('stepId', 'bank_setup');
      form.append('fieldName', 'cheque_doc');

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers,
        body: form,
      });

      setProgress(100);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error?.message || (data as any).error || 'Upload failed.');
      }

      const { url } = await res.json();
      onChange(url);
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div
        className="flex items-center gap-3 rounded-[18px] px-5 py-4"
        style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
      >
        <CheckCircle2 size={16} style={{ color: '#34D399' }} />
        <span className="text-[13px] font-medium flex-1" style={{ color: '#6ee7b7' }}>
          Cheque uploaded
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setUploadError('');
          }}
          className="p-1 rounded-lg hover:bg-red-500/20 transition-colors"
          style={{ color: textMuted }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (uploading) {
    return (
      <div
        className="rounded-[18px] px-5 py-4"
        style={{ background: inputBg, border: inputBorder }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={14} className="animate-spin" style={{ color: textMuted }} />
          <span className="text-[12px]" style={{ color: textMuted }}>
            Uploading… {progress}%
          </span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: 'rgba(255,255,255,0.5)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-[18px] px-5 py-6 text-center transition-all group"
        style={{ background: inputBg, border: inputBorder }}
      >
        <Upload size={20} className="mx-auto mb-2" style={{ color: textMuted }} />
        <p className="text-[12px]" style={{ color: textMuted }}>
          Click to upload · JPG, PNG or PDF · Max 5MB
        </p>
      </button>
      {uploadError && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#fca5a5' }}>
          <AlertCircle size={11} /> {uploadError}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
