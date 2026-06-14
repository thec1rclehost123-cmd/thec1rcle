import { Suspense } from "react";
import AnalyticsPageClient from "./PageClient";

export const metadata = { title: "Analytics — Venue" };

export default function AnalyticsPage() {
    return (
        <Suspense>
            <AnalyticsPageClient />
        </Suspense>
    );
}
