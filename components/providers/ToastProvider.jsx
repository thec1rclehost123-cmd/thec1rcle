"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastContext = createContext({
    toast: (message, type = "default") => { },
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const toast = useCallback((message, type = "default") => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
                <AnimatePresence mode="popLayout">
                    {toasts.map((t) => (
                        <Toast key={t.id} message={t.message} type={t.type} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

function Toast({ message, type }) {
    const isError = type === "error";
    const isSuccess = type === "success";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`flex items-center gap-3 rounded-full border px-6 py-3 shadow-2xl backdrop-blur-xl ${isError
                    ? "border-red-500/20 bg-red-500/10 text-red-200"
                    : isSuccess
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-black/80 text-white"
                }`}
        >
            {isSuccess && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            )}
            {isError && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            )}
            <span className="text-xs font-bold uppercase tracking-widest">{message}</span>
        </motion.div>
    );
}
