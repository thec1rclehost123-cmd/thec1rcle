"use client";

import clsx from "clsx";

/**
 * Toggle Component — On/Off Switch
 */

export interface ToggleProps {
    label?: string;
    value?: boolean;
    checked?: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    size?: "sm" | "md";
    mode?: string;
}

export default function Toggle({
    label,
    value,
    checked,
    onChange,
    disabled = false,
    size = "md",
}: ToggleProps) {
    const isChecked = checked ?? value ?? false;
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
            aria-checked={isChecked}
            disabled={disabled}
            onClick={() => onChange(!isChecked)}
            className={clsx(
                "flex items-center gap-3",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <span
                className={clsx(
                    "relative inline-flex items-center rounded-full transition-colors duration-150",
                    s.track,
                    isChecked ? "bg-green-500" : "bg-surface-tertiary"
                )}
            >
                <span
                    className={clsx(
                        "absolute left-0.5 inline-block rounded-full bg-surface-elevated shadow-sm transition-transform duration-150",
                        s.knob,
                        isChecked && s.translate
                    )}
                />
            </span>
            {label && (
                <span className="text-[14px] text-text-secondary">{label}</span>
            )}
        </button>
    );
}
