"use client";

import { cn } from "../../lib/utils";

export default function Skeleton({ className, ...props }) {
    return (
        <div
            className={cn("relative overflow-hidden rounded-md bg-black/5 dark:bg-white/5", className)}
            {...props}
        >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer-block_2s_infinite] bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
        </div>
    );
}
