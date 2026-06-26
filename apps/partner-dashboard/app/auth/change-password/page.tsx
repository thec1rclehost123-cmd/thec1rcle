'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

function ChangePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useDashboardAuth();

  const status = searchParams.get('status') || '';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check if temporary password is saved in session storage
    if (typeof window !== 'undefined') {
      const savedTemp = sessionStorage.getItem('tempPassword');
      if (savedTemp) {
        setCurrentPassword(savedTemp);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update password. Verify your temporary password.');
        setSubmitting(false);
        return;
      }

      // Clear the temporary password from session storage on success
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tempPassword');
      }

      setSuccess(true);
      setTimeout(async () => {
        // Sign out to invalidate client session
        await signOut().catch(() => {});
        // Redirect directly to the login page
        router.replace('/login');
      }, 1500);
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
    padding: '12px 40px 12px 16px',
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

        {success ? (
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-4 border"
            style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}
          >
            <CheckCircle className="w-12 h-12 text-green-500 animate-bounce" />
            <div className="text-center">
              <h2 className="text-[18px] font-black text-white">Password updated successfully</h2>
              <p className="text-[13px] text-white/50 mt-1">Redirecting to login...</p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 space-y-5 border"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div>
              <h2 className="text-[18px] font-black text-white leading-tight">
                {status === 'accepted' ? 'Invitation already accepted' : 'Set a New Password'}
              </h2>
              <p className="text-[13px] text-white/40 mt-1">
                {status === 'accepted'
                  ? 'Your invitation has already been accepted. You can still set/change your password below.'
                  : 'You must update your temporary password before accessing the dashboard.'}
              </p>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold mb-1.5 block">
                  Temporary / Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter temporary password"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold mb-1.5 block">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min. 8 characters"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold mb-1.5 block">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Repeat new password"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && <p className="text-[12px] text-red-400">{errorMsg}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-[14px] font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #f97316, #e11d48)', color: '#fff' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      }
    >
      <ChangePasswordContent />
    </Suspense>
  );
}
