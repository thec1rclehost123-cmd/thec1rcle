"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useAuth } from "./providers/AuthProvider";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { label: "Explore", href: "/explore" },
  { label: "Create", href: "/create" },
  // { label: "Circle", href: "/about" },
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

  if (pathname?.startsWith("/host")) return null;

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 flex justify-center pt-4 pointer-events-none"
        style={{ y: navY }}
      >
        <motion.nav
          style={{
            width: navWidth,
            backdropFilter: navBackdrop,
            backgroundColor: navBackground,
            borderColor: navBorder,
          }}
          className="pointer-events-auto flex items-center justify-between px-6 py-4 border border-transparent rounded-full transition-all duration-500 max-w-5xl mx-auto"
        >
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold/20 via-gold-dark/10 to-transparent border border-gold/20 transition-all duration-500 group-hover:rotate-180 group-hover:border-gold/40 group-hover:shadow-[0_0_20px_rgba(255,215,0,0.3)]">
              <span className="absolute inset-0 bg-gradient-to-tr from-gold via-transparent to-transparent opacity-30" />
              <span className="relative text-sm font-bold bg-gradient-to-br from-gold to-gold-dark bg-clip-text text-transparent">C1</span>
            </div>
            <span className="text-sm font-bold tracking-widest uppercase text-black/90 dark:text-white/90 group-hover:text-gold-light transition-colors">
              The C1rcle
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex bg-black/5 dark:bg-white/5 rounded-full p-1 border border-black/5 dark:border-white/5 backdrop-blur-md">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${isActive ? "text-black dark:text-white" : "text-black/60 dark:text-white/60 hover:text-gold-light"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-gradient-to-r from-gold via-gold-metallic to-gold-light rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)]"
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
                  className="hidden lg:inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all"
                >
                  {(() => {
                    const name = profile?.displayName;
                    const emailHandle = user?.email?.split("@")[0];
                    if (name && emailHandle && name.toLowerCase() === emailHandle.toLowerCase()) {
                      return "Profile";
                    }
                    return name || "Profile";
                  })()}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loading}
                  className="hidden lg:inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-200 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="hidden lg:inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                Login
              </Link>
            )}

            <ThemeToggle />

            <button
              type="button"
              className="relative flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 lg:hidden"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/90 backdrop-blur-xl lg:hidden flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-8 p-8 w-full max-w-sm">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="w-full"
                >
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="block w-full text-center py-4 text-2xl font-heading font-bold text-white hover:text-iris transition-colors"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="w-full pt-8 border-t border-white/10 flex flex-col gap-4"
              >
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={closeMenu}
                      className="block w-full py-4 text-center rounded-full bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-widest text-white"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                      className="block w-full py-4 text-center rounded-full border border-white/10 text-sm font-bold uppercase tracking-widest text-white/60"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="block w-full py-4 text-center rounded-full bg-white text-black text-sm font-bold uppercase tracking-widest shadow-glow"
                  >
                    Login
                  </Link>
                )}
              </motion.div>

              <button
                onClick={closeMenu}
                className="absolute top-8 right-8 p-2 text-white/50 hover:text-white"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
