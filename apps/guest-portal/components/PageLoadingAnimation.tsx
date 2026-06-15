'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

/**
 * PageLoadingAnimation - Highly Refined Production Version
 *
 * Features:
 * - Ultra-smooth spring physics for "text slam".
 * - Hardware-accelerated SVG and transform animations.
 * - Responsive sizing with fluid transitions.
 * - Perfectly timed "Portal" exit reveal.
 */
const SPLASH_KEY = 'c1rcle:splash_played';

export default function PageLoadingAnimation() {
  // ⚡ PERF FIX: Only show the splash animation ONCE per browser session.
  // On every subsequent page visit or navigation, skip entirely for instant load.
  const [shouldRender, setShouldRender] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [radius, setRadius] = useState(200);

  useEffect(() => {
    const alreadyPlayed = sessionStorage.getItem(SPLASH_KEY);
    if (!alreadyPlayed) {
      setShouldRender(true);
    }
  }, []);

  const BRAND_COLOR = '#FF3D00';
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);

  useEffect(() => {
    // ⚡ PERF FIX: Only run the whole timing sequence if we're actually rendering.
    if (!shouldRender) return;

    // Mark it as played immediately so future loads skip the splash
    sessionStorage.setItem(SPLASH_KEY, '1');

    const updateSizing = () => {
      const screenWidth = window.innerWidth;
      const newRadius = Math.min(screenWidth * 0.42, 240);
      setRadius(newRadius);
    };

    updateSizing();
    window.addEventListener('resize', updateSizing);

    // Lock scroll only while showing the animation
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const PORTAL_EXPAND_TIME = 2200;
    const COMPONENT_EXIT_TIME = PORTAL_EXPAND_TIME + 1200;

    const portalTimer = setTimeout(() => setIsFinished(true), PORTAL_EXPAND_TIME);
    const exitTimer = setTimeout(() => setIsLoading(false), COMPONENT_EXIT_TIME);

    return () => {
      window.removeEventListener('resize', updateSizing);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      clearTimeout(portalTimer);
      clearTimeout(exitTimer);
    };
  }, [shouldRender]);

  // Optimized Animation Variants
  const portalVariants = {
    initial: { rotate: 0, scale: 0.9, opacity: 0 },
    animate: {
      rotate: 360,
      scale: isFinished ? 2.5 : 1,
      opacity: isFinished ? 0 : 1,
      transition: {
        rotate: { duration: 12, repeat: Infinity, ease: 'linear' },
        scale: { duration: 1.5, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 1, ease: 'easeInOut' },
      },
    },
  };

  const textVariants = {
    initial: { opacity: 0, scale: 1.4, letterSpacing: '0.6em' },
    animate: {
      opacity: 1,
      scale: 1,
      letterSpacing: '-0.03em',
      transition: {
        opacity: { duration: 0.8, delay: 1.1 },
        scale: {
          type: 'spring',
          damping: 15,
          stiffness: 90,
          mass: 1.2,
          delay: 1.1,
        },
        letterSpacing: { duration: 1.4, delay: 1.1, ease: [0.22, 1, 0.36, 1] },
      },
    },
  };

  // ⚡ If already played this session, skip rendering entirely
  if (!shouldRender) return null;

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="splash-container"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black font-heading select-none pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
        >
          {/* Background Layer Reveal */}
          <motion.div
            className="absolute inset-0 bg-black"
            animate={{ opacity: isFinished ? 0 : 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />

          {/* Glowing Portal Ring */}
          <motion.div
            className="absolute flex items-center justify-center will-change-transform"
            variants={portalVariants}
            initial="initial"
            animate="animate"
          >
            <svg
              width={radius * 2.8}
              height={radius * 2.8}
              viewBox={`0 0 ${radius * 2.8} ${radius * 2.8}`}
              className="drop-shadow-[0_0_30px_rgba(255,61,0,0.3)]"
            >
              <defs>
                <linearGradient id="portalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={BRAND_COLOR} stopOpacity="1" />
                  <stop offset="50%" stopColor="#FF8F70" stopOpacity="0.7" />
                  <stop offset="100%" stopColor={BRAND_COLOR} stopOpacity="1" />
                </linearGradient>
              </defs>
              <motion.circle
                cx={radius * 1.4}
                cy={radius * 1.4}
                r={radius}
                stroke="url(#portalGrad)"
                strokeWidth="4.5"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </motion.div>

          {/* Brand Lockup */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* "THE" Prefix */}
            <motion.span
              className="text-white text-xl md:text-2xl font-light tracking-[0.7em] mb-4 uppercase opacity-0"
              animate={{ opacity: 0.5, y: [10, 0] }}
              transition={{ duration: 1.2, delay: 0.8, ease: 'easeOut' }}
            >
              THE
            </motion.span>

            {/* "C1RCLE" Text */}
            <div className="relative flex items-center justify-center px-12 py-6">
              <motion.h1
                className="text-white text-6xl sm:text-7xl md:text-9xl font-black tracking-[-0.03em] uppercase will-change-transform"
                style={{ textShadow: `0 0 40px ${BRAND_COLOR}40` }}
                variants={textVariants}
                initial="initial"
                animate="animate"
              >
                C1RCLE
              </motion.h1>

              {/* Dual Shine Sweep */}
              {[0, 0.15].map((stagger) => (
                <motion.div
                  key={`shine-${stagger}`}
                  className="absolute inset-0 z-20 pointer-events-none"
                  initial={{ x: '-150%', opacity: 0 }}
                  animate={{ x: '180%', opacity: [0, 1, 0] }}
                  transition={{
                    duration: 2, // 2s duration
                    delay: 1.8 + stagger,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  <div className="h-full w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg]" />
                </motion.div>
              ))}
            </div>

            {/* Subtle Progress Bar */}
            <div className="h-[2px] w-64 mt-8 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white/30"
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 2.5, ease: 'easeInOut' }}
              />
            </div>
          </div>

          {/* Background Particles (Subtle Depth) */}
          <div className="absolute inset-0 z-[-1] opacity-20">
            <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse-slow" />
            <div className="absolute bottom-1/3 right-1/4 w-1 h-1 bg-white rounded-full animate-pulse-slow delay-700" />
          </div>

          <style>{`
            @keyframes pulse-slow {
              0%,
              100% {
                opacity: 0.2;
                transform: scale(1);
              }
              50% {
                opacity: 0.6;
                transform: scale(1.5);
              }
            }
            .animate-pulse-slow {
              animation: pulse-slow 4s ease-in-out infinite;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
