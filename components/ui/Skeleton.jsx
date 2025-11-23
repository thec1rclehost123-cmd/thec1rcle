"use client";

import { cn } from "../../lib/utils";

export default function Skeleton({ className, ...props }) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-black/10 dark:bg-white/10", className)}
            {...props}
        />
    );
}
