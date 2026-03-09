"use client";

import { X, Check, AlertCircle, Info } from "lucide-react";
import { useEffect, useCallback, useState } from "react";

const icons = {
    success: <Check className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
};

export default function Toast({ id, type = "info", message, duration = 4000, onRemove }) {
    const [exiting, setExiting] = useState(false);

    const startExit = useCallback(() => {
        setExiting(true);
    }, []);

    useEffect(() => {
        const timer = setTimeout(startExit, duration);
        return () => clearTimeout(timer);
    }, [id, duration, startExit]);

    const handleAnimationEnd = useCallback((e) => {
        // Only remove from DOM after the exit animation completes
        if (e.animationName === "toastOut") {
            onRemove(id);
        }
    }, [id, onRemove]);

    return (
        <div
            className={`pointer-events-auto relative flex w-full max-w-sm items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl dark:bg-white/10 ${exiting ? "toast-exit" : "toast-enter"}`}
            onAnimationEnd={handleAnimationEnd}
        >
            {/* Progress Bar — duration driven by CSS animation */}
            <div
                className={`toast-progress absolute bottom-0 left-0 h-1 ${type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-blue-500"}`}
                style={{ animationDuration: `${duration}ms` }}
            />

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                {icons[type]}
            </div>

            <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                </h4>
                <p className="text-xs text-white/70">{message}</p>
            </div>

            <button
                onClick={startExit}
                className="group rounded-full p-1 hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4 text-white/50 group-hover:text-white" />
            </button>
        </div>
    );
}
