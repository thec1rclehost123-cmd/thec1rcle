"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";

export const navLinks = [
    { label: "Explore", href: "/explore" },
    { label: "Hosts", href: "/hosts" },
    { label: "Tickets", href: "/tickets" },
    { label: "App", href: "/app" }
];

export default function DesktopNavLinks() {
    const pathname = usePathname();
    const linksRef = useRef<HTMLDivElement>(null);
    const pillRef = useRef<HTMLDivElement>(null);

    // Scroll effect (originally in Navbar.tsx) handles global nav styling
    useEffect(() => {
        function applyNavStyle() {
            const isDark = document.documentElement.classList.contains("dark");
            const progress = Math.min(window.scrollY / 100, 1);
            const header = document.getElementById("navbar-header");
            const nav = document.getElementById("navbar-inner");
            if (!header || !nav) return;
            header.style.transform = `translateY(${progress * 20}px)`;
            nav.style.width = `${100 - progress * 10}%`;
            nav.style.backdropFilter = `blur(${progress * 20}px)`;
            nav.style.backgroundColor = isDark
                ? `rgba(3,3,3,${progress * 0.80})`
                : `rgba(250,250,249,${progress * 0.92})`;
            nav.style.borderColor = isDark
                ? `rgba(255,255,255,${progress * 0.06})`
                : `rgba(0,0,0,${progress * 0.06})`;
        }
        window.addEventListener("scroll", applyNavStyle, { passive: true });
        // Re-apply whenever the theme class on <html> changes (e.g. toggle while scrolled)
        const observer = new MutationObserver(applyNavStyle);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => {
            window.removeEventListener("scroll", applyNavStyle);
            observer.disconnect();
        };
    }, []);

    // Slide the active nav pill to the current link's position after each route change.
    useEffect(() => {
        const container = linksRef.current;
        const pill = pillRef.current;
        if (!container || !pill) return;
        const active = container.querySelector<HTMLElement>('[data-active="true"]');
        if (!active) {
            pill.style.opacity = "0";
            return;
        }
        const cRect = container.getBoundingClientRect();
        const aRect = active.getBoundingClientRect();
        pill.style.opacity = "1";
        pill.style.width = `${aRect.width}px`;
        pill.style.left = `${aRect.left - cRect.left}px`;
    }, [pathname]);

    const isLoginPage = pathname === "/login";

    return (
        <div
            ref={linksRef}
            className={clsx(
                "relative hidden items-center gap-1 lg:flex rounded-full p-1 border backdrop-blur-md transition-all duration-500",
                isLoginPage
                    ? "bg-black/[0.05] dark:bg-white/10 border-black/10 dark:border-white/20 backdrop-blur-xl shadow-sm"
                    : "bg-black/[0.03] dark:bg-white/5 border-black/5 dark:border-white/5"
            )}
        >
            {/* Active nav pill — positioned absolutely, animated via useEffect above */}
            <div
                ref={pillRef}
                aria-hidden="true"
                className={clsx(
                    "absolute top-1 h-[calc(100%-8px)] rounded-full shadow-md pointer-events-none",
                    isLoginPage
                        ? "bg-black dark:bg-white shadow-lg"
                        : "bg-orange dark:bg-gradient-to-r dark:from-gold dark:via-gold-metallic dark:to-gold-light dark:shadow-[0_0_20px_rgba(255,215,0,0.4)]"
                )}
                style={{
                    opacity: 0,
                    left: 0,
                    width: 0,
                    transition: "left 0.5s cubic-bezier(0.16,1,0.3,1), width 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.2s",
                }}
            />

            {navLinks.map((link) => {
                const isActive =
                    link.href === "/"
                        ? pathname === "/"
                        : pathname?.startsWith(link.href) ||
                        (link.label === "Hosts" && pathname?.startsWith("/venues"));

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        data-active={isActive ? "true" : undefined}
                        className={clsx(
                            "relative px-6 py-2.5 rounded-full text-xs uppercase tracking-widest transition-all duration-300",
                            isLoginPage
                                ? isActive
                                    ? "text-white dark:text-black font-black"
                                    : "text-black/70 dark:text-white/80 font-black hover:text-black dark:hover:text-white"
                                : isActive
                                    ? "text-white font-bold"
                                    : "text-black/60 dark:text-white/60 font-bold hover:text-black dark:hover:text-gold-light"
                        )}
                    >
                        <span className="relative z-10">{link.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
