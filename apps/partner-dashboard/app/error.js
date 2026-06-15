'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import * as Sentry from '@sentry/nextjs';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-[#030303]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Workspace Error</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          The dashboard encountered a runtime error. This has been logged for review.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center px-4 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Retry Action
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            Refresh Page
          </button>
        </div>

        <button
          onClick={() => (window.location.href = '/')}
          className="mt-6 text-gray-500 hover:text-white text-[11px] font-medium uppercase tracking-widest transition-colors"
        >
          Back to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
