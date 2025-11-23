"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/providers/AuthProvider";

const initialForm = { email: "", password: "", name: "" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { user, loading, login, register, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const redirect = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);

  useEffect(() => {
    if (user && !loading) {
      router.replace(redirect);
    }
  }, [user, loading, router, redirect]);

  useEffect(() => {
    if (error) {
      setStatus({ type: "error", message: error });
    }
  }, [error]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setForm(initialForm);
    setStatus({ type: "", message: "" });
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
      router.replace(redirect);
    } catch (submitError) {
      setStatus({
        type: "error",
        message: submitError?.message || `Unable to ${mode === "login" ? "log in" : "create account"}`
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="px-4 pb-32 pt-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/40">Access</p>
          <h1 className="mt-3 text-4xl font-display uppercase tracking-[0.2em] sm:text-5xl">
            {mode === "login" ? "Login to Continue" : "Create Your Account"}
          </h1>
          <p className="mt-3 text-white/60">
            Use your email and password to access event creation, RSVPs, and personalized profiles.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="glass-panel mx-auto w-full max-w-lg rounded-[36px] border border-white/10 bg-black/60 p-8 text-left shadow-glow"
        >
          {status.message && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${status.type === "error" ? "border-red-500/30 text-red-200" : "border-emerald-500/30 text-emerald-200"
                }`}
            >
              {status.message}
            </div>
          )}
          {mode === "register" && (
            <label className="mb-5 flex flex-col gap-2 text-sm text-white/70">
              <span className="text-xs uppercase tracking-[0.4em] text-white/50">Your Name</span>
              <input
                type="text"
                value={form.name}
                onChange={handleChange("name")}
                className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                placeholder="Neha Sharma"
              />
            </label>
          )}
          <label className="mb-5 flex flex-col gap-2 text-sm text-white/70">
            <span className="text-xs uppercase tracking-[0.4em] text-white/50">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
              placeholder="crew@thec1rcle.com"
              required
            />
          </label>
          <label className="mb-2 flex flex-col gap-2 text-sm text-white/70">
            <span className="text-xs uppercase tracking-[0.4em] text-white/50">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={handleChange("password")}
              className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
              placeholder="Min 8 characters"
              minLength={6}
              required
            />
          </label>
          {mode === "login" && (
            <div className="mb-6 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-white/60 hover:text-white cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/40 text-white focus:ring-0 focus:ring-offset-0"
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-white px-4 py-3 text-xs uppercase tracking-[0.35em] text-black transition disabled:bg-white/40"
          >
            {submitting ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
          <button
            type="button"
            onClick={toggleMode}
            className="mt-4 w-full rounded-full border border-white/20 px-4 py-3 text-xs uppercase tracking-[0.35em] text-white/80 hover:text-white"
          >
            {mode === "login" ? "Need an account? Sign up" : "Have an account? Login"}
          </button>
          <p className="mt-6 text-center text-xs text-white/60">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>
    </section>
  );
}
