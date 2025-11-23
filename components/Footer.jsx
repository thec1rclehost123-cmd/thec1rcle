import Link from "next/link";

const links = [
  { label: "Download App", href: "/app" },
  { label: "Explore", href: "/explore" },
  { label: "Create", href: "/create" },
  { label: "University", href: "/about" },
  { label: "Careers", href: "/about#careers" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" }
];

export default function Footer() {
  return (
    <footer className="border-t border-black/5 dark:border-white/5 bg-white dark:bg-black pb-12 pt-24">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-20 flex flex-col items-center justify-center gap-8 text-center">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-black/20 dark:via-white/20 to-transparent" />
          <h2 className="font-heading text-4xl font-bold uppercase tracking-tight text-black dark:text-white sm:text-6xl md:text-8xl opacity-20">
            The C1rcle
          </h2>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-black/20 dark:via-white/20 to-transparent" />
        </div>

        <div className="flex flex-col items-center justify-between gap-8 border-t border-black/5 dark:border-white/5 pt-8 sm:flex-row">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
            © 2024 The C1rcle — Discover Life Offline
          </p>

          <div className="flex flex-wrap justify-center gap-6">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60 transition hover:text-black dark:hover:text-white"
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
