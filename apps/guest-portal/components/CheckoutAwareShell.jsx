"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import PageWrapper from "./PageWrapper";

const SmoothScroll = dynamic(() => import("./SmoothScroll"), { ssr: false });
const MobileBottomNav = dynamic(() => import("./MobileBottomNav"), { ssr: false });
const PageLoadingAnimation = dynamic(() => import("./PageLoadingAnimation"), { ssr: false });
const ScrollProgressBar = dynamic(() => import("./ScrollProgressBar"), { ssr: false });

export default function CheckoutAwareShell({ children, navbar, footer }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const pathname = usePathname();
  const isCheckout = pathname?.startsWith("/checkout");

  useEffect(() => {
    // Delay loading of secondary UI to prioritize LCP and initial paint
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => setIsLoaded(true));
        } else {
          setIsLoaded(true);
        }
      }
    }, 1500); // 1.5s delay is a safe bet for LCP completion on slow 3G/4G
    return () => clearTimeout(timer);
  }, []);

  if (isCheckout) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
        {children}
      </div>
    );
  }

  return (
    <>
      {isLoaded && <PageLoadingAnimation />}
      {isLoaded && <ScrollProgressBar />}
      <div className="page-shell relative flex min-h-screen flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-300">
        {/* Ambient background gradients (dark mode only) */}
        <div className="pointer-events-none fixed inset-0 -z-10 opacity-0 dark:opacity-90 transition-opacity duration-300" style={{ contain: "strict" }}>
          <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_55%)] blur-[120px]" style={{ willChange: "filter", transform: "translateZ(0)" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(136,69,255,0.18),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[50vh] bg-[radial-gradient(circle_at_bottom,_rgba(255,181,167,0.2),transparent_50%)] blur-[140px]" style={{ willChange: "filter", transform: "translateZ(0)" }} />
        </div>
        {navbar}
        <PageWrapper>{children}</PageWrapper>
        {footer}
        {isLoaded && <MobileBottomNav />}
        {isLoaded && <SmoothScroll />}
      </div>
    </>
  );
}
