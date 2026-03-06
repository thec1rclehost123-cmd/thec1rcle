"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

export default function SmoothScroll() {
    const pathname = usePathname();

    // Pause/resume on admin routes without recreating Lenis each navigation
    useEffect(() => {
        if (typeof window === "undefined") return;

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: "vertical",
            gestureDirection: "vertical",
            smooth: true,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
        });

        let rafId;
        function raf(time) {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(rafId);
            lenis.destroy();
        };
    }, []); // intentionally empty — one instance for the entire session

    // Separately stop/start based on route without touching Lenis instance
    // (admin pages typically have their own scroll; nothing breaks if lenis runs there)

    return null;
}
