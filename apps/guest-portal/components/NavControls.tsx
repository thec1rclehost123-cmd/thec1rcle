'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from './providers/AuthProvider';
import ThemeToggle from './ThemeToggle';
import { navLinks } from './DesktopNavLinks';
import { buildLoginUrl, buildSignupUrl, getReturnUrl } from '../lib/auth/guestRouteAccess';

export default function NavControls() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = getReturnUrl(searchParams);
  const isLoginPage = pathname === '/login';
  const isSignupPage = pathname === '/signup';
  const authToggleHref = isSignupPage ? buildLoginUrl(returnUrl) : buildSignupUrl(returnUrl);
  const authToggleLabel = isSignupPage ? 'Login' : 'Sign Up';
  const isAuthPage = isLoginPage || isSignupPage;

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <div className="flex items-center gap-3">
        {user && !isAuthPage ? (
          <Link
            href={`/profile/${user.uid}`}
            className="hidden lg:inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all font-heading"
          >
            Profile
          </Link>
        ) : !isAuthPage && !loading ? (
          <Link
            href="/login?next=/profile"
            className="hidden lg:inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all duration-300 shadow-md transform-gpu font-heading"
          >
            Login
          </Link>
        ) : null}

        <ThemeToggle />

        <button
          type="button"
          className="relative flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 lg:hidden"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span
            className={`h-0.5 w-5 bg-black dark:bg-white origin-center transition-transform duration-300 ${isMenuOpen ? 'rotate-45 translate-y-[6px]' : ''}`}
          />
          <span
            className={`h-0.5 w-5 bg-black dark:bg-white transition-opacity duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}
          />
          <span
            className={`h-0.5 w-5 bg-black dark:bg-white origin-center transition-transform duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-40 bg-black/95 backdrop-blur-3xl lg:hidden flex flex-col justify-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMenuOpen ? 'translate-y-0 pointer-events-auto' : '-translate-y-full pointer-events-none'}`}
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
                transform: isMenuOpen ? 'translateY(0)' : 'translateY(40px)',
                transitionDelay: isMenuOpen ? `${0.2 + i * 0.1}s` : '0s',
              }}
            >
              <Link
                href={link.href}
                onClick={closeMenu}
                className="block w-full text-center text-5xl sm:text-6xl font-black font-heading uppercase text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 hover:to-orange transition-all duration-500"
                style={{ letterSpacing: '-0.04em', lineHeight: '1.1' }}
              >
                {link.label}
              </Link>
            </div>
          ))}

          <div
            className="w-full h-px bg-white/10 my-8 transition-opacity duration-500"
            style={{
              opacity: isMenuOpen ? 1 : 0,
              transitionDelay: isMenuOpen ? '0.6s' : '0s',
            }}
          />

          <div
            className="w-full flex flex-col gap-4 transition-all duration-500"
            style={{
              opacity: isMenuOpen ? 1 : 0,
              transform: isMenuOpen ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: isMenuOpen ? '0.7s' : '0s',
            }}
          >
            {user ? (
              <>
                <Link
                  href={`/profile/${user.uid}`}
                  onClick={closeMenu}
                  className="block w-full py-5 text-center rounded-3xl bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-colors"
                >
                  My Profile
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    closeMenu();
                    router.replace(buildLoginUrl('/profile'));
                  }}
                  className="block w-full py-5 text-center rounded-3xl border border-white/10 text-sm font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : !isAuthPage && !loading ? (
              <Link
                href="/login?next=/profile"
                onClick={closeMenu}
                className="block w-full py-5 text-center rounded-3xl bg-white text-black text-sm font-bold uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                Login / Sign Up
              </Link>
            ) : null}
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
