'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Loader2, AlertTriangle, UserPlus } from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import type { AddGuestBody } from '@/lib/types/guestOps';

const GUEST_TYPES: { value: AddGuestBody['guestType']; label: string; description: string }[] = [
  { value: 'venue_manual', label: 'Guest List', description: 'Standard venue manual add' },
  { value: 'venue_comp', label: 'Comp', description: 'Complimentary entry' },
  { value: 'venue_vip', label: 'VIP', description: 'VIP access' },
  { value: 'host_manual', label: 'Host Add', description: 'Added via host allocation' },
  { value: 'promoter_manual', label: 'Promo Add', description: 'Added via promoter allocation' },
  { value: 'table_booking', label: 'Table', description: 'Reserved table guest' },
];

interface AddGuestModalProps {
  eventId: string;
  venueId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddGuestModal({ eventId, venueId, onClose, onSuccess }: AddGuestModalProps) {
  const { getIdToken } = useDashboardAuth();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guestType, setGuestType] = useState<AddGuestBody['guestType']>('venue_manual');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autofocus name field on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const authHeaders = useCallback(
    async () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getIdToken()}`,
    }),
    [getIdToken],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      if (name.trim().length < 2) {
        setError('Name must be at least 2 characters');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const body: AddGuestBody = {
        name: name.trim(),
        guestType,
        notes: notes.trim() || undefined,
        quantity: quantity > 1 ? quantity : undefined,
      };
      if (phone.trim()) body.phone = phone.trim();

      try {
        const res = await fetch(
          `/api/partners/venues/guest-ops/${eventId}/guests?venueId=${venueId}`,
          {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify(body),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Failed to add guest (${res.status})`);
          return;
        }

        onSuccess();
      } catch {
        setError('Network error — please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, phone, guestType, notes, quantity, eventId, venueId, authHeaders, onSuccess],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="w-full max-w-md rounded-2xl border shadow-2xl"
          style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 border-b"
            style={{ borderColor: 'var(--v-border)' }}
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--v-orange)]/10 flex items-center justify-center">
              <UserPlus size={16} className="text-[var(--v-orange)]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--v-text-primary)] flex-1">
              Add Guest
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--v-elevated)] text-[var(--v-text-muted)]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--v-text-muted)] mb-1.5">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border bg-[var(--v-elevated)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)]"
                style={{ borderColor: 'var(--v-border)' }}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--v-text-muted)] mb-1.5">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border bg-[var(--v-elevated)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)]"
                style={{ borderColor: 'var(--v-border)' }}
              />
            </div>

            {/* Guest Type */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--v-text-muted)] mb-1.5">
                Guest Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {GUEST_TYPES.map((gt) => (
                  <button
                    key={gt.value}
                    type="button"
                    onClick={() => setGuestType(gt.value)}
                    className={cn(
                      'py-2 px-2 rounded-xl text-[12px] font-medium text-center transition-all border',
                      guestType === gt.value
                        ? 'bg-[var(--v-orange)] text-white border-[var(--v-orange)]'
                        : 'bg-[var(--v-elevated)] text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]',
                    )}
                    style={guestType !== gt.value ? { borderColor: 'var(--v-border)' } : {}}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity (for table bookings or multi-add) */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--v-text-muted)] mb-1.5">
                Quantity
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--v-elevated)] text-[var(--v-text-primary)] hover:bg-[var(--v-card-hover)] text-[16px] font-medium border"
                  style={{ borderColor: 'var(--v-border)' }}
                >
                  −
                </button>
                <span className="text-[15px] font-bold text-[var(--v-text-primary)] w-8 text-center tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--v-elevated)] text-[var(--v-text-primary)] hover:bg-[var(--v-card-hover)] text-[16px] font-medium border"
                  style={{ borderColor: 'var(--v-border)' }}
                >
                  +
                </button>
                {quantity > 1 && (
                  <span className="text-[12px] text-[var(--v-text-muted)] ml-1">guests</span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--v-text-muted)] mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Special instructions, table number, etc."
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border bg-[var(--v-elevated)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)] resize-none"
                style={{ borderColor: 'var(--v-border)' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[12px]">
                <AlertTriangle size={13} />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium border text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)] transition-all"
                style={{ borderColor: 'var(--v-border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--v-orange)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} />
                )}
                Add Guest
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
