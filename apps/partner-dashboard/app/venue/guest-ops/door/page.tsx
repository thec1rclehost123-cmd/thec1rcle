import { Suspense } from "react";
import DoorSearchPageClient from "./PageClient";

export const metadata = { title: "Door Search — Guest Ops" };

export default function DoorSearchPage() {
    return (
        <Suspense>
            <DoorSearchPageClient />
        </Suspense>
    );
}
