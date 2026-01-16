"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardAuth } from "./providers/DashboardAuthProvider";
import { Compass, PlusCircle, User, LayoutDashboard, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { profile, isAuthenticated } = useDashboardAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide on dashboard layouts (venue/host/promoter) - they have their own mobile nav
  if (pathname?.startsWith("/venue") || pathname?.startsWith("/host") || pathname?.startsWith("/promoter")) return null;

  if (!mounted) return null;

  const navItems = [
    { label: "Explore", href: "/explore", icon: Compass },
    { label: "Create", href: "/create", icon: PlusCircle },
    { label: isAuthenticated ? "Profile" : "Login", href: isAuthenticated ? "/profile" : "/login", icon: User }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-4 mb-4 max-w-[400px] mx-auto rounded-[2rem] border border-white/10 bg-black/85 backdrop-blur-2xl px-6 py-4 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)]">
        <ul className="flex items-center justify-between">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  className={`group flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? "text-white" : "text-white/40 hover:text-white"}`}
                >
                  <div className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 ${active ? "bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "group-active:scale-90"}`}>
                    <Icon className={`h-5 w-5 transition-transform duration-300 ${active ? "scale-110" : ""}`} strokeWidth={active ? 2.5 : 2} />
                    {active && (
                      <motion.div
                        layoutId="partner-bottom-nav-glow"
                        className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#F44A22]/20 to-transparent opacity-50"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
