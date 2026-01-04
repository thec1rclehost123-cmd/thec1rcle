"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, AlertCircle } from "lucide-react";

interface CartTimerProps {
    expiresAt: string;
    onExpired: () => void;
    className?: string;
}

export function CartTimer({ expiresAt, onExpired, className = "" }: CartTimerProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isExpired, setIsExpired] = useState(false);
    const [isWarning, setIsWarning] = useState(false);

    const calculateTimeLeft = useCallback(() => {
        const now = new Date().getTime();
        const expiry = new Date(expiresAt).getTime();
        const diff = Math.max(0, Math.floor((expiry - now) / 1000));
        return diff;
    }, [expiresAt]);

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            // Warning when under 2 minutes
            if (remaining <= 120 && remaining > 0) {
                setIsWarning(true);
            }

            // Expired
            if (remaining <= 0) {
                setIsExpired(true);
                clearInterval(timer);
                onExpired();
            }
        }, 1000);

        // Initialize immediately
        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, [expiresAt, calculateTimeLeft, onExpired]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isExpired) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-3 p-4 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 ${className}`}
            >
                <AlertCircle className="w-5 h-5 text-[#ff3b30]" />
                <div>
                    <p className="text-[14px] font-semibold text-[#ff3b30]">
                        Session Expired
                    </p>
                    <p className="text-[12px] text-[#ff3b30]/80">
                        Please select your tickets again
                    </p>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${isWarning
                    ? "bg-[#ff9500]/10 border border-[#ff9500]/20"
                    : "bg-[#007aff]/5 border border-[#007aff]/10"
                } ${className}`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWarning ? "bg-[#ff9500]/20" : "bg-[#007aff]/10"
                }`}>
                <Clock className={`w-5 h-5 ${isWarning ? "text-[#ff9500]" : "text-[#007aff]"}`} />
            </div>

            <div className="flex-1">
                <p className={`text-[12px] font-medium ${isWarning ? "text-[#ff9500]" : "text-[#86868b]"
                    }`}>
                    {isWarning ? "Hurry! Time is running out" : "Complete your purchase in"}
                </p>
                <p className={`text-[24px] font-bold tracking-tight ${isWarning ? "text-[#ff9500]" : "text-[#1d1d1f]"
                    }`}>
                    {formatTime(timeLeft)}
                </p>
            </div>

            {/* Animated progress ring */}
            <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90">
                    <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className={isWarning ? "text-[#ff9500]/20" : "text-[#007aff]/20"}
                    />
                    <motion.circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        className={isWarning ? "text-[#ff9500]" : "text-[#007aff]"}
                        initial={{ pathLength: 1 }}
                        animate={{ pathLength: timeLeft / 600 }} // Assuming 10 min = 600 sec
                        transition={{ duration: 1, ease: "linear" }}
                        style={{
                            strokeDasharray: "125.66",
                            strokeDashoffset: 0
                        }}
                    />
                </svg>
            </div>
        </motion.div>
    );
}

export default CartTimer;
