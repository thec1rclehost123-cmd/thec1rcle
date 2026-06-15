'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function ActionDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: ActionDrawerProps) {
  // Lock scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl bg-obsidian-surface border-l border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-500 ease-out">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">{title}</h2>
            {subtitle && (
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1.5 opacity-70">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-all text-zinc-500 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{children}</div>

        {/* Footer */}
        {footer && <div className="p-6 border-t border-white/5 bg-white/[0.01]">{footer}</div>}
      </div>
    </div>
  );
}
