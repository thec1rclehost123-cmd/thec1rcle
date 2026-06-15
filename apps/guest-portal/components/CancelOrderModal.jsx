'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cancelGuestOrder, getOrderCancelEligibility } from '../features/orders/api/orderApi';

/**
 * CancelOrderModal — Guest-facing order cancellation with eligibility check.
 *
 * Shows refund info, confirmation step, and processes cancellation.
 */
export default function CancelOrderModal({ isOpen, onClose, order, onSuccess }) {
  const [step, setStep] = useState('check'); // check, confirm, processing, result
  const [eligibility, setEligibility] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch eligibility when modal opens
  useEffect(() => {
    if (isOpen && order?.orderId) {
      checkEligibility();
    } else {
      // Reset state when modal closes
      setStep('check');
      setEligibility(null);
      setReason('');
      setError(null);
      setResult(null);
    }
  }, [isOpen, order?.orderId]);

  const checkEligibility = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrderCancelEligibility(order.orderId);
      setEligibility(data);
      setStep(data.canCancel ? 'confirm' : 'check');
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setStep('processing');
    setError(null);
    try {
      const data = await cancelGuestOrder(order.orderId, reason);
      setResult(data);
      setStep('result');
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  const REASONS = [
    'Change of plans',
    'Found a better event',
    'Cannot attend anymore',
    'Incorrect booking',
    'Financial reasons',
    'Other',
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" />

        {/* Modal */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-md sm:rounded-[32px] rounded-t-[32px] bg-white dark:bg-zinc-900 overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-black/30 dark:text-white/30 mb-1">
                  Cancel Order
                </p>
                <h2 className="text-xl font-black text-black dark:text-white tracking-tight">
                  {order?.eventTitle || 'Order Cancellation'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-black/60 dark:text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-8">
            <AnimatePresence mode="wait">
              {/* ── Loading / Eligibility Check ── */}
              {step === 'check' && (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {loading ? (
                    <div className="flex flex-col items-center py-12 gap-4">
                      <div className="w-10 h-10 rounded-full border-[3px] border-black/10 dark:border-white/10 border-t-orange animate-spin" />
                      <p className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">
                        Checking eligibility...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-8 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                        <svg
                          className="w-8 h-8 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-black dark:text-white">{error}</p>
                      <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-full bg-black/5 dark:bg-white/5 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : eligibility && !eligibility.canCancel ? (
                    <div className="text-center py-8 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
                        <svg
                          className="w-8 h-8 text-amber-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-black dark:text-white">
                        Cancellation Not Available
                      </p>
                      <p className="text-xs text-black/50 dark:text-white/50 max-w-[280px] mx-auto">
                        {eligibility.reason}
                      </p>
                      <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-full bg-black/5 dark:bg-white/5 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              )}

              {/* ── Confirm Step ── */}
              {step === 'confirm' && eligibility && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Refund Info Card */}
                  <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <svg
                          className="w-3.5 h-3.5 text-emerald-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Refund Details
                      </p>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-black/50 dark:text-white/50">
                          {eligibility.refundPercentage === 100
                            ? 'Full refund'
                            : eligibility.refundPercentage > 0
                              ? `${eligibility.refundPercentage}% refund`
                              : 'No refund'}
                        </p>
                        <p className="text-2xl font-black text-black dark:text-white tracking-tight">
                          ₹{eligibility.refundAmount?.toLocaleString('en-IN') || '0'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30">
                          of ₹{eligibility.orderTotal?.toLocaleString('en-IN') || '0'}
                        </p>
                        <p className="text-[9px] font-bold text-black/30 dark:text-white/30 mt-1">
                          5-7 business days
                        </p>
                      </div>
                    </div>

                    {eligibility.refundPercentage < 100 && eligibility.refundPercentage > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        ⚡ A partial refund applies because the event is close to its start time.
                      </p>
                    )}
                    {eligibility.refundPercentage === 0 && (
                      <p className="text-[10px] text-red-500 font-medium">
                        This event has a no-refund policy. Your order will be cancelled but no
                        refund will be issued.
                      </p>
                    )}
                  </div>

                  {/* Reason Selection */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-black/30 dark:text-white/30 mb-3">
                      Reason for cancellation
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setReason(r)}
                          className={`px-3.5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                            reason === r
                              ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                              : 'bg-black/[0.03] dark:bg-white/[0.03] text-black/60 dark:text-white/60 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Error display */}
                  {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-600 font-medium">
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="flex-1 py-3.5 rounded-2xl bg-black/5 dark:bg-white/5 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      Keep Order
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={!reason}
                      className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
                    >
                      Cancel Order
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Processing Step ── */}
              {step === 'processing' && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center py-12 gap-6"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-[3px] border-black/5 dark:border-white/5 border-t-red-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-black dark:text-white">
                      Cancelling your order...
                    </p>
                    <p className="text-[10px] text-black/40 dark:text-white/40 mt-1 uppercase tracking-widest">
                      Processing refund
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Result Step ── */}
              {step === 'result' && result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8 space-y-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                    className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto"
                  >
                    <svg
                      className="w-10 h-10 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>

                  <div>
                    <h3 className="text-lg font-black text-black dark:text-white tracking-tight">
                      Order Cancelled
                    </h3>
                    <p className="text-xs text-black/50 dark:text-white/50 mt-2 max-w-[300px] mx-auto leading-relaxed">
                      {result.message}
                    </p>
                  </div>

                  {result.refund && result.refund.amount > 0 && (
                    <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-4 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-black/30 dark:text-white/30">
                        Refund
                      </p>
                      <p className="text-2xl font-black text-black dark:text-white">
                        ₹{result.refund.amount.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-black/40 dark:text-white/40">
                        Estimated: {result.refund.estimatedDays}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom safe area */}
          <div className="h-safe-area-b" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
