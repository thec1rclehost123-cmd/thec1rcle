'use client';

import { useState, useRef } from 'react';
import { User, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { PromoterIdentity } from '@/lib/server/promoterSettingsStore';

const CITIES = [
  'Mumbai',
  'Pune',
  'Bengaluru',
  'Delhi',
  'Hyderabad',
  'Chennai',
  'Goa',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Other',
];

interface Props {
  identity: PromoterIdentity | null;
  promoterId: string;
  userEmail: string;
  token: string;
  onUpdated: (identity: PromoterIdentity) => void;
}

export function IdentityPanel({ identity, promoterId, userEmail, token, onUpdated }: Props) {
  const [form, setForm] = useState({
    legalName: identity?.legalName ?? '',
    brandName: identity?.brandName ?? '',
    phone: identity?.phone ?? '',
    city: identity?.city ?? '',
    logoUrl: identity?.logoUrl ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('promoterId', promoterId);
      fd.append('type', 'logo');
      const res = await fetch('/api/partners/promoters/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.url) setForm((f) => ({ ...f, logoUrl: data.url }));
    } catch {
      setError('Logo upload failed. Try again.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/partners/promoters/settings/identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promoterId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      onUpdated(data.identity);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-2xl bg-surface-tertiary border border-border-default overflow-hidden flex items-center justify-center shrink-0">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-text-tertiary" />
          )}
          {logoUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={logoUploading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-tertiary border border-border-default text-xs font-semibold text-text-secondary hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {logoUploading ? 'Uploading…' : 'Upload Logo'}
          </button>
          <p className="text-[11px] text-text-tertiary mt-1">PNG, JPG — max 5 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoUpload(f);
            }}
          />
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Legal Name"
          value={form.legalName}
          onChange={(v) => setForm((f) => ({ ...f, legalName: v }))}
          placeholder="Full legal name"
        />
        <Field
          label="Brand Name"
          value={form.brandName}
          onChange={(v) => setForm((f) => ({ ...f, brandName: v }))}
          placeholder="Public promoter name"
        />
        <Field label="Contact Email" value={userEmail} readOnly placeholder="" />
        <Field
          label="Phone"
          value={form.phone}
          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          placeholder="+91 98765 43210"
          type="tel"
        />
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">
            Primary City
          </label>
          <select
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-default text-sm text-text-primary focus:outline-none focus:border-violet-500/50"
          >
            <option value="">Select city…</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

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
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Identity'}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-xl border text-sm text-text-primary focus:outline-none focus:border-violet-500/50 transition-colors ${
          readOnly
            ? 'bg-surface-secondary border-border-subtle text-text-tertiary cursor-default'
            : 'bg-surface-secondary border-border-default'
        }`}
      />
    </div>
  );
}
