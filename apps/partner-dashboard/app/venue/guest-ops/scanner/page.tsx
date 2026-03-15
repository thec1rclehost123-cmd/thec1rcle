import { Suspense } from "react";
import ScannerOversightPageClient from "./PageClient";

export const metadata = { title: "Scanner Oversight — Guest Ops" };

export default function ScannerOversightPage() {
    return (
        <Suspense>
            <ScannerOversightPageClient />
        </Suspense>
    );
}
