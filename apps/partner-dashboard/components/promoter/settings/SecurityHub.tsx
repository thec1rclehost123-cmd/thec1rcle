"use client";

import { useState } from "react";
import { Shield, Smartphone, LogOut, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { sendOperationalPasswordResetEmail, getPasswordResetErrorMessage } from "@/lib/auth/passwordReset";
import type { SecurityPrefs } from "@/lib/server/promoterSettingsStore";

interface Props {
    security: SecurityPrefs;
    userEmail: string;
    token: string;
    promoterId: string;
    onSecurityUpdated: (s: SecurityPrefs) => void;
    onLoggedOut: () => void;
}

export function SecurityHub({
    security,
    userEmail,
    token,
    promoterId,
    onSecurityUpdated,
    onLoggedOut,
}: Props) {
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [twoFaLoading, setTwoFaLoading] = useState(false);
    const [show2FaModal, setShow2FaModal] = useState(false);
    const [error, setError] = useState("");

    const handlePasswordReset = async () => {
        setResetLoading(true);
        setError("");
        try {
            const { getFirebaseAuth } = await import("@/lib/firebase/client");
            const auth = await getFirebaseAuth();
            await sendOperationalPasswordResetEmail(auth, userEmail);
            setResetSent(true);
        } catch (error) {
            setError(getPasswordResetErrorMessage(error));
        } finally {
            setResetLoading(false);
        }
    };

    const handleToggle2FA = async (enable: boolean) => {
        if (enable) {
            setShow2FaModal(true);
            return;
        }
        setTwoFaLoading(true);
        try {
            const res = await fetch("/api/promoter/settings/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ promoterId, security: { twoFaEnabled: false, twoFaFlaggedAt: null } }),
            });
            const data = await res.json();
            if (data.preferences?.security) onSecurityUpdated(data.preferences.security);
        } catch {
            setError("Failed to update 2FA setting.");
        } finally {
            setTwoFaLoading(false);
        }
    };

    const handleFlag2FA = async () => {
        setTwoFaLoading(true);
        try {
            const now = new Date().toISOString();
            const res = await fetch("/api/promoter/settings/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    promoterId,
                    security: { twoFaEnabled: true, twoFaFlaggedAt: now },
                }),
            });
            const data = await res.json();
            if (data.preferences?.security) onSecurityUpdated(data.preferences.security);
            setShow2FaModal(false);
        } catch {
            setError("Failed to enable 2FA.");
        } finally {
            setTwoFaLoading(false);
        }
    };

    const handleLogoutAll = async () => {
        if (!confirm("This will sign you out from all other devices. Continue?")) return;
        setLogoutLoading(true);
        setError("");
        try {
            await fetch("/api/promoter/settings/security/logout-all", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            onLoggedOut();
        } catch {
            setError("Failed to revoke sessions.");
        } finally {
            setLogoutLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                </p>
            )}

            {/* Password Reset */}
            <SecurityRow
                icon={<KeyRound className="w-4 h-4" />}
                title="Password"
                description="Send a reset link to your email address"
            >
                <button
                    onClick={handlePasswordReset}
                    disabled={resetLoading || resetSent}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-white/70 hover:bg-white/[0.10] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                    {resetLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : resetSent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : null}
                    {resetSent ? "Email sent!" : resetLoading ? "Sending…" : "Send Reset Link"}
                </button>
            </SecurityRow>

            {/* 2FA */}
            <SecurityRow
                icon={<Smartphone className="w-4 h-4" />}
                title="Two-Factor Authentication"
                description={
                    security.twoFaEnabled
                        ? "2FA is flagged — support will complete your enrollment"
                        : "Add an extra layer of protection to your account"
                }
            >
                <Toggle
                    checked={security.twoFaEnabled}
                    onChange={handleToggle2FA}
                    disabled={twoFaLoading}
                />
            </SecurityRow>

            {/* Active sessions */}
            <SecurityRow
                icon={<Shield className="w-4 h-4" />}
                title="Active Sessions"
                description="Current session only — revoke all other tokens"
            >
                <button
                    onClick={handleLogoutAll}
                    disabled={logoutLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                    {logoutLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                    Logout All Devices
                </button>
            </SecurityRow>

            {/* 2FA info modal */}
            {show2FaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f14] border border-white/10 rounded-[2rem] p-8 w-full max-w-sm mx-4 space-y-5">
                        <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Enable Two-Factor Auth</h3>
                            <p className="text-xs text-white/40 mt-2 leading-relaxed">
                                Full TOTP enrollment is coming soon. By confirming, your account will be
                                flagged for 2FA setup and our support team will reach out to complete
                                the configuration.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShow2FaModal(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/60 hover:bg-white/[0.10] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFlag2FA}
                                disabled={twoFaLoading}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                            >
                                {twoFaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Request 2FA Setup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SecurityRow({
    icon,
    title,
    description,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-4 border-b border-white/[0.06] last:border-0">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 text-white/40">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/80">{title}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">{description}</p>
                </div>
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function Toggle({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={() => onChange(!checked)}
            disabled={disabled}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${
                checked ? "bg-violet-600" : "bg-white/[0.12]"
            }`}
        >
            <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    checked ? "translate-x-5" : "translate-x-0.5"
                }`}
            />
        </button>
    );
}
