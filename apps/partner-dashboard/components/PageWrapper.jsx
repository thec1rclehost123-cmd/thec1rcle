"use client";

import { usePathname } from "next/navigation";
import RouteTransition from "./RouteTransition";

export default function PageWrapper({ children }) {
    const pathname = usePathname();
    const isHost = pathname?.startsWith("/host");
    const isHomepage = pathname === "/";

    return (
        <main
            className={`
        ${isHost || isHomepage || pathname === "/app" || pathname === "/explore" || pathname === "/profile" ? "p-0" : "px-4 pt-24 pb-20 sm:px-8 sm:pt-32 sm:pb-32"}
      `}
        >
            <RouteTransition>{children}</RouteTransition>
        </main>
    );
}
