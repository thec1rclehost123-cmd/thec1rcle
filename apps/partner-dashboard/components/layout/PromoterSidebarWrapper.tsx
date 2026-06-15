'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import {
  LayoutDashboard,
  Ticket,
  Calendar,
  Link2,
  Fingerprint,
  Handshake,
  Wallet,
  Settings,
} from 'lucide-react';
import { AppleSidebar } from '@/components/shared/AppleSidebar';
import { motion, AnimatePresence } from 'framer-motion';

const MENU_SECTIONS = [
  {
    items: [
      { icon: LayoutDashboard, label: 'Overview', href: '/promoter' },
      { icon: Ticket, label: 'Events', href: '/promoter/events' },
      { icon: Calendar, label: 'Calendar', href: '/promoter/calendar' },
    ],
  },
  {
    items: [
      { icon: Link2, label: 'MyLinks', href: '/promoter/links' },
      { icon: Fingerprint, label: 'Persona', href: '/promoter/persona' },
      { icon: Handshake, label: 'Partnerships', href: '/promoter/partnerships' },
    ],
  },
  {
    items: [
      {
        icon: Wallet,
        label: 'Finance',
        href: '/promoter/finance',
        children: [
          { label: 'Overview', href: '/promoter/finance' },
          { label: 'Payout Settings', href: '/promoter/finance/payouts' },
        ],
      },
      { icon: Settings, label: 'Settings', href: '/promoter/settings' },
    ],
  },
];

export function PromoterSidebarWrapper() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:block fixed left-0 top-0 bottom-0 h-full z-50 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[80px]' : 'w-[280px]'}`}
      >
        <AppleSidebar
          brandLetter="P"
          brandLabel="Promoter"
          menuSections={MENU_SECTIONS}
          basePath="/promoter"
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Header */}
      <header className="lg:hidden h-14 bg-surface-base/90 backdrop-blur-xl border-b border-border-subtle fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
        >
          <Menu className="h-5 w-5 text-text-primary" />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center text-text-inverse text-[11px] font-bold">
            P
          </span>
          <span className="text-[13px] font-bold text-text-primary tracking-wide">C1RCLE</span>
        </div>
        <div className="w-9" />
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
                brandLetter="P"
                brandLabel="Promoter"
                menuSections={MENU_SECTIONS}
                basePath="/promoter"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
