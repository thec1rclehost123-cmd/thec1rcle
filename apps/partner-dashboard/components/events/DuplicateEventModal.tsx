'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { randomUUID } from '@/lib/utils/uuid';

interface DuplicateEventModalProps {
  eventId: string;
  eventTitle: string;
  venueId: string;
  onClose: () => void;
}

export function DuplicateEventModal({
  eventId,
  eventTitle,
  venueId,
  onClose,
}: DuplicateEventModalProps) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [newDraftId, setNewDraftId] = useState<string | null>(null);

  const dupMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/duplicate?venueId=${venueId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: randomUUID() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Duplicate failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setNewDraftId(data?.draft?.id);
      setDone(true);
    },
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="relative z-10 w-full max-w-md rounded-2xl border border-border-default bg-surface-secondary dark:bg-[#111] p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
          >
            <X className="h-4 w-4" />
          </button>

          {!done ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                  <Copy className="h-5 w-5 text-text-secondary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Duplicate Event</h2>
                  <p className="text-sm text-text-tertiary truncate max-w-[260px]">{eventTitle}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border-default bg-surface-secondary p-4 mb-5 space-y-2">
                <p className="text-xs font-medium text-text-secondary">What gets copied</p>
                <ul className="space-y-1 text-xs text-text-tertiary">
                  <li>✓ Title (with "(Copy)" suffix), description, cover image</li>
                  <li>✓ Ticket tiers structure (counts reset to 0)</li>
                  <li>✓ Capacity, age policy, dress code</li>
                  <li>✓ Venue, host assignment</li>
                </ul>
                <p className="text-xs font-medium text-text-secondary mt-3">What resets</p>
                <ul className="space-y-1 text-xs text-text-tertiary">
                  <li>✗ Status → Draft</li>
                  <li>✗ Dates and times cleared</li>
                  <li>✗ Revenue, check-ins, sold tickets → 0</li>
                  <li>✗ Guestlist not copied</li>
                </ul>
              </div>

              {dupMut.isError && (
                <p className="mb-3 text-sm text-red-400">{(dupMut.error as Error).message}</p>
              )}

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-surface-tertiary text-text-primary border border-border-default hover:bg-surface-elevated"
                  onClick={() => dupMut.mutate()}
                  disabled={dupMut.isPending}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {dupMut.isPending ? 'Duplicating…' : 'Create Draft'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mx-auto mb-4">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-text-primary mb-1">Draft created</h2>
              <p className="text-sm text-text-tertiary mb-5">
                Your duplicate is saved as a draft. Set the date and publish when ready.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  Close
                </Button>
                <Button
                  className="flex-1 bg-surface-tertiary text-text-primary border border-border-default hover:bg-surface-elevated"
                  onClick={() => {
                    onClose();
                    if (newDraftId) {
                      router.push(`/venue/events/${newDraftId}`);
                    }
                  }}
                >
                  Open Draft <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
