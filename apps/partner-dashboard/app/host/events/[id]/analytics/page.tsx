import { Suspense } from "react";
import EventAnalyticsClient from "@/components/analytics/EventAnalyticsClient";

export default async function EventAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    return (
        <Suspense fallback={<div className="min-h-screen bg-[var(--v-canvas)] flex items-center justify-center">Loading Analytics...</div>}>
            <EventAnalyticsClient role="host" idParam="hostId" eventId={resolvedParams.id} />
        </Suspense>
    );
}
