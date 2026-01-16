"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Lock, Shield, ArrowRight, AlertCircle, Terminal, Activity } from "lucide-react";

export default function AdminLogin() {
    const { login, user, profile, loading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState("idle"); // idle, authenticating, success, error
    const [errorMessage, setErrorMessage] = useState("");

    // Redirect if already logged in and verified
    useEffect(() => {
        if (!loading && user && (profile?.role === 'admin' || profile?.admin_role)) {
            router.replace("/");
        }
    }, [user, profile, loading, router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setStatus("authenticating");
        setErrorMessage("");

        try {
            await login(email, password);
            setStatus("success");
            router.push("/");
        } catch (err) {
            console.error("Login failed", err);
            setStatus("error");
            setErrorMessage(err.message === "UNAUTHORIZED_ACCESS_BLOCKED"
                ? "Security Protocol: Access denied for standard user credentials."
                : "Authentication Failure: Credentials could not be verified by Authority Node.");
        }
    };

    return (
        <div className="min-h-screen bg-obsidian-base flex items-center justify-center p-6 selection:bg-iris/30 overflow-hidden relative">
            {/* Background Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-iris/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-50" />
            </div>

            <div className="w-full max-w-[440px] relative z-10">
                {/* Brand Identity */}
                <div className="flex flex-col items-center mb-12">
                    <div className="h-20 w-20 rounded-[2rem] bg-obsidian-surface border border-white/5 flex items-center justify-center shadow-elevate mb-8 group transition-all duration-700 hover:scale-110">
                        <Shield className="h-10 w-10 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-5xl font-bold text-white tracking-tighter mb-4 flex items-center gap-3">
                        Circle
                        <div className="h-2 w-2 rounded-full bg-iris animate-pulse mt-3" />
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="h-[1px] w-8 bg-white/10" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-600">Administrative Node</span>
                        <div className="h-[1px] w-8 bg-white/10" />
                    </div>
                </div>

                {/* Login Terminal Card */}
                <div className="bg-obsidian-surface/60 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-10 shadow-floating overflow-hidden relative group">
                    {/* Top Status Bar */}
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-iris/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                        <div className="space-y-6">
                            {/* Email Field */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-4 flex items-center gap-2">
                                    <Terminal className="h-3 w-3" />
                                    Security ID
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="off"
                                    placeholder="admin@c1rcle.com"
                                    className="w-full bg-black/40 border border-[#ffffff08] rounded-2xl px-6 py-5 text-white placeholder:text-zinc-800 focus:outline-none focus:border-iris/50 focus:ring-1 focus:ring-iris/20 transition-all font-medium text-base shadow-inner"
                                />
                            </div>

                            {/* Password Field */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-4 flex items-center gap-2">
                                    <Lock className="h-3 w-3" />
                                    Access Token
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="off"
                                    placeholder="••••••••••••"
                                    className="w-full bg-black/40 border border-[#ffffff08] rounded-2xl px-6 py-5 text-white placeholder:text-zinc-800 focus:outline-none focus:border-iris/50 focus:ring-1 focus:ring-iris/20 transition-all font-medium text-base shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Error Messaging */}
                        {status === "error" && (
                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-iris/10 border border-iris/20 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 text-iris shrink-0 mt-0.5" />
                                <p className="text-xs text-iris/80 font-bold leading-relaxed">{errorMessage}</p>
                            </div>
                        )}

                        {/* Submit Action */}
                        <button
                            type="submit"
                            disabled={status === "authenticating"}
                            className="w-full h-16 rounded-[1.5rem] bg-white text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] overflow-hidden shadow-lg shadow-white/5"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {status === "authenticating" ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        Establish Connection
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="mt-10 pt-8 border-t border-[#ffffff05]">
                        <div className="flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                            <Activity className="h-3 w-3 text-emerald-500" />
                            Secure Encrypted Link Active
                        </div>
                    </div>
                </div>

                {/* Security Notice */}
                <p className="mt-8 text-center text-[10px] font-bold text-zinc-700 leading-relaxed max-w-[280px] mx-auto uppercase tracking-[0.1em]">
                    Restricted Terminal. Unauthorized access attempts trigger immediate <span className="text-zinc-500">Security Protocols</span>.
                </p>
            </div>
        </div>
    );
}

