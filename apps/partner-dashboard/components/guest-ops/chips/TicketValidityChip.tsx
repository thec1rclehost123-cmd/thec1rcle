"use client";

import clsx from "clsx";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCcw } from "lucide-react";

type ValidityResult = "valid" | "already_scanned" | "invalid" | "cancelled" | "not_found" | "re_entry";

const VALIDITY_CONFIG: Record<ValidityResult, { label: string; icon: React.ElementType; className: string }> = {
    valid:          { label: "Valid",           icon: CheckCircle2,  className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    already_scanned:{ label: "Already Scanned", icon: AlertTriangle, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    invalid:        { label: "Invalid",         icon: XCircle,       className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    cancelled:      { label: "Cancelled",       icon: XCircle,       className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    not_found:      { label: "Not Found",       icon: XCircle,       className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
    re_entry:       { label: "Re-Entry",        icon: RefreshCcw,    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

interface Props {
    result: ValidityResult | string;
    size?: "sm" | "xs";
}

export function TicketValidityChip({ result, size = "sm" }: Props) {
    const config = VALIDITY_CONFIG[result as ValidityResult] ?? { label: result, icon: AlertTriangle, className: "bg-gray-100 text-gray-600" };
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
