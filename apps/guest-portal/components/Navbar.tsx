import Link from "next/link";
import { memo, Suspense } from "react";
import DesktopNavLinks from "./DesktopNavLinks";
import NavControls from "./NavControls";

function Navbar() {
  return (
    <header
      id="navbar-header"
      className="fixed inset-x-0 top-0 z-50 flex justify-center pt-4 pointer-events-none will-change-transform transition-[opacity,filter] duration-700"
    >
      <nav
        id="navbar-inner"
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
        <DesktopNavLinks />
        <Suspense fallback={<div className="hidden lg:block h-9 w-24 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10" aria-hidden="true" />}>
          <NavControls />
        </Suspense>
      </nav>
    </header>
  );
}

export default memo(Navbar);
