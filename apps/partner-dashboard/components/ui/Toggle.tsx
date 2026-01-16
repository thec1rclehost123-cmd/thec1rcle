"use client";

import clsx from "clsx";

/**
 * Toggle Component — On/Off Switch
 */

export interface ToggleProps {
    label?: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    size?: "sm" | "md";
}

export default function Toggle({
    label,
    value,
    onChange,
    disabled = false,
    size = "md"
}: ToggleProps) {
    const sizeStyles = {
        sm: {
            track: "w-9 h-5",
            knob: "w-4 h-4",
            translate: "translate-x-4",
        },
        md: {
            track: "w-11 h-6",
            knob: "w-5 h-5",
            translate: "translate-x-5",
        },
    };

    const s = sizeStyles[size];

    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={clsx(
                "flex items-center gap-3",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <span
                className={clsx(
                    "relative inline-flex items-center rounded-full transition-colors duration-150",
                    s.track,
                    value ? "bg-emerald-500" : "bg-stone-200"
                )}
            >
                <span
                    className={clsx(
                        "absolute left-0.5 inline-block rounded-full bg-white shadow-sm transition-transform duration-150",
                        s.knob,
                        value && s.translate
                    )}
                />
            </span>
            {label && (
                <span className="text-[14px] text-stone-700">{label}</span>
            )}
        </button>
    );
}
