"use client";

import { cn } from "@/lib/utils";
import type { GuestSource } from "@/lib/types/guestOps";

const SOURCE_CONFIG: Record<GuestSource, { label: string; className: string }> = {
    ticket_purchase:       { label: "Ticket",        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    venue_manual:          { label: "Manual Add",    className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
    venue_comp:            { label: "Comp",          className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    venue_vip:             { label: "VIP",           className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    host_manual:           { label: "Host List",     className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    promoter_manual:       { label: "Promo List",    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    promoter_link_purchase:{ label: "Link Sale",     className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
    table_booking:         { label: "Table",         className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    imported_list:         { label: "Imported",      className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
    staff_override:        { label: "Override",      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

interface Props {
    source: GuestSource | string;
    size?: "sm" | "xs";
}

export function GuestSourceChip({ source, size = "sm" }: Props) {
    const config = SOURCE_CONFIG[source as GuestSource] ?? { label: source, className: "bg-gray-100 text-gray-600" };
    return (
        <span className={cn(
            "inline-flex items-center rounded-full font-medium",
            size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
            config.className
        )}>
            {config.label}
        </span>
    );
}
