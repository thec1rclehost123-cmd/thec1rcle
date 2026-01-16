"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { label: "Download App", href: "/app" },
  { label: "Explore", href: "/explore" },
  { label: "University", href: "/about" },
  { label: "Careers", href: "/about#careers" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" }
];

export default function Footer() {
  const pathname = usePathname();

  // Hide footer on host studio internal routes
  const isHostDashboard = pathname?.startsWith("/host") && !pathname.includes("%40") && !pathname.includes("@");
  if (isHostDashboard) return null;

  return (
    <footer className="bg-black text-white pt-32 pb-12 px-6">
      <div className="max-w-[1400px] mx-auto flex flex-col items-center">
        {/* Large Brand Text */}
        <div className="relative mb-32 w-full text-center">
          <Link href="/" className="inline-block group">
            <h2 className="text-[14vw] md:text-[12rem] font-heading font-black uppercase tracking-tighter text-white/15 group-hover:text-white/25 transition-all duration-1000 select-none">
              THE C1RCLE
            </h2>
          </Link>
        </div>

        {/* Bottom Bar */}
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-8 pt-12 border-t border-white/5">
          {/* Copyright */}
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">
            © 2025 THE C1RCLE — DISCOVER LIFE OFFLINE
          </p>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
