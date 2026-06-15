'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  createPartnerClaimLink,
  assignPartnerByEmail,
  transferCoupleTicket,
  findUserByEmail,
} from './ticketApi';

const PartnerModal = ({ ticket, onClose, onSuccess, onChanged }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [claimUrl, setClaimUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');

  const handleCreateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await createPartnerClaimLink(ticket.ticketId, ticket.eventId);
      const url = `${window.location.origin}/tickets/pair/${token}`;
      setClaimUrl(url);
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDirectly = async () => {
    setLoading(true);
    setError(null);
    try {
      await assignPartnerByEmail(ticket.ticketId, email, {
        eventId: ticket.eventId,
        ticketType: ticket.ticketType,
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (
      !confirm(
        'Are you sure? This will transfer full ownership of this couple ticket (including both slots) to the new owner. You will lose access immediately.',
      )
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const newUser = await findUserByEmail(email);
      if (!newUser) throw new Error('User not found');
      await transferCoupleTicket(ticket.ticketId, newUser.uid);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none" />

        <div className="relative z-10">
          <h2 className="text-3xl font-heading font-black uppercase text-black dark:text-white mb-2 tracking-tighter">
            Assign Partner
          </h2>
          <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] leading-relaxed mb-8 font-bold">
            Couple entries require a pair assignment to reveal the QR.{' '}
            <span className="text-orange">
              Note: Both guests must arrive together at the venue.
            </span>
          </p>

          {claimUrl ? (
            <div className="space-y-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange to-gold rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative p-6 rounded-2xl bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 backdrop-blur-xl">
                  <p className="text-[10px] font-black text-orange dark:text-gold uppercase tracking-[0.2em] mb-4">
                    Partner Claim Link
                  </p>
                  <p className="text-sm font-bold text-black dark:text-white break-all mb-6 selection:bg-orange/30 font-mono leading-relaxed opacity-90">
                    {claimUrl}
                  </p>
                  <button
                    onClick={handleCopy}
                    className={clsx(
                      'w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all active:scale-[0.98]',
                      copied
                        ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                        : 'bg-black dark:bg-white text-white dark:text-black hover:shadow-xl dark:hover:shadow-white/5 shadow-black/10',
                    )}
                  >
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-center text-black/40 dark:text-white/40 uppercase tracking-[0.2em] font-medium leading-loose">
                Send this link to your partner.
                <br />
                <span className="text-black/30 dark:text-white/20 text-[9px]">
                  They must log in to complete the pairing.
                </span>
              </p>
              <button
                onClick={onSuccess}
                className="w-full py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-black uppercase text-[11px] tracking-[0.3em] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                <button
                  onClick={handleCreateLink}
                  disabled={loading}
                  className="w-full group relative overflow-hidden py-5 rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-2xl disabled:opacity-50 transition-transform active:scale-95"
                >
                  <span className="relative z-10">
                    {loading ? 'Generating...' : 'Generate Link'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange/20 to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-black/[0.08] dark:border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px]">
                    <span className="px-4 bg-white dark:bg-zinc-900 text-black/20 dark:text-white/20 font-black tracking-[0.5em]">
                      OR
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-[0.2em] ml-1">
                      Direct Assignment
                    </p>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="Enter partner's email"
                        className="w-full px-5 py-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:border-orange/30 dark:focus:border-white/20 outline-none transition-all text-sm font-bold text-black dark:text-white placeholder:text-black/20 dark:placeholder:text-white/10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={handleAssignDirectly}
                      disabled={!email || loading}
                      className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? 'Processing...' : 'Confirm Assignment'}
                    </button>

                    <button
                      onClick={handleTransfer}
                      disabled={!email || loading}
                      className="group/transfer relative flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-red-500/5 hover:border-red-500/20 transition-all"
                    >
                      <span className="text-red-500/30 group-hover/transfer:text-red-500 font-bold uppercase text-[9px] tracking-[0.4em] transition-all">
                        Transfer Full Ownership
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div
                  className={clsx(
                    'p-4 rounded-2xl flex items-center gap-3 border',
                    error.toLowerCase().includes('restricted') ||
                      error.toLowerCase().includes('gender')
                      ? 'bg-orange/5 border-orange/20'
                      : 'bg-red-500/5 border-red-500/10',
                  )}
                >
                  <svg
                    className={clsx(
                      'w-4 h-4 flex-shrink-0',
                      error.toLowerCase().includes('restricted') ||
                        error.toLowerCase().includes('gender')
                        ? 'text-orange'
                        : 'text-red-500',
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p
                    className={clsx(
                      'text-[9px] font-black uppercase tracking-widest',
                      error.toLowerCase().includes('restricted') ||
                        error.toLowerCase().includes('gender')
                        ? 'text-orange'
                        : 'text-red-500',
                    )}
                  >
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.4em] hover:text-black dark:hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export { PartnerModal };
