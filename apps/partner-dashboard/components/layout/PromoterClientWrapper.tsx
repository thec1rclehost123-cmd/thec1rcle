'use client';

import { useState, useMemo, useEffect } from 'react';
import { Menu, X, Link2 } from 'lucide-react';
import Link from 'next/link';
import { AppleSidebar } from '@/components/shared/AppleSidebar';
import { AppleTopBar } from '@/components/shared/AppleTopBar';
import { motion, AnimatePresence } from 'framer-motion';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { ThemeToggleCompact } from '@/components/ThemeToggle';
import { BankingBanner } from '@/components/shared/BankingBanner';
import { usePathname, useRouter } from 'next/navigation';

// ── Tab-to-href mapping ────────────────────────────────────────────────────────
const PROMOTER_HREF_TO_TAB: Record<string, string> = {
  '/promoter': 'overview',
  '/promoter/events': 'events',
  '/promoter/links': 'links',
  '/promoter/guests': 'guests',
  '/promoter/analytics': 'analytics',
  '/promoter/finance': 'finance',
  '/promoter/payouts': 'finance',
  '/promoter/partners': 'partners',
  '/promoter/partnerships': 'partners',
  '/promoter/connections': 'partners',
  '/promoter/persona': 'overview',
  '/promoter/profile': 'overview',
  '/promoter/settings': 'overview',
};

function itemTab(href: string): string | null {
  const path = href.split('?')[0];
  if (PROMOTER_HREF_TO_TAB[path]) return PROMOTER_HREF_TO_TAB[path];
  for (const [prefix, tab] of Object.entries(PROMOTER_HREF_TO_TAB)) {
    if (path.startsWith(prefix + '/')) return tab;
  }
  return null;
}

function applyTabVisibility(
  sections: any[],
  tabVisibility: Partial<Record<string, boolean>> | null,
): any[] {
  if (!tabVisibility || Object.keys(tabVisibility).length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item: any) => {
        const tab = itemTab(item.href);
        if (!tab) return true;
        return tabVisibility[tab] !== false;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

interface PromoterClientWrapperProps {
  children: React.ReactNode;
  menuSections: any[];
}

export function PromoterClientWrapper({ children, menuSections }: PromoterClientWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { tabVisibility, loading } = useDashboardAuth();
  const pathname = usePathname();
  const router = useRouter();

  const promoterPrimaryAction = { label: '+ New Link', href: '/promoter/events', icon: Link2 };

  const filteredSections = useMemo(
    () => applyTabVisibility(menuSections, tabVisibility),
    [menuSections, tabVisibility],
  );

  // Redirect to /promoter if the current path maps to a tab the staff can't access
  useEffect(() => {
    if (!tabVisibility || !pathname) return;
    const currentTab = itemTab(pathname);
    if (currentTab && tabVisibility[currentTab] !== true) {
      router.replace('/promoter');
    }
  }, [tabVisibility, pathname, router]);

  // Block render until permissions are resolved
  if (loading) return null;

  return (
    <RoleGuard allowedType="promoter">
      <div className="venue-shell min-h-screen overflow-x-clip bg-[var(--v-canvas)]">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block fixed left-0 top-0 bottom-0 h-full z-50">
          <AppleSidebar
            brandLetter="C"
            brandLabel="Promoter"
            menuSections={filteredSections}
            basePath="/promoter"
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-surface-base/90 backdrop-blur-xl border-b border-border-subtle fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-surface-secondary transition-colors shrink-0"
          >
            <Menu className="h-5 w-5 text-text-primary" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center text-text-inverse text-[11px] font-bold">
              C
            </span>
            <span className="text-[13px] font-bold text-text-primary tracking-wide truncate">
              C1RCLE
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggleCompact />
            <Link
              href="/promoter/events"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--c1rcle-orange)' }}
              title="Events"
            >
              <Link2 className="h-4 w-4 text-white" />
            </Link>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <div className="fixed inset-0 z-[100] lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute inset-y-0 left-0 w-[280px] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-2xl"
              >
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <AppleSidebar
                  brandLetter="C"
                  brandLabel="Promoter"
                  menuSections={filteredSections}
                  basePath="/promoter"
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div
          className={`${isCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'} flex flex-col min-h-screen min-w-0 pt-14 lg:pt-16 transition-all duration-300 ease-in-out`}
        >
          <div
            className={`hidden lg:block fixed top-0 right-0 z-40 transition-all duration-300 ease-in-out ${isCollapsed ? 'left-[80px]' : 'left-[280px]'}`}
          >
            <AppleTopBar primaryAction={promoterPrimaryAction} />
          </div>

          <main className="flex-1 min-w-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6 lg:px-8 lg:py-8 xl:px-10 xl:py-10">
            <BankingBanner />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-[1600px] mx-auto min-w-0"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
