'use client';

import { useEffect, useState } from 'react';
import { Search, X, Command, ChevronDown, Settings, LogOut, Trophy } from 'lucide-react';
import { WalletPopover } from '@/components/wallet/WalletPopover';
import Link from 'next/link';
import { NotificationCenter } from './NotificationCenter';
import { parseAsIST } from '@c1rcle/core/time';
import { useDashboardAuth } from '../providers/DashboardAuthProvider';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AppleTopBarProps {
  title?: string;
  primaryAction?: {
    label: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
  };
  roleContext?: string;
}

export function AppleTopBar({ title, primaryAction, roleContext = 'venue' }: AppleTopBarProps) {
  const { profile, signOut } = useDashboardAuth() as any;
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(parseAsIST(null));
    const interval = setInterval(() => {
      setCurrentTime(parseAsIST(null));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const timeStr =
    currentTime?.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }) || '--:--';

  const dateStr =
    currentTime?.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    }) || '---';

  return (
    <>
      <header className="h-16 bg-surface-base/80 backdrop-blur-xl border-b border-border-subtle sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Left — Status & Time */}
        <div className="flex items-center gap-3 lg:gap-6">
          {/* System Status */}
          <div className="live-indicator">
            <span className="text-[10px] font-bold text-c1rcle-orange uppercase tracking-widest">
              Live
            </span>
          </div>

          {/* Time Display */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-[14px] font-semibold text-text-primary tabular-nums">
              {timeStr}
            </span>
            <div className="w-px h-4 bg-[var(--border-default)]" />
            <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">
              {dateStr}
            </span>
          </div>
        </div>

        {/* Right — Actions, Search & Profile */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Primary CTA */}
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl bg-[var(--c1rcle-orange)] hover:bg-[var(--c1rcle-orange-dim)] text-white text-[13px] font-bold tracking-wide transition-all shadow-[0_0_20px_var(--c1rcle-orange-glow)] hover:shadow-[0_0_30px_var(--c1rcle-orange-glow)] active:scale-[0.97]"
            >
              {primaryAction.icon && <primaryAction.icon className="w-4 h-4" />}
              <span className="hidden sm:inline">{primaryAction.label}</span>
            </Link>
          )}

          {/* Leaderboard or Quick Search */}
          {roleContext === 'promoter' ? (
            <button
              onClick={() => router.push('/promoter/leaderboard')}
              className="hidden md:flex items-center gap-2 px-3 lg:px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all group"
            >
              <Trophy className="w-4 h-4 text-emerald-500" />
              <span className="hidden lg:block text-[13px] text-emerald-400 font-bold tracking-wide">
                Leaderboard
              </span>
            </button>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-3 px-3 lg:px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle rounded-xl transition-all group"
            >
              <Search className="w-4 h-4 text-text-placeholder group-hover:text-text-tertiary" />
              <span className="hidden lg:block text-[13px] text-text-placeholder font-medium">
                Search...
              </span>
              <div className="hidden xl:flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-tertiary border border-border-subtle">
                <Command className="w-3 h-3 text-text-placeholder" />
                <span className="text-[10px] font-semibold text-text-placeholder">K</span>
              </div>
            </button>
          )}

          {/* Notifications */}
          <NotificationCenter />

          {/* Wallet */}
          <WalletPopover />

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--c1rcle-orange)] flex items-center justify-center text-white text-[11px] font-black">
                {profile?.displayName?.charAt(0).toUpperCase() || '?'}
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-text-tertiary transition-transform duration-200',
                  profileOpen && 'rotate-180',
                )}
              />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-[49]" onClick={() => setProfileOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-56 z-50 rounded-2xl overflow-hidden shadow-2xl"
                    style={{
                      background: 'rgba(22, 22, 22, 0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-[13px] font-bold text-text-primary truncate">
                        {profile?.displayName || 'Account'}
                      </p>
                      <p className="text-[11px] text-text-tertiary truncate mt-0.5">
                        {profile?.email || ''}
                      </p>
                    </div>
                    <div className="py-1.5">
                      <button
                        onClick={() => {
                          router.push(`/${pathname.split('/')[1]}/settings`);
                          setProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          signOut();
                          setProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-[101]"
            >
              <div className="bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-4 px-6 py-4 border-b border-border-subtle">
                  <Search className="w-5 h-5 text-text-tertiary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search events, guests, reports..."
                    autoFocus
                    className="flex-1 bg-transparent text-[16px] text-text-primary placeholder:text-text-placeholder outline-none"
                  />
                  <button
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-1.5 rounded-lg hover:bg-surface-tertiary text-text-tertiary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 py-3 border-b border-border-subtle">
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-2 mb-2">
                    Quick Actions
                  </p>
                  <div className="space-y-1">
                    {[
                      { label: 'Create New Event', href: `/${roleContext.toLowerCase()}/create` },
                      {
                        label: 'View Calendar',
                        href:
                          roleContext?.toLowerCase() === 'promoter'
                            ? '/promoter/events'
                            : `/${roleContext?.toLowerCase()}/calendar`,
                      },
                      { label: 'Manage Events', href: `/${roleContext.toLowerCase()}/events` },
                    ].map((action, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          router.push(action.href);
                          setSearchOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-surface-tertiary transition-colors"
                      >
                        <span className="text-[14px] text-text-primary font-medium">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-6 py-3 bg-surface-secondary border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] text-text-tertiary flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-[10px] font-mono">
                        ↵
                      </kbd>
                      select
                    </span>
                    <span className="text-[11px] text-text-tertiary flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-[10px] font-mono">
                        esc
                      </kbd>
                      close
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
