"use client";

/**
 * CheckoutAwareShell
 *
 * On normal routes: renders the full site chrome (Navbar, Footer, gradient
 * background, MobileBottomNav, SmoothScroll, etc.) inside the flex-column
 * page-shell div.
 *
 * On /checkout/* routes: renders a bare wrapper with no chrome.
 * The FunnelShell inside each checkout page provides its own header and layout.
 *
 * Dynamic chunk savings for checkout sessions:
 *   - SmoothScroll (~15 KB) — not imported
 *   - MobileBottomNav (~8 KB) — not imported
 *   - ScrollProgressBar (~5 KB) — not imported
 *   - PageLoadingAnimation (~5 KB) — not imported
 *   Total: ~33 KB of dynamic JS never downloaded by checkout users.
 *
 * Statically imported modules (Navbar, Footer) remain in the shared bundle
 * because they are imported at module level in this file. Full elimination
 * requires a Next.js route-group restructure (app/(main)/ vs app/(checkout)/).
 */

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PageWrapper from "./PageWrapper";

const SmoothScroll = dynamic(() => import("./SmoothScroll"), { ssr: false });
const MobileBottomNav = dynamic(() => import("./MobileBottomNav"), { ssr: false });
const PageLoadingAnimation = dynamic(() => import("./PageLoadingAnimation"), { ssr: false });
const ScrollProgressBar = dynamic(() => import("./ScrollProgressBar"), { ssr: false });

export default function CheckoutAwareShell({ children }) {
  const pathname = usePathname();
  const isCheckout = pathname?.startsWith("/checkout");

  if (isCheckout) {
    // Minimal wrapper — FunnelShell inside the page handles its own layout.
    return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
        {children}
      </div>
    );
  }

  return (
    <>
      <PageLoadingAnimation />
      <ScrollProgressBar />
      <div className="page-shell relative flex min-h-screen flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-300 overflow-x-hidden">
        {/* Ambient background gradients (dark mode only) */}
        <div className="pointer-events-none fixed inset-0 -z-10 opacity-0 dark:opacity-90 transition-opacity duration-300" style={{ contain: "strict" }}>
          <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_55%)] blur-[120px]" style={{ willChange: "filter", transform: "translateZ(0)" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(136,69,255,0.18),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[50vh] bg-[radial-gradient(circle_at_bottom,_rgba(255,181,167,0.2),transparent_50%)] blur-[140px]" style={{ willChange: "filter", transform: "translateZ(0)" }} />
        </div>
        <Navbar />
        <PageWrapper>{children}</PageWrapper>
        <Footer />
        <MobileBottomNav />
        <SmoothScroll />
      </div>
    </>
  );
}
