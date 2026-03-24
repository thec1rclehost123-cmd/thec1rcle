"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

// Separate key from guest portal so sessions are independent
const SPLASH_KEY = "c1rcle:partner_splash_played";

export default function PageLoadingAnimation() {
  const [shouldRender, setShouldRender] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [radius, setRadius] = useState(200);

  useEffect(() => {
    if (!sessionStorage.getItem(SPLASH_KEY)) {
      setShouldRender(true);
    }
  }, []);

  const BRAND_COLOR = "#F44A22"; // partner dashboard orange
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);

  useEffect(() => {
    if (!shouldRender) return;

    sessionStorage.setItem(SPLASH_KEY, "1");

    const updateSizing = () => {
      setRadius(Math.min(window.innerWidth * 0.42, 240));
    };
    updateSizing();
    window.addEventListener("resize", updateSizing);

    // Lock scroll while splash plays
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const PORTAL_EXPAND = 2200;
    const COMPONENT_EXIT = PORTAL_EXPAND + 1200;

    const t1 = setTimeout(() => setIsFinished(true), PORTAL_EXPAND);
    const t2 = setTimeout(() => setIsLoading(false), COMPONENT_EXIT);

    return () => {
      window.removeEventListener("resize", updateSizing);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [shouldRender]);

  const portalVariants = {
    initial: { rotate: 0, scale: 0.9, opacity: 0 },
    animate: {
      rotate: 360,
      scale: isFinished ? 2.5 : 1,
      opacity: isFinished ? 0 : 1,
      transition: {
        rotate: { duration: 12, repeat: Infinity, ease: "linear" },
        scale: { duration: 1.5, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 1, ease: "easeInOut" },
      },
    },
  };

  const textVariants = {
    initial: { opacity: 0, scale: 1.4, letterSpacing: "0.6em" },
    animate: {
      opacity: 1,
      scale: 1,
      letterSpacing: "-0.03em",
      transition: {
        opacity: { duration: 0.8, delay: 1.1 },
        scale: { type: "spring", damping: 15, stiffness: 90, mass: 1.2, delay: 1.1 },
        letterSpacing: { duration: 1.4, delay: 1.1, ease: [0.22, 1, 0.36, 1] },
      },
    },
  };

  if (!shouldRender) return null;

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="partner-splash"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none pointer-events-none"
          style={{ background: "#0A0A0B" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        >
          {/* Background fade-out as portal expands */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "#0A0A0B" }}
            animate={{ opacity: isFinished ? 0 : 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
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
              style={{ filter: "drop-shadow(0 0 30px rgba(244,74,34,0.35))" }}
            >
              <defs>
                <linearGradient id="partnerPortalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor={BRAND_COLOR} stopOpacity="1" />
                  <stop offset="50%"  stopColor="#FF8050"     stopOpacity="0.7" />
                  <stop offset="100%" stopColor={BRAND_COLOR} stopOpacity="1" />
                </linearGradient>
              </defs>
              <motion.circle
                cx={radius * 1.4}
                cy={radius * 1.4}
                r={radius}
                stroke="url(#partnerPortalGrad)"
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
            {/* "THE" prefix */}
            <motion.span
              className="text-white text-xl md:text-2xl font-light tracking-[0.7em] mb-4 uppercase opacity-0"
              animate={{ opacity: 0.5, y: [10, 0] }}
              transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
            >
              THE
            </motion.span>

            {/* "C1RCLE" slam */}
            <div className="relative flex items-center justify-center px-12 py-6">
              <motion.h1
                className="text-white text-6xl sm:text-7xl md:text-9xl font-black uppercase will-change-transform"
                style={{ textShadow: `0 0 40px ${BRAND_COLOR}60` }}
                variants={textVariants}
                initial="initial"
                animate="animate"
              >
                C1RCLE
              </motion.h1>

              {/* Dual shine sweep */}
              {[0, 0.15].map((stagger) => (
                <motion.div
                  key={stagger}
                  className="absolute inset-0 z-20 pointer-events-none"
                  initial={{ x: "-150%", opacity: 0 }}
                  animate={{ x: "180%", opacity: [0, 1, 0] }}
                  transition={{ duration: 2, delay: 1.8 + stagger, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="h-full w-24 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-25deg]" />
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="h-[2px] w-64 mt-8 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(to right, ${BRAND_COLOR}, #FF8050)` }}
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
