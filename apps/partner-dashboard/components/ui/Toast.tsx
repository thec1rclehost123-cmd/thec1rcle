"use client";

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import clsx from "clsx";

/**
 * Toast Notification System
 * Premium toast notifications with C1RCLE design language
 */

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
}

const ToastContext = createContext < ToastContextValue | null > (null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

interface ToastProviderProps {
    children: ReactNode;
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

export function ToastProvider({ children, position = "bottom-right" }: ToastProviderProps) {
    const [toasts, setToasts] = useState < Toast[] > ([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { ...toast, id };
        setToasts((prev) => [...prev, newToast]);

        // Auto dismiss
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = useCallback((title: string, description?: string) => {
        addToast({ type: "success", title, description });
    }, [addToast]);

    const error = useCallback((title: string, description?: string) => {
        addToast({ type: "error", title, description });
    }, [addToast]);

    const warning = useCallback((title: string, description?: string) => {
        addToast({ type: "warning", title, description });
    }, [addToast]);

    const info = useCallback((title: string, description?: string) => {
        addToast({ type: "info", title, description });
    }, [addToast]);

    const positionClasses = {
        "top-right": "top-4 right-4",
        "top-left": "top-4 left-4",
        "bottom-right": "bottom-4 right-4",
        "bottom-left": "bottom-4 left-4",
        "top-center": "top-4 left-1/2 -translate-x-1/2",
        "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
    };

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <div className={clsx("fixed z-[200] flex flex-col gap-3", positionClasses[position])}>
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

// Individual Toast Component
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const icons = {
        success: CheckCircle2,
        error: AlertCircle,
        warning: AlertTriangle,
        info: Info,
    };

    const Icon = icons[toast.type];

    const typeStyles = {
        success: "border-l-[var(--state-success)] bg-[var(--state-success-bg)]/50",
        error: "border-l-[var(--state-error)] bg-[var(--state-error-bg)]/50",
        warning: "border-l-[var(--state-warning)] bg-[var(--state-warning-bg)]/50",
        info: "border-l-[var(--state-info)] bg-[var(--state-info-bg)]/50",
    };

    const iconStyles = {
        success: "text-[var(--state-success)]",
        error: "text-[var(--state-error)]",
        warning: "text-[var(--state-warning)]",
        info: "text-[var(--state-info)]",
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={clsx(
                "toast min-w-[320px] max-w-[420px] border-l-4",
                typeStyles[toast.type]
            )}
        >
            <div className={clsx("flex-shrink-0 mt-0.5", iconStyles[toast.type])}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{toast.title}</p>
                {toast.description && (
                    <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{toast.description}</p>
                )}
                {toast.action && (
                    <button
                        onClick={toast.action.onClick}
                        className="text-[13px] font-semibold text-[var(--c1rcle-orange)] hover:underline mt-2"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            <button
                onClick={onClose}
                className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

// Standalone Toast Component (for backward compatibility)
export default function Toast({
    type = "info",
    title,
    description,
    onClose,
    className,
}: {
    type?: ToastType;
    title: string;
    description?: string;
    onClose?: () => void;
    className?: string;
}) {
    const icons = {
        success: CheckCircle2,
        error: AlertCircle,
        warning: AlertTriangle,
        info: Info,
    };

    const Icon = icons[type];

    const typeStyles = {
        success: "border-l-[var(--state-success)]",
        error: "border-l-[var(--state-error)]",
        warning: "border-l-[var(--state-warning)]",
        info: "border-l-[var(--state-info)]",
    };

    const iconStyles = {
        success: "text-[var(--state-success)]",
        error: "text-[var(--state-error)]",
        warning: "text-[var(--state-warning)]",
        info: "text-[var(--state-info)]",
    };

    return (
        <div className={clsx("toast border-l-4", typeStyles[type], className)}>
            <div className={clsx("flex-shrink-0 mt-0.5", iconStyles[type])}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
                {description && (
                    <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{description}</p>
                )}
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
