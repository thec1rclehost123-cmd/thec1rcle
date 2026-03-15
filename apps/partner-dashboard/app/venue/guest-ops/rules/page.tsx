import { Suspense } from "react";
import GuestRulesPageClient from "./PageClient";

export const metadata = { title: "Guest Rules — Guest Ops" };

export default function GuestRulesPage() {
    return (
        <Suspense>
            <GuestRulesPageClient />
        </Suspense>
    );
}
