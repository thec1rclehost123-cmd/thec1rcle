'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  STAFF: 'Employee',
  FINANCE_ADMIN: 'Finance',
  manager: 'Manager',
  security: 'Security',
  scanner: 'Scanner',
};

function StaffInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get('code') || '';
  const venueId = searchParams.get('venue') || '';

  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [inviteInfo, setInviteInfo] = useState<{
    name: string;
    email: string;
    role: string;
    venueName: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code || !venueId) {
      setErrorMsg('Invalid invite link. Please check your email for the correct link.');
      setStep('error');
      return;
    }

    // Fetch invite info to show the user what they're accepting
    fetch(`/api/partners/venues/staff/accept?code=${code}&venue=${venueId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setStep('error');
        } else {
          setInviteInfo(data);
          setStep('form');
        }
      })
      .catch(() => {
        setErrorMsg('Failed to load invite details. Please try again.');
        setStep('error');
      });
  }, [code, venueId]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/partners/venues/staff/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code, venueId, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to accept invite.');
        setSubmitting(false);
        return;
      }

      setStep('success');
      setTimeout(() => router.replace('/venue'), 2000);
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-600/20 border border-white/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-orange-500" />
          </div>
          <h1 className="text-[20px] font-black text-white tracking-tight">THE C1RCLE</h1>
        </div>

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            <p className="text-[13px] text-white/40">Loading invite...</p>
          </div>
        )}

        {step === 'error' && (
          <div
            className="rounded-2xl p-6 space-y-4 border border-red-500/20"
            style={{ background: 'rgba(239,68,68,0.05)' }}
          >
            <h2 className="text-[16px] font-bold text-white">Invite Error</h2>
            <p className="text-[13px] text-red-400">{errorMsg}</p>
            <p className="text-[12px] text-white/40">
              Contact your venue owner to get a new invite link.
            </p>
          </div>
        )}

        {step === 'form' && inviteInfo && (
          <div
            className="rounded-2xl p-6 space-y-5 border"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {/* Invite summary */}
            <div>
              <p className="text-[12px] text-white/40 uppercase tracking-widest font-bold mb-2">
                Invitation
              </p>
              <h2 className="text-[18px] font-black text-white leading-tight">
                Join {inviteInfo.venueName}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}
                >
                  {ROLE_LABELS[inviteInfo.role] || inviteInfo.role}
                </span>
                <span className="text-[12px] text-white/40">{inviteInfo.name}</span>
              </div>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Password form */}
            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-widest font-bold mb-1">
                  Email
                </p>
                <p className="text-[13px] text-white/70">{inviteInfo.email}</p>
              </div>

              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold mb-1.5 block">
                  SET YOUR PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min. 8 characters"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && <p className="text-[12px] text-red-400">{errorMsg}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-[14px] font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                style={{ background: 'linear-gradient(135deg, #f97316, #e11d48)', color: '#fff' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'success' && (
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-4 border"
            style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}
          >
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <h2 className="text-[18px] font-black text-white">You're in!</h2>
              <p className="text-[13px] text-white/50 mt-1">Redirecting to your dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      }
    >
      <StaffInviteContent />
    </Suspense>
  );
}
