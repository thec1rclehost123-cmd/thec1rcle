
"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";

export default function ResendTimer({ onResend, disabled, initialSeconds = 30 }) {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [resendCount, setResendCount] = useState(0);

    useEffect(() => {
        let timer;
        if (seconds > 0) {
            timer = setInterval(() => setSeconds(s => s - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [seconds]);

    const handleResend = () => {
        if (seconds > 0 || disabled) return;

        const newCount = resendCount + 1;
        setResendCount(newCount);

        // After 3 resends, require a longer cooldown
        const nextCooldown = newCount >= 3 ? 120 : 30;
        setSeconds(nextCooldown);
        onResend();
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                disabled={seconds > 0 || disabled}
                onClick={handleResend}
                className={clsx(
                    "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                    seconds > 0 || disabled ? "text-white/20 cursor-not-allowed" : "text-orange hover:opacity-80 active:scale-95"
                )}
            >
                <RefreshCw className={clsx("w-3 h-3", seconds > 0 && "opacity-20")} />
                {seconds > 0 ? `REAUTHORIZE IN ${seconds}S` : "REAUTHORIZE NOW"}
            </button>
            {resendCount >= 3 && seconds > 0 && (
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest text-center max-w-[200px]">
                    Multiple attempts detected. Please maintain composure while we recalibrate.
                </p>
            )}
        </div>
    );
}
