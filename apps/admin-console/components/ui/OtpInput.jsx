
"use client";

import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

export default function OtpInput({ value, onChange, length = 6, disabled, onComplete }) {
    const [otp, setOtp] = useState(new Array(length).fill(""));
    const inputs = useRef([]);

    useEffect(() => {
        // Sync internal state with prop if needed (e.g. for reset)
        if (value === "") {
            setOtp(new Array(length).fill(""));
        }
    }, [value, length]);

    const handleChange = (e, index) => {
        const val = e.target.value.replace(/\D/g, "");
        if (!val) return;

        const newOtp = [...otp];
        newOtp[index] = val.substring(val.length - 1);
        setOtp(newOtp);
        const combined = newOtp.join("");
        onChange(combined);

        if (combined.length === length) {
            onComplete?.(combined);
        } else if (index < length - 1) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace") {
            if (!otp[index] && index > 0) {
                inputs.current[index - 1].focus();
            }
            const newOtp = [...otp];
            newOtp[index] = "";
            setOtp(newOtp);
            onChange(newOtp.join(""));
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const data = e.clipboardData.getData("text").replace(/\D/g, "").substring(0, length);
        if (!data) return;

        const newOtp = data.split("");
        setOtp([...newOtp, ...new Array(length - newOtp.length).fill("")]);
        onChange(data);

        if (data.length === length) {
            onComplete?.(data);
            inputs.current[length - 1].focus();
        } else {
            inputs.current[data.length].focus();
        }
    };

    return (
        <div className="flex justify-between gap-2 sm:gap-4" onPaste={handlePaste}>
            {otp.map((digit, i) => (
                <input
                    key={i}
                    ref={(el) => (inputs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    disabled={disabled}
                    value={digit}
                    onChange={(e) => handleChange(e, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    className={clsx(
                        "w-full aspect-square text-center bg-white/[0.03] border rounded-2xl text-xl md:text-2xl font-black transition-all focus:outline-none focus:ring-2 focus:ring-orange/50",
                        digit ? "border-orange/50 text-white" : "border-white/10 text-white/20",
                        disabled && "opacity-50"
                    )}
                />
            ))}
        </div>
    );
}
