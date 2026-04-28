"use client";
import { useEffect } from "react";
import Lenis from "lenis";

import { usePathname } from "next/navigation";

export default function SmoothScroll() {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname?.startsWith("/host")) return;

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

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            lenis.destroy();
        };
    }, [pathname]);

    return null;
}
