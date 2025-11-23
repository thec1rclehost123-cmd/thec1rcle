"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname?.startsWith("/host")) return null;
  const navItems = [
    { label: "Explore", href: "/explore" },
    { label: "Create", href: "/create" },
    { label: user ? "Profile" : "Account", href: user ? "/profile" : "/login" }
  ];
  return (
    <nav className="fixed bottom-4 left-1/2 z-40 w-[90%] max-w-md -translate-x-1/2 rounded-full border border-white/15 bg-white/5 px-6 py-3 backdrop-blur-xl md:hidden">
      <ul className="flex items-center justify-between text-xs font-semibold tracking-[0.25em] uppercase">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`px-3 py-1 transition ${active ? "text-cream" : "text-white/70"
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
