"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VenueConnectionsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/venue/connections/requests");
    }, [router]);

    return (
        <div
            className="flex items-center justify-center min-h-[50vh] rounded-[var(--r-xl)]"
            style={{ background: "var(--bg-elevated)" }}
        >
            <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-tertiary)" }}
            >
                Redirecting...
            </p>
        </div>
    );
}
