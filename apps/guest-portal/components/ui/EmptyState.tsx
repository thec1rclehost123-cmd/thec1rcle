'use client';

import { motion } from 'framer-motion';
import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 px-6 text-center ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center max-w-xs"
      >
        {icon && (
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-glow text-white/40">
            {icon}
          </div>
        )}
        <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-white">{title}</h3>
        <p className="mb-8 text-sm font-medium leading-relaxed text-white/40">{description}</p>
        {action && <div className="w-full max-w-[200px]">{action}</div>}
      </motion.div>
    </div>
  );
}

export default EmptyState;
