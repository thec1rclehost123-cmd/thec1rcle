"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import { saveIntent } from "../lib/utils/intentStore";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname?.startsWith("/host") || pathname?.startsWith("/checkout") || pathname?.startsWith("/confirmation") || pathname === "/forgot-password" || pathname === "/auth/callback" || pathname === "/login" || pathname === "/auth") return null;
  const navItems = [
    { label: "Explore", href: "/explore" },
    { label: "Tickets", href: "/tickets" },
    { label: "App", href: "/app" },
    { label: user ? "Profile" : "Login", href: user ? "/profile" : "/login" }
  ];

  const handleNavClick = (e, href) => {
    if (href === "/tickets" && !user) {
      e.preventDefault();
      saveIntent("VIEW_TICKETS", null, {}, "/tickets");
      window.dispatchEvent(
        new CustomEvent("OPEN_AUTH_MODAL", { detail: { intent: "VIEW_TICKETS" } })
      );
    }
  };
  return (
    <nav className="fixed bottom-8 left-1/2 z-50 w-[85%] max-w-md -translate-x-1/2 rounded-full border border-white/25 bg-[#1a1a1a] px-8 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] md:hidden">
      <ul className="flex items-center justify-between text-xs font-bold tracking-[0.2em] uppercase">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`transition-colors duration-300 ${active ? "text-[#F44A22]" : "text-white/60 hover:text-white"
                  }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
