'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../components/providers/AuthProvider';
import { sendTransferOTP, verifyAndInitiateTransfer } from './ticketApi';

const TransferModal = ({ isOpen, ticket, onClose, onSuccess }) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const otpRecipient =
    profile?.email || user?.email || ticket?.userEmail || ticket?.buyerEmail || '';

  const requestTransferOtp = async () => {
    if (!otpRecipient) {
      throw new Error(
        'We could not find your account email for verification. Refresh and sign in again.',
      );
    }
    return sendTransferOTP(otpRecipient);
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await requestTransferOtp();
      setResendTimer(60);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTransfer = async () => {
    if (
      !confirm(
        "Are you sure? This ticket will be locked until the recipient accepts or you cancel the transfer. You will not be able to use the QR while it's pending.",
      )
    )
      return;
    setLoading(true);
    setError(null);
    try {
      await requestTransferOtp();
      setShowVerification(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndTransfer = async () => {
    if (otpCode.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyAndInitiateTransfer(ticket.ticketId, email, otpCode, otpRecipient);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && ticket && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          style={{ zIndex: 10000 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10">
              <h2 className="text-3xl font-heading font-black uppercase text-black dark:text-white mb-2 tracking-tighter">
                Transfer Pass
              </h2>

              {showVerification ? (
                <div className="space-y-6">
                  <div className="text-center mt-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-iris/10 mb-4">
                      <Sparkles className="h-6 w-6 text-iris" />
                    </div>
                    <h3 className="text-xl font-heading font-black uppercase text-black dark:text-white mb-2">
                      Verify Identity
                    </h3>
                    <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] font-bold leading-relaxed px-4">
                      We've dispatched a security code to your email. Enter it to authorize the
                      transfer to <span className="text-iris">{email}</span>.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="0 0 0 0 0 0"
                      className="w-full px-5 py-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:border-iris/30 outline-none text-center text-2xl font-black tracking-[0.5em] text-black dark:text-white placeholder:text-black/5 dark:placeholder:text-white/5"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    />

                    {error && (
                      <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest text-center">
                        {error}
                      </p>
                    )}

                    <button
                      disabled={verifying || otpCode.length !== 6}
                      onClick={handleVerifyAndTransfer}
                      className="w-full py-5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {verifying ? 'Authorizing...' : 'Verify & Transfer'}
                    </button>

                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => setShowVerification(false)}
                        className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.2em]"
                      >
                        ← Back to Recipient
                      </button>

                      <button
                        onClick={handleResend}
                        disabled={resendTimer > 0}
                        className="text-[9px] font-black uppercase tracking-widest text-iris disabled:opacity-40"
                      >
                        {resendTimer > 0
                          ? `Resend code in ${resendTimer}s`
                          : 'Resend Security Code'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] leading-relaxed mb-8 font-bold">
                    Send this pass safely to a friend.
                  </p>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-[0.2em] ml-1">
                        Recipient Email
                      </p>
                      <input
                        type="email"
                        placeholder="Enter friend's email"
                        className="w-full px-5 py-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:border-orange/30 dark:focus:border-white/20 outline-none transition-all text-sm font-bold text-black dark:text-white placeholder:text-black/20 dark:placeholder:text-white/10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
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

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleTransfer}
                        disabled={!email || loading}
                        className="w-full py-5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {loading ? 'Processing...' : 'Confirm Transfer'}
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.4em] hover:text-black dark:hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export { TransferModal };
