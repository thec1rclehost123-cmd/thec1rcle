"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VenueConnectionsPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the requests page by default
        router.replace("/venue/connections/requests");
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-slate-400">Redirecting...</div>
        </div>
    );
}
