'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Apple, Download, Heart, PlayCircle, X } from 'lucide-react';
import { trackEvent } from '../../../lib/utils/analytics';

export default function AppMarketingLikeGate() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get('reason');
  const eventId = searchParams.get('eventId');
  const returnTo = searchParams.get('returnTo') || '/events';
  const [isOpen, setIsOpen] = useState(reason === 'like');

  useEffect(() => {
    if (reason === 'like') {
      trackEvent('app_like_gate_viewed', { eventId, reason: 'like' });
    }
  }, [eventId, reason]);

  const closeModal = () => {
    setIsOpen(false);
    trackEvent('app_gate_dismissed', { eventId, method: 'x' });
    setTimeout(() => {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      router.push(returnTo);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[40px] border border-white/10 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-2xl sm:p-12"
      >
        <button
          onClick={closeModal}
          className="absolute right-8 top-8 text-white/40 transition-colors hover:text-white"
        >
          <X size={24} />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-10 flex h-24 w-24 items-center justify-center rounded-[32px] border border-white/10 bg-white/5">
            <Heart size={42} className="fill-white/10 text-white" />
            <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
              <Download size={14} />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-display uppercase tracking-widest text-white">
            Download to like
          </h1>
          <p className="mb-10 max-w-xs text-base text-white/50">
            Likes live in the app. Download it to like events and see everyone who&apos;s
            interested.
          </p>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => {
                trackEvent('app_download_clicked', { eventId, platform: 'ios' });
                window.open('https://apps.apple.com/app/the-c1rcle', '_blank');
              }}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white py-4 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-zinc-200"
            >
              <Apple size={20} fill="currentColor" /> App Store
            </button>
            <button
              onClick={() => {
                trackEvent('app_download_clicked', { eventId, platform: 'android' });
                window.open(
                  'https://play.google.com/store/apps/details?id=com.thec1rcle',
                  '_blank',
                );
              }}
              className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
            >
              <PlayCircle size={20} /> Play Store
            </button>
          </div>
          <button
            onClick={closeModal}
            className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-white"
          >
            Continue Browsing
          </button>
        </div>
      </motion.div>
    </div>
  );
}
