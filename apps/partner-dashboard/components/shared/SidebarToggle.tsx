'use client';

import { PanelLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarToggleProps {
  isCollapsed: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * SidebarToggle Component
 *
 * A premium, Apple-inspired toggle button for collapsing/expanding the sidebar.
 * Designed to match the minimalist, high-contrast aesthetic of THE C1RCLE.
 */
export function SidebarToggle({ isCollapsed, onClick, className = '' }: SidebarToggleProps) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      className={`
                group relative flex items-center justify-center 
                w-10 h-10 rounded-xl transition-all duration-300
                bg-white/[0.03] hover:bg-white/[0.08]
                border border-white/[0.08] hover:border-white/[0.15]
                text-text-tertiary hover:text-text-primary
                backdrop-blur-sm
                ${className}
            `}
    >
      {/* Subtle inner glow on hover */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <motion.div
        initial={false}
        animate={{ rotate: isCollapsed ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <PanelLeft className="w-5 h-5" strokeWidth={1.5} />
      </motion.div>

      {/* Tooltip-like indicator for active state (optional, keeping it clean) */}
      {isCollapsed && (
        <div className="absolute -right-1 top-0 w-2 h-2 rounded-full bg-orange-500 blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
