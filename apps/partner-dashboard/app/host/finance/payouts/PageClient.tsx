"use client";

import { useState, useCallback, useEffect } from "react";
import {
    CheckCircle2, Banknote, ShieldCheck, Clock, ArrowLeft, Landmark,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { BankSetupForm, type BankSetupData } from "@/components/finance/BankSetupForm";
import { motion } from "framer-motion";

export default function HostPayoutsSettingsClient() {
    const { profile, user } = useDashboardAuth();
    const hostId = profile?.activeMembership?.partnerId as string | undefined;

    const [saved, setSaved] = useState(false);
    const [hasExisting, setHasExisting] = useState<"loading" | "yes" | "no">("loading");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!hostId) return;
        (async () => {
            try {
                const token = user ? await user.getIdToken() : "";
                const res = await fetch(`/api/host/finance/bank-accounts?hostId=${hostId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const data = await res.json();
                const accounts = data.accounts || data.data || [];
                setHasExisting(accounts.length > 0 ? "yes" : "no");
            } catch { setHasExisting("no"); }
        })();
    }, [hostId, user]);

    const handleBankSetup = useCallback(async (data: BankSetupData) => {
        if (!hostId) return;
        setSubmitting(true);
        setError("");
        try {
            const token = user ? await user.getIdToken() : "";
            const res = await fetch("/api/host/finance/bank-accounts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as any).error || "Failed to save bank account.");
            }
            setSaved(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }, [hostId, user]);

    if (!hostId) {
        return (
            <div className="mx-auto max-w-[960px] p-8">
                <div className="h-48 animate-pulse rounded-[28px]" style={{ background: "rgba(255,255,255,0.04)" }} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[960px] p-8">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-8">
                    <h1 className="text-[40px] font-bold tracking-tight" style={{ color: "rgba(255,255,255,0.96)" }}>
                        Payout Settings
                    </h1>
                    <p className="text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.42)" }}>
                        Set up and manage your payout bank account to receive earnings from your events.
                    </p>
                </div>

                {saved ? (
                    <div className="rounded-[28px] p-12 text-center" style={{ background: "#17171b", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(52,211,153,0.12)" }}>
                            <CheckCircle2 className="w-8 h-8" style={{ color: "#34D399" }} />
                        </div>
                        <h2 className="text-[24px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.96)" }}>
                            Bank Account Saved
                        </h2>
                        <p className="text-[14px] max-w-md mx-auto mb-8" style={{ color: "rgba(255,255,255,0.42)" }}>
                            Your payout bank account has been saved. Future payouts from events will be sent to this account.
                        </p>
                        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                            {[
                                { icon: ShieldCheck, label: "Encrypted", color: "#34D399" },
                                { icon: Clock, label: "T+1 Settlements", color: "#6EE7B7" },
                                { icon: Landmark, label: "RBI Compliant", color: "#34D399" },
                            ].map((t) => (
                                <div key={t.label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    <t.icon size={16} style={{ color: t.color }} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Trust + form card */}
                        {hasExisting === "loading" ? (
                            <div className="rounded-[28px] p-8" style={{ background: "#17171b", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div className="animate-pulse space-y-4">
                                    <div className="h-6 w-48 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                                    <div className="h-12 rounded-[18px]" style={{ background: "rgba(255,255,255,0.04)" }} />
                                    <div className="h-12 rounded-[18px]" style={{ background: "rgba(255,255,255,0.04)" }} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Setup card */}
                                <div className="rounded-[28px]" style={{ background: "#17171b", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    {/* Header */}
                                    <div className="p-8 pb-0">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                                                <Banknote className="w-6 h-6" style={{ color: "rgba(255,255,255,0.6)" }} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                                                    {hasExisting === "yes" ? "Update" : "Setup"} — Step 1 of 1
                                                </p>
                                                <p className="text-[16px] font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.9)" }}>
                                                    {hasExisting === "yes" ? "Update Bank Account" : "Add Payout Bank Account"}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-[13px] mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                                            {hasExisting === "yes"
                                                ? "Update your bank details. Changes apply to future payouts only."
                                                : "Enter your bank account details to start receiving payouts from your events. Your information is encrypted and securely stored."}
                                        </p>
                                    </div>

                                    {/* Form */}
                                    <div className="px-8 pb-8">
                                        <BankSetupForm
                                            onSubmit={handleBankSetup}
                                            submitting={submitting}
                                            error={error}
                                            submitLabel={hasExisting === "yes" ? "Update Bank Account" : "Save Bank Account"}
                                            getAuthToken={() => user!.getIdToken()}
                                        />
                                    </div>
                                </div>

                                {/* Trust signals */}
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { icon: ShieldCheck, label: "256-bit Encryption", desc: "Bank-grade security" },
                                        { icon: Clock, label: "Fast Payouts", desc: "T+1 business day" },
                                        { icon: Landmark, label: "Secure Rails", desc: "Razorpay-powered" },
                                    ].map((t) => (
                                        <div key={t.label} className="rounded-[20px] p-5 text-center" style={{ background: "#17171b", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <t.icon size={18} className="mx-auto mb-2" style={{ color: "#6EE7B7" }} />
                                            <p className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{t.label}</p>
                                            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{t.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </div>
    );
}
