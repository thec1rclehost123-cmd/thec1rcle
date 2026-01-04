"use client";

import { usePathname } from "next/navigation";
import RouteTransition from "./RouteTransition";

export default function PageWrapper({ children }) {
    const pathname = usePathname();
    const isLandingOrHero = pathname === "/" ||
        pathname === "/app" ||
        pathname === "/explore" ||
        pathname?.startsWith("/hosts") ||
        pathname?.startsWith("/venues") ||
        pathname?.startsWith("/profile") ||
        pathname?.startsWith("/tickets");

    return (
        <main
            className={`flex-1 flex flex-col
        ${isLandingOrHero ? "p-0" : "px-4 pt-24 pb-20 sm:px-8 sm:pt-32 sm:pb-32"}
      `}
        >
            <RouteTransition>{children}</RouteTransition>
        </main>
    );
}
