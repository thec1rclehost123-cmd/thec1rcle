"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Chrome, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import PageShell from "../../components/PageShell";

const initialForm = { email: "", password: "", name: "" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { user, loading, login, register, loginWithGoogle, error: authError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState(initialForm);
  const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const redirectUrl = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);

  useEffect(() => {
    if (user && !loading) {
      router.replace(`/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`);
    }
  }, [user, loading, router, redirectUrl]);

  useEffect(() => {
    if (authError) {
      setStatus({ type: "error", message: authError });
    }
  }, [authError]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setForm(initialForm);
    setStatus({ type: "", message: "" });
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      await loginWithGoogle();
      router.replace(`/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`);
    } catch (err) {
      setStatus({ type: "error", message: err.message });
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      if (mode === "login") {
        await login(form.email, form.password, rememberMe);
      } else {
        if (!form.name.trim()) {
          throw new Error("Add your name so we can personalize your profile.");
        }
        await register(form.email, form.password, form.name.trim());
      }
      router.replace(`/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`);
    } catch (submitError) {
      setStatus({
        type: "error",
        message: submitError?.message || `Unable to ${mode === "login" ? "log in" : "create account"}`
      });
      setSubmitting(false);
    }
  };

  return (
    <PageShell title={mode === "login" ? "Access" : "Join"} showLogo={true} backHref="/explore">
      <div className="max-w-md mx-auto pt-10 pb-32">
        {/* Headline Refinement: Increased breathing space & softened subtext */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="space-y-4 mb-8">
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-black/50 dark:text-white/40">
              Invitation
            </p>
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-[-0.04em] leading-[0.9] text-black/95 dark:text-white/95">
              {mode === "login" ? (
                <>Login to <br /><span className="text-orange">Continue.</span></>
              ) : (
                <>Join the <br /><span className="text-orange">Circle.</span></>
              )}
            </h1>
          </div>
          <p className="text-[11px] font-medium text-black/30 dark:text-white/20 tracking-widest max-w-[260px] mx-auto uppercase">
            Access exclusive events & profile.
          </p>
        </motion.div>

        {/* Card Presence: Enhanced blur and edge definition */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel p-10 sm:p-12 rounded-[48px] border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-[40px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] space-y-10 relative overflow-hidden"
        >
          {/* Subtle Inner Edge Highlight */}
          <div className="absolute inset-0 rounded-[48px] border border-white/5 pointer-events-none" />

          <form onSubmit={handleSubmit} className="space-y-8">
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="full-name"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/50 ml-1 font-black">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange("name")}
                    placeholder="ALEXANDER PIERCE"
                    className="w-full bg-transparent border-b border-black/10 dark:border-white/10 pb-3 focus:border-orange/50 focus:outline-none transition-colors text-sm font-medium tracking-wide placeholder:text-black/10 dark:placeholder:text-white/5"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/50 ml-1 font-black">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={handleChange("email")}
                placeholder="VALET@THECIRCLE.COM"
                className="w-full bg-transparent border-b border-black/10 dark:border-white/10 pb-3 focus:border-orange/50 focus:outline-none transition-colors text-sm font-medium tracking-wide placeholder:text-black/10 dark:placeholder:text-white/5"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/50 ml-1 font-black">Password</label>
                {mode === "login" && (
                  <Link href="/forgot-password" core-link="true" className="text-[11px] uppercase tracking-[0.2em] text-orange/80 hover:text-orange font-black transition-colors">
                    Forgot?
                  </Link>
                )}
              </div>
              <input
                type="password"
                required
                value={form.password}
                onChange={handleChange("password")}
                placeholder="••••••••"
                className="w-full bg-transparent border-b border-black/10 dark:border-white/10 pb-3 focus:border-orange/50 focus:outline-none transition-colors text-sm font-medium tracking-wide"
              />
            </div>

            {status.message && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-center font-bold uppercase tracking-widest text-orange/80 pt-2"
              >
                {status.message}
              </motion.div>
            )}

            <div className="pt-4">
              {/* CTA: Added subtle glow halo and slight hover lift */}
              <button
                type="submit"
                disabled={submitting}
                className="group relative w-full h-16 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.4em] transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 active:scale-95 disabled:opacity-50 overflow-hidden shadow-xl hover:shadow-[0_0_30px_rgba(244,74,34,0.15)]"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enter the Circle"}
              </button>
            </div>
          </form>

          {/* Social Login - Secondary */}
          <div className="space-y-6 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/[0.05] dark:border-white/[0.05]" /></div>
              <span className="relative bg-transparent px-4 text-[10px] font-black uppercase tracking-[0.4em] text-black/30 dark:text-white/30">Valet Access</span>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full flex items-center justify-center py-2 text-[12px] font-black uppercase tracking-[0.3em] text-black/60 dark:text-white/60 hover:text-orange transition-colors active:scale-95 disabled:opacity-50"
            >
              Continue with Google
            </button>
          </div>
        </motion.div>

        <div className="mt-12 text-center space-y-12">
          <button
            onClick={toggleMode}
            className="text-[10px] font-black uppercase tracking-[0.4em] text-black/20 dark:text-white/20 hover:text-orange transition-colors"
          >
            {mode === "login" ? "Need an identity? Register" : "Already a member? Sign in"}
          </button>

          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-black/10 dark:text-white/10 leading-relaxed max-w-[240px] mx-auto">
            By entering, you agree to our <br />
            <Link href="/terms" className="hover:text-orange transition-colors">Terms</Link> & <Link href="/privacy" className="hover:text-orange transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
