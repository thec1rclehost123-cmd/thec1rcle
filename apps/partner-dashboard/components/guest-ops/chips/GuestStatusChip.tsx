"use client";

import clsx from "clsx";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { GuestStatus } from "@/lib/types/guestOps";

const STATUS_CONFIG: Record<GuestStatus, { label: string; icon: React.ElementType; className: string }> = {
    expected:         { label: "Expected",     icon: Clock,         className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
    checked_in:       { label: "Checked In",   icon: CheckCircle2,  className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    denied:           { label: "Denied",       icon: XCircle,       className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    flagged:          { label: "Flagged",      icon: AlertTriangle, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    no_show:          { label: "No Show",      icon: Clock,         className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
    pending_approval: { label: "Pending",      icon: Loader2,       className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    removed:          { label: "Removed",      icon: XCircle,       className: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
};

interface Props {
    status: GuestStatus | string;
    size?: "sm" | "xs";
}

export function GuestStatusChip({ status, size = "sm" }: Props) {
    const config = STATUS_CONFIG[status as GuestStatus] ?? { label: status, icon: Clock, className: "bg-gray-100 text-gray-600" };
    const Icon = config.icon;
    return (
        <span className={clsx(
            "inline-flex items-center gap-1 rounded-full font-medium",
            size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
            config.className
        )}>
            <Icon size={size === "xs" ? 9 : 11} />
            {config.label}
        </span>
    );
}
