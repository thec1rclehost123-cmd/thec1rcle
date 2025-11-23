"use client";

import { usePathname } from "next/navigation";
import RouteTransition from "./RouteTransition";

export default function PageWrapper({ children }) {
    const pathname = usePathname();
    const isHost = pathname?.startsWith("/host");

    return (
        <main
            className={`
        ${isHost ? "p-0" : "px-4 pt-28 pb-24 sm:px-8 sm:pt-40 sm:pb-32"}
      `}
        >
            <RouteTransition>{children}</RouteTransition>
        </main>
    );
}
