'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Lock, PencilLine, X } from 'lucide-react';

interface EditLinkModalProps {
  link: any;
  token?: string;
  onClose: () => void;
  onSaved: (link: any) => void;
}

function sanitizeEditableSlug(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export default function EditLinkModal({ link, token, onClose, onSaved }: EditLinkModalProps) {
  const [editableSlug, setEditableSlug] = useState(link?.vanitySlug || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefix = useMemo(() => {
    const fullUrl = String(link?.fullUrl || '');
    const alias = String(link?.vanityAlias || '');
    if (fullUrl && alias && fullUrl.endsWith(alias)) {
      return fullUrl.slice(0, -alias.length) + String(link?.vanityPrefix || '');
    }
    return fullUrl;
  }, [link]);

  const normalizedEditable = sanitizeEditableSlug(editableSlug);
  const canSave =
    normalizedEditable.length > 0 && normalizedEditable !== String(link?.vanitySlug || '');
  const previewUrl = `${prefix}${normalizedEditable || 'campaign-name'}`;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/partners/promoters/links/${link.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'update_alias',
          editableSlug: normalizedEditable,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.link) {
        throw new Error(payload?.error || 'Failed to update link');
      }
      onSaved(payload.link);
      setSaved(true);
      window.setTimeout(() => onClose(), 500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#1b1b20_0%,#151519_100%)] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[28px] font-black tracking-[-0.04em] text-white">Edit Link</h3>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-zinc-400">
              Change only the shareable ending. The locked prefix stays fixed so attribution and
              uniqueness never break.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            <Lock className="h-3.5 w-3.5" />
            URL Builder
          </div>

          <div className="rounded-[22px] border border-white/10 bg-[#111115] p-2.5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
              <div className="min-w-0 rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3.5 lg:flex-[1.45]">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  <Lock className="h-3 w-3" />
                  Locked Prefix
                </div>
                <div className="truncate font-mono text-[13px] text-zinc-500">{prefix}</div>
              </div>

              <div className="min-w-0 rounded-[18px] border border-[rgba(244,74,34,0.22)] bg-[rgba(244,74,34,0.08)] px-4 py-3 lg:flex-1">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#fb8b6b]">
                  <PencilLine className="h-3 w-3" />
                  Editable Ending
                </div>
                <input
                  type="text"
                  value={editableSlug}
                  onChange={(event) => setEditableSlug(event.target.value)}
                  placeholder="campaign-name"
                  className="w-full bg-transparent font-mono text-[18px] font-semibold text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_280px]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              Final Share URL
            </div>
            <div className="break-all rounded-[18px] bg-black/25 px-4 py-4 font-mono text-[14px] leading-7 text-white">
              {previewUrl}
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Promoters can personalize the ending, but the fixed prefix remains attached to their
              account.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              Rules
            </div>
            <div className="space-y-2 text-sm leading-6 text-zinc-400">
              <p>Only letters, numbers, and hyphens are kept.</p>
              <p>The locked prefix prevents collisions across promoters.</p>
              <p>The tracking `ref` logic stays intact underneath.</p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        {saved ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Link updated
            </span>
          </div>
        ) : null}

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-2xl bg-[var(--c1rcle-orange,#F44A22)] px-6 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(244,74,34,0.28)] transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
