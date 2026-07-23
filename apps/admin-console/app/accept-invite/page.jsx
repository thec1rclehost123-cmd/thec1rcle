'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const ROLE_LABELS = {
  super: 'Super Admin',
  ops: 'Operations',
  finance: 'Finance',
  support: 'Support',
  content: 'Content',
  readonly: 'Read Only',
};

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get('code') || '';

  const [step, setStep] = useState('loading'); // loading, form, success, error
  const [inviteInfo, setInviteInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState(true);

  useEffect(() => {
    if (!code) {
      setErrorMsg('Invalid invite link. Please check your email for the correct link.');
      setStep('error');
      return;
    }

    // Fetch invite info
    fetch(`/api/auth/accept-invite?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setStep('error');
        } else if (data.status === 'accepted' || data.status === 'active') {
          // If already accepted, redirect directly to change password
          router.replace('/change-password');
        } else {
          setInviteInfo(data);
          setStep('form');
        }
      })
      .catch(() => {
        setErrorMsg('Failed to load invitation details. Please try again.');
        setStep('error');
      });
  }, [code, router]);

  const handleAccept = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to accept invitation.');
        setSubmitting(false);
        return;
      }

      // The password (temp, for a new account, or their existing one) was
      // delivered by email, not by this response -- sign in on the login
      // page rather than attempting a silent login here.
      setIsNewAccount(Boolean(data.isNewAccount));
      setStep('success');
      setTimeout(() => {
        router.replace('/login');
      }, 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

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
            Authority Console Invitation
          </span>
        </div>

        {/* Card container */}
        <div className="bg-obsidian-surface/60 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-floating relative overflow-hidden">
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-8 h-8 text-iris animate-spin" />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                Verifying Token...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Invitation Error</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">{errorMsg}</p>
              </div>
              <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider pt-4 border-t border-white/[0.05]">
                Contact your Super Admin for assistance.
              </p>
            </div>
          )}

          {step === 'form' && inviteInfo && (
            <form onSubmit={handleAccept} className="space-y-6">
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                  Clearance Invite
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Join Administrative Staff
                </h2>
                <div className="flex items-center gap-2.5 mt-3">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-iris/10 border border-iris/20 text-iris">
                    {ROLE_LABELS[inviteInfo.role] || inviteInfo.role}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">{inviteInfo.name}</span>
                </div>
              </div>

              <div className="h-px bg-white/[0.05]" />

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Security ID (Email)
                  </label>
                  <p className="text-sm font-semibold text-white">{inviteInfo.email}</p>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Invite Reference Token
                  </label>
                  <p className="text-[10px] font-mono text-zinc-500 break-all">{code}</p>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 font-bold text-center bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-white/5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-bounce">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Invitation Accepted</h2>
                <p className="text-xs text-zinc-400">
                  {isNewAccount
                    ? 'Check your email for your temporary password, then sign in.'
                    : 'Sign in with your existing password.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-obsidian-base flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-iris animate-spin" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
