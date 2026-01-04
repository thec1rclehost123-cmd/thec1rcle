
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Smartphone, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import OtpInput from "./ui/OtpInput";
import ResendTimer from "./ui/ResendTimer";
import clsx from "clsx";

export default function VerifyPanel({ email, phone, onVerify, onResend, onEdit, loading, error }) {
    const [emailOtp, setEmailOtp] = useState("");
    const [phoneOtp, setPhoneOtp] = useState("");
    const [emailVerified, setEmailVerified] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [verifyingPhone, setVerifyingPhone] = useState(false);
    const [localError, setLocalError] = useState("");

    const handleVerifyEmail = async (code) => {
        setVerifyingEmail(true);
        setLocalError("");
        try {
            const success = await onVerify("email", code);
            if (success) setEmailVerified(true);
        } catch (err) {
            setLocalError(err.message || "Email verification failed.");
        } finally {
            setVerifyingEmail(false);
        }
    };

    const handleVerifyPhone = async (code) => {
        setVerifyingPhone(true);
        setLocalError("");
        try {
            const success = await onVerify("phone", code);
            if (success) setPhoneVerified(true);
        } catch (err) {
            setLocalError(err.message || "Phone verification failed.");
        } finally {
            setVerifyingPhone(false);
        }
    };

    const allVerified = emailVerified && phoneVerified;

    return (
        <div className="space-y-6 w-full max-w-[500px]">
            <div className="flex justify-between items-center px-2">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Dual-Factor Ritual</p>
                <button
                    onClick={onEdit}
                    className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                    Edit Details
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Email Verification Card */}
                <VerificationCard
                    title="Electronic Mail"
                    identifier={email}
                    icon={<Mail className="w-5 h-5" />}
                    verified={emailVerified}
                    loading={verifyingEmail}
                    value={emailOtp}
                    onChange={setEmailOtp}
                    onComplete={handleVerifyEmail}
                    onResend={() => onResend("email")}
                />

                {/* Phone Verification Card */}
                <VerificationCard
                    title="Mobile Network"
                    identifier={phone}
                    icon={<Smartphone className="w-5 h-5" />}
                    verified={phoneVerified}
                    loading={verifyingPhone}
                    value={phoneOtp}
                    onChange={setPhoneOtp}
                    onComplete={handleVerifyPhone}
                    onResend={() => onResend("phone")}
                    delay={0.1}
                />
            </div>

            {localError && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 p-4 bg-orange/10 border border-orange/20 rounded-2xl"
                >
                    <AlertCircle className="w-4 h-4 text-orange" />
                    <p className="text-[10px] font-bold text-orange uppercase tracking-widest">{localError}</p>
                </motion.div>
            )}

            <button
                disabled={!allVerified || loading}
                onClick={() => onVerify("final")}
                className={clsx(
                    "group relative w-full h-16 flex items-center justify-center rounded-full bg-white text-black font-black uppercase tracking-[0.5em] text-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden shadow-[0_20px_40px_rgba(255,165,0,0.15)]",
                    allVerified ? "bg-white" : "bg-white/5 text-white/20 border border-white/10"
                )}
            >
                {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <span className="relative z-10">
                        {allVerified ? "Finalize Ritual" : "Awaiting Verification"}
                    </span>
                )}
            </button>
        </div>
    );
}

function VerificationCard({ title, identifier, icon, verified, loading, value, onChange, onComplete, onResend, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
                "relative overflow-hidden glass-panel rounded-[32px] p-6 border transition-all duration-500",
                verified ? "bg-orange/[0.02] border-orange/30" : "bg-white/[0.03] border-white/10"
            )}
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    <div className={clsx(
                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500",
                        verified ? "bg-orange text-white" : "bg-white/5 text-white/40"
                    )}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">{title}</p>
                        <p className="text-xs font-bold text-white tracking-widest truncate max-w-[180px]">{identifier}</p>
                    </div>
                </div>
                <AnimatePresence mode="wait">
                    {verified ? (
                        <motion.div
                            key="verified"
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="bg-orange/20 p-2 rounded-full"
                        >
                            <CheckCircle className="w-5 h-5 text-orange" />
                        </motion.div>
                    ) : (
                        loading && (
                            <motion.div key="loading">
                                <Loader2 className="w-5 h-5 text-orange animate-spin" />
                            </motion.div>
                        )
                    )}
                </AnimatePresence>
            </div>

            <div className="space-y-6">
                <OtpInput
                    value={value}
                    onChange={onChange}
                    disabled={verified || loading}
                    onComplete={onComplete}
                />
                {!verified && (
                    <ResendTimer onResend={onResend} disabled={loading} />
                )}
            </div>
        </motion.div>
    );
}
