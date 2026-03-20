import { Suspense } from "react";
import HostNetworkPage from "./PageClient";

export const metadata = { title: "Network — Host" };

export default function NetworkPage() {
    return (
        <Suspense>
            <HostNetworkPage />
        </Suspense>
    );
}
