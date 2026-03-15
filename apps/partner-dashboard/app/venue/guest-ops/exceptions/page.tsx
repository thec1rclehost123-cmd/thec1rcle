import { Suspense } from "react";
import ExceptionsPageClient from "./PageClient";

export const metadata = { title: "Exceptions — Guest Ops" };

export default function ExceptionsPage() {
    return (
        <Suspense>
            <ExceptionsPageClient />
        </Suspense>
    );
}
