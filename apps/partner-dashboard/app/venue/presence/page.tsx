import { Suspense } from "react";
import PresencePageClient from "./PageClient";

export const metadata = { title: "Presence — Venue" };

export default function PresencePage() {
    return (
        <Suspense>
            <PresencePageClient />
        </Suspense>
    );
}
