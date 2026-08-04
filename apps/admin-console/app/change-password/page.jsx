'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

function ChangePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();

  const isAcceptedStatus = searchParams.get('status') === 'accepted';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(
          data.error || 'Failed to update password. Please check your temporary credentials.',
        );
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(async () => {
        if (logout) {
          await logout();
        }
        router.replace('/login?reset=success');
      }, 1500);
    } catch (err) {
      console.error(err);
      setErrorMsg('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const inputStyle =
    'w-full bg-black/40 border border-white/[0.08] rounded-2xl pl-6 pr-12 py-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-iris/50 focus:ring-1 focus:ring-iris/20 transition-all font-medium text-base shadow-inner';

  return (
    <div className="min-h-screen bg-obsidian-base flex items-center justify-center p-6 selection:bg-iris/30 overflow-hidden relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-iris/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-50" />
      </div>

      <div className="w-full max-w-[440px] relative z-10 space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-obsidian-surface border border-white/5 flex items-center justify-center mb-6">
            <Shield className="h-8 w-8 text-iris" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">THE C1RCLE</h1>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600 mt-2">
            Secure Clearance Node
          </span>
        </div>

        <div className="bg-obsidian-surface/60 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-floating relative overflow-hidden">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center animate-in fade-in">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-bounce">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Passcode Updated</h2>
                <p className="text-xs text-zinc-400">Directing to security login window...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                  First-Time Access Verification
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isAcceptedStatus ? 'Access Key Initialized' : 'Establish New Password'}
                </h2>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  To complete authorization, you must update the temporary password provided by
                  email.
                </p>
              </div>

              <div className="h-px bg-white/[0.05]" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">
                    Temporary/Current Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter temporary password"
                      className={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">
                    New Secure Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      className={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">
                    Confirm New Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Repeat secure passcode"
                      className={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20">
                  <AlertCircle className="h-5 w-5 text-iris shrink-0 mt-0.5" />
                  <p className="text-xs text-iris/80 font-bold leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-white/5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating Passcode...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-obsidian-base flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-iris animate-spin" />
        </div>
      }
    >
      <ChangePasswordContent />
    </Suspense>
  );
}
