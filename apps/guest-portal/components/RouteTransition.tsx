"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Tab routes that should switch instantly with no animation
const TAB_ROUTES = new Set(["/explore", "/hosts", "/tickets", "/app"]);

export default function RouteTransition({ children }) {
  const pathname = usePathname();

  // ⚡ FIX 1: If navigating between main tabs, skip animation entirely.
  // A 400ms animation on every tab click makes navigation feel laggy.
  // Native apps switch tabs in 0ms — we match that behaviour here.
  const isTabRoute = TAB_ROUTES.has(pathname);

  if (isTabRoute) {
    // Return children directly — no framer-motion wrapper, zero overhead
    return <div className="w-full flex-1 flex flex-col">{children}</div>;
  }

  // Non-tab routes (event detail pages, profile, etc.) keep the nice transition
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full flex-1 flex flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
