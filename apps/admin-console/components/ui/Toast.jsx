"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertCircle, Info } from "lucide-react";
import { useEffect } from "react";

const icons = {
    success: <Check className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
};

const variants = {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.2 } },
};

export default function Toast({ id, type = "info", message, duration = 4000, onRemove }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onRemove]);

    return (
        <motion.div
            layout
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="pointer-events-auto relative flex w-full max-w-sm items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl dark:bg-white/10"
        >
            {/* Progress Bar */}
            <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-1 ${type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-blue-500"
                    }`}
            />

            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10`}>
                {icons[type]}
            </div>

            <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                </h4>
                <p className="text-xs text-white/70">{message}</p>
            </div>

            <button
                onClick={() => onRemove(id)}
                className="group rounded-full p-1 hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4 text-white/50 group-hover:text-white" />
            </button>
        </motion.div>
    );
}
