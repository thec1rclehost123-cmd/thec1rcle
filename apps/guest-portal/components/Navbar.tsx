"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
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
  const { scrollY } = useScroll();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, profile, logout, loading } = useAuth();

  const navWidth = useTransform(scrollY, [0, 100], ["100%", "90%"]);
  const navY = useTransform(scrollY, [0, 100], [0, 20]);
  const navBackdrop = useTransform(scrollY, [0, 100], ["blur(0px)", "blur(20px)"]);
  const navBackground = useTransform(scrollY, [0, 100], ["rgba(5, 5, 5, 0)", "var(--nav-bg-opaque)"]);
  const navBorder = useTransform(scrollY, [0, 100], ["rgba(255, 255, 255, 0)", "var(--nav-border)"]);



  const isLoginPage = pathname === "/login";
  const isMenuOpenRef = useRef(isMenuOpen);
  isMenuOpenRef.current = isMenuOpen;

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <motion.header
        className={`fixed inset-x-0 top-0 z-50 flex justify-center pt-4 pointer-events-none transition-all duration-700 ${pathname?.startsWith('/admin') ? 'opacity-10 blur-[2px] grayscale-[0.8] hover:opacity-100 hover:blur-none hover:grayscale-0' : ''}`}
        style={{ y: navY }}
      >
        <motion.nav
          style={{
            width: navWidth,
            backdropFilter: navBackdrop,
            backgroundColor: navBackground,
            borderColor: navBorder,
          }}
          className="pointer-events-auto flex items-center justify-between px-4 py-2 sm:px-6 sm:py-2.5 border border-transparent rounded-full transition-all duration-500 max-w-5xl mx-auto"
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

          <div className={clsx(
            "hidden items-center gap-1 lg:flex rounded-full p-1 border backdrop-blur-md transition-all duration-500",
            isLoginPage
              ? "bg-black/[0.05] dark:bg-white/10 border-black/10 dark:border-white/20 backdrop-blur-xl shadow-sm"
              : "bg-black/[0.03] dark:bg-white/5 border-black/5 dark:border-white/5"
          )}>
            {navLinks.map((link) => {
              const isActive = link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href) || (link.label === "Hosts" && pathname?.startsWith("/venues"));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "relative px-6 py-2.5 rounded-full text-xs uppercase tracking-widest transition-all duration-300",
                    isLoginPage ? (
                      isActive
                        ? "text-white dark:text-black font-black"
                        : "text-black/70 dark:text-white/80 font-black hover:text-black dark:hover:text-white"
                    ) : (
                      isActive
                        ? "text-white font-bold"
                        : "text-black/60 dark:text-white/60 font-bold hover:text-black dark:hover:text-gold-light"
                    )
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className={clsx(
                        "absolute inset-0 rounded-full shadow-md",
                        isLoginPage
                          ? "bg-black dark:bg-white shadow-lg"
                          : "bg-orange dark:bg-gradient-to-r dark:from-gold dark:via-gold-metallic dark:to-gold-light dark:shadow-[0_0_20px_rgba(255,215,0,0.4)]"
                      )}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="hidden lg:inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all font-heading"
                >
                  Profile
                </Link>
              </>
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
              <motion.span
                animate={isMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                className="h-0.5 w-5 bg-black dark:bg-white origin-center transition-transform"
              />
              <motion.span
                animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                className="h-0.5 w-5 bg-black dark:bg-white transition-opacity"
              />
              <motion.span
                animate={isMenuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                className="h-0.5 w-5 bg-black dark:bg-white origin-center transition-transform"
              />
            </button>
          </div>
        </motion.nav>
      </motion.header >

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-3xl lg:hidden flex flex-col justify-center"
          >
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange/40 via-transparent to-transparent" />

            <div className="flex flex-col items-center gap-6 p-8 w-full max-w-md mx-auto relative z-10">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                  className="w-full"
                >
                  <Link
                    href={link.href}
                    onClick={() => closeMenu()}
                    className="block w-full text-center text-5xl sm:text-6xl font-black font-heading uppercase custom-tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 hover:to-orange transition-all duration-500"
                    style={{ letterSpacing: '-0.04em', lineHeight: '1.1' }}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="w-full h-px bg-white/10 my-8"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="w-full flex flex-col gap-4"
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
              </motion.div>
            </div>
            <button
              onClick={closeMenu}
              className="absolute top-8 right-8 p-2 text-white/50 hover:text-white"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
