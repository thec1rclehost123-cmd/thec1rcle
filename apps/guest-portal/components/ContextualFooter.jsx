"use client";

import { usePathname } from "next/navigation";

export default function ContextualFooter({ footerContent }) {
    const pathname = usePathname();

    const isHostDashboard = pathname?.startsWith("/host") && !pathname.includes("%40") && !pathname.includes("@");
    const isFocusedFlow = pathname?.startsWith("/checkout") || pathname?.startsWith("/confirmation") || pathname === "/forgot-password" || pathname === "/auth/callback" || pathname === "/login" || pathname === "/signup" || pathname === "/auth";

    if (isHostDashboard || isFocusedFlow) return null;

    return footerContent;
}
