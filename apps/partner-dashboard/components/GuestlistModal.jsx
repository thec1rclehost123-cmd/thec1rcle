"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const palette = ["#FDE047", "#F43F5E", "#A855F7", "#38BDF8", "#34D399", "#F97316"];

const normalizeHandle = (name = "", index) => {
  const safe = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `@${safe || `guest${index + 1}`}`;
};

const fallbackStats = (index) => `${18 + index} events · ${Math.max(3, 4 + index)} months on THE C1RCLE`;

const initials = (value = "") =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function GuestlistModal({ guests = [], open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const hydratedGuests = (guests || []).map((guest, index) => {
    if (typeof guest === "string") {
      return {
        id: `${guest}-${index}`,
        name: guest,
        handle: normalizeHandle(guest, index),
        stats: fallbackStats(index),
        color: palette[index % palette.length]
      };
    }
    return {
      ...guest,
      id: guest.id || `${guest.name}-${index}`,
      handle: guest.handle || normalizeHandle(guest.name, index),
      stats: guest.stats || fallbackStats(index),
      color: guest.color || palette[index % palette.length]
    };
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8 pt-16 backdrop-blur-2xl sm:items-center"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="glass-panel card-hover relative w-full max-w-xl rounded-[40px] border border-white/15 bg-black/80 p-6 text-white shadow-glow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-white/40">Guestlist</p>
                <h3 className="mt-2 text-2xl font-display">Community Going</h3>
                <p className="text-sm text-white/60">Tap follow to add them to your orbit.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
                aria-label="Close guestlist"
              >
                Close
              </button>
            </div>
            <div className="mt-6 max-h-[65vh] space-y-3 overflow-y-auto pr-2">
              {hydratedGuests.map((guest, index) => (
                <motion.div
                  key={guest.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-black"
                      style={{ backgroundColor: guest.color }}
                    >
                      {guest.initials || initials(guest.name)}
                    </span>
                    <div>
                      <p className="text-base font-semibold">{guest.name}</p>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/50">{guest.handle}</p>
                      <p className="text-xs text-white/60">{guest.stats}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] uppercase tracking-[0.35em] text-white/80 transition hover:border-white/50"
                  >
                    Follow
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
