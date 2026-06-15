'use client';
import { motion } from 'framer-motion';

export default function Loading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-black px-6 py-20 flex flex-col items-center justify-center"
    >
      <div className="w-full max-w-lg space-y-12">
        <div className="space-y-4">
          <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse" />
          <div className="h-10 w-64 bg-white/10 rounded-xl animate-pulse" />
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 w-full rounded-[28px] border border-white/5 bg-white/[0.02] p-6 flex gap-6 animate-pulse"
            >
              <div className="h-full aspect-[3/4] rounded-xl bg-white/5" />
              <div className="flex-1 py-2 space-y-4">
                <div className="h-6 w-3/4 bg-white/5 rounded-lg" />
                <div className="h-4 w-1/2 bg-white/5 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
