"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Lock, Shield, ArrowRight, AlertCircle, Terminal } from "lucide-react";

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
            // HARD RULE 4: No "Remember me" passed to login
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
        <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-indigo-500/30">
            {/* Background Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-900/20 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-50" />
            </div>

            <div className="w-full max-w-[440px] relative z-10">
                {/* Brand Identity */}
                <div className="flex flex-col items-center mb-12">
                    <div className="h-20 w-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] mb-8 group transition-transform duration-700 hover:rotate-[360deg]">
                        <Shield className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter italic leading-none mb-4">c1rcle</h1>
                    <div className="flex items-center gap-3">
                        <div className="h-1px w-8 bg-white/10" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Admin Command Center</span>
                        <div className="h-1px w-8 bg-white/10" />
                    </div>
                </div>

                {/* Login Terminal Card */}
                <div className="bg-zinc-900/50 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative group">
                    {/* Top Status Bar */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <form onSubmit={handleLogin} className="space-y-8" autoComplete="off">
                        <div className="space-y-6">
                            {/* Email Field */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-4 flex items-center gap-2">
                                    <Terminal className="h-3 w-3" />
                                    Identifier
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="off"
                                    placeholder="admin-node@c1rcle.com"
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-white placeholder:text-white/10 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium text-base shadow-inner"
                                />
                            </div>

                            {/* Password Field */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-4 flex items-center gap-2">
                                    <Lock className="h-3 w-3" />
                                    Security Key
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="off"
                                    placeholder="••••••••••••"
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-white placeholder:text-white/10 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium text-base shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Error Messaging */}
                        {status === "error" && (
                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-100/80 font-bold leading-relaxed">{errorMessage}</p>
                            </div>
                        )}

                        {/* Submit Action */}
                        <button
                            type="submit"
                            disabled={status === "authenticating"}
                            className="w-full relative group/btn h-16 rounded-[1.5rem] bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {status === "authenticating" ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        Verifying Authority...
                                    </>
                                ) : (
                                    <>
                                        Authorize Access
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="mt-10 pt-8 border-t border-white/5">
                        <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-white/20">
                            <Shield className="h-3 w-3" />
                            End-to-End Cryptographic Session
                        </div>
                    </div>
                </div>

                {/* Security Notice */}
                <p className="mt-8 text-center text-[10px] font-medium text-white/20 leading-relaxed max-w-xs mx-auto">
                    Restricted Access Area. Every login attempt and session activity is logged under the <span className="text-white/40">Audit Protocol</span>.
                </p>
            </div>
        </div>
    );
}
