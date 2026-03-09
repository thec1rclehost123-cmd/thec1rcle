"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "./providers/AuthProvider";
import ThemeToggle from "./ThemeToggle";
import { saveIntent } from "../lib/utils/intentStore";

const navLinks = [
  { label: "Explore", href: "/explore" },
  { label: "Hosts", href: "/hosts" },
  { label: "Tickets", href: "/tickets" },
  { label: "App", href: "/app" }
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, profile, logout, loading } = useAuth();

  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  // Scroll-driven navbar: shrink width, apply backdrop blur and background tint.
  // Uses a passive scroll listener instead of Framer Motion useTransform — no RAF overhead.
  useEffect(() => {
    function onScroll() {
      const progress = Math.min(window.scrollY / 100, 1);
      const header = headerRef.current;
      const nav = navRef.current;
      if (!header || !nav) return;
      header.style.transform = `translateY(${progress * 20}px)`;
      nav.style.width = `${100 - progress * 10}%`;
      nav.style.backdropFilter = `blur(${progress * 20}px)`;
      nav.style.backgroundColor = `rgba(3,3,3,${progress * 0.75})`;
      nav.style.borderColor = `rgba(255,255,255,${progress * 0.06})`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 flex justify-center pt-4 pointer-events-none will-change-transform transition-[opacity,filter] duration-700 ${pathname?.startsWith("/admin") ? "opacity-10 blur-[2px] grayscale-[0.8] hover:opacity-100 hover:blur-none hover:grayscale-0" : ""}`}
      >
        <nav
          ref={navRef}
          style={{ width: "100%" }}
          className="pointer-events-auto flex items-center justify-between px-4 py-2 sm:px-6 sm:py-2.5 border border-transparent rounded-full max-w-5xl mx-auto"
        >
          <Link href="/" className="group flex items-center gap-2 sm:gap-4">
            <div className="relative flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-orange/20 dark:border-white/10 transition-all duration-500 group-hover:rotate-180 group-hover:border-orange/40 dark:group-hover:border-white/20">
              <span className="absolute inset-0 bg-gradient-to-tr from-orange dark:from-gold via-transparent to-transparent opacity-10" />
              <img src="/logo-circle.jpg" alt="The C1rcle" className="h-full w-full object-cover" />
            </div>
            <span className="font-heading text-lg sm:text-xl font-black tracking-tighter uppercase text-black dark:text-white group-hover:text-orange dark:group-hover:text-white transition-colors">
              The C1rcle
            </span>
          </Link>

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

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/profile"
                className="hidden lg:inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all font-heading"
              >
                Profile
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden lg:inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all duration-300 shadow-md transform-gpu font-heading"
              >
                Login
              </Link>
            )}

            <ThemeToggle />

            <button
              type="button"
              className="relative flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 lg:hidden"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              <span
                className={`h-0.5 w-5 bg-black dark:bg-white origin-center transition-transform duration-300 ${isMenuOpen ? "rotate-45 translate-y-[6px]" : ""}`}
              />
              <span
                className={`h-0.5 w-5 bg-black dark:bg-white transition-opacity duration-300 ${isMenuOpen ? "opacity-0" : "opacity-100"}`}
              />
              <span
                className={`h-0.5 w-5 bg-black dark:bg-white origin-center transition-transform duration-300 ${isMenuOpen ? "-rotate-45 -translate-y-[6px]" : ""}`}
              />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu — CSS slide-in, replaces AnimatePresence + motion.div */}
      <div
        className={`fixed inset-0 z-40 bg-black/95 backdrop-blur-3xl lg:hidden flex flex-col justify-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMenuOpen ? "translate-y-0 pointer-events-auto" : "-translate-y-full pointer-events-none"}`}
        aria-hidden={!isMenuOpen}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange/40 via-transparent to-transparent" />

        <div className="flex flex-col items-center gap-6 p-8 w-full max-w-md mx-auto relative z-10">
          {navLinks.map((link, i) => (
            <div
              key={link.href}
              className="w-full transition-all duration-500"
              style={{
                opacity: isMenuOpen ? 1 : 0,
                transform: isMenuOpen ? "translateY(0)" : "translateY(40px)",
                transitionDelay: isMenuOpen ? `${0.2 + i * 0.1}s` : "0s",
              }}
            >
              <Link
                href={link.href}
                onClick={closeMenu}
                className="block w-full text-center text-5xl sm:text-6xl font-black font-heading uppercase text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 hover:to-orange transition-all duration-500"
                style={{ letterSpacing: "-0.04em", lineHeight: "1.1" }}
              >
                {link.label}
              </Link>
            </div>
          ))}

          <div
            className="w-full h-px bg-white/10 my-8 transition-opacity duration-500"
            style={{
              opacity: isMenuOpen ? 1 : 0,
              transitionDelay: isMenuOpen ? "0.6s" : "0s",
            }}
          />

          <div
            className="w-full flex flex-col gap-4 transition-all duration-500"
            style={{
              opacity: isMenuOpen ? 1 : 0,
              transform: isMenuOpen ? "translateY(0)" : "translateY(20px)",
              transitionDelay: isMenuOpen ? "0.7s" : "0s",
            }}
          >
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={closeMenu}
                  className="block w-full py-5 text-center rounded-3xl bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-colors"
                >
                  My Profile
                </Link>
                <button
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="block w-full py-5 text-center rounded-3xl border border-white/10 text-sm font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={closeMenu}
                className="block w-full py-5 text-center rounded-3xl bg-white text-black text-sm font-bold uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                Login / Sign Up
              </Link>
            )}
          </div>
        </div>

        <button
          onClick={closeMenu}
          className="absolute top-8 right-8 p-2 text-white/50 hover:text-white"
        >
          Close
        </button>
      </div>
    </>
  );
}
