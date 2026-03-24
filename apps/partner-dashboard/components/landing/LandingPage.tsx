"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import MagneticButton from "@/components/ui/MagneticButton";

const NightclubScene = dynamic(() => import("./NightclubScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0A0A0B]" />,
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  const router = useRouter();
  const { user, loading, isApproved, profile } = useDashboardAuth();
  const [panDone, setPanDone] = useState(false);

  // If already logged in and approved, go straight to dashboard — skip everything
  useEffect(() => {
    if (loading) return;
    if (user && isApproved && profile) {
      router.replace("/venue");
    }
  }, [loading, user, isApproved, profile, router]);

  // Reveal content after the 3D pan finishes (9s)
  useEffect(() => {
    const t = setTimeout(() => setPanDone(true), 9200);
    return () => clearTimeout(t);
  }, []);

  // While auth is still resolving, show nothing so logged-in users never see the landing
  if (loading) {
    return <div className="w-full h-screen bg-[#0A0A0B]" />;
  }

  // Already logged in — router.replace is in flight, show nothing
  if (user && isApproved && profile) {
    return <div className="w-full h-screen bg-[#0A0A0B]" />;
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-[#0A0A0B]">
      {/* Layer 1: Three.js 3D nightclub scene */}
      <div className="absolute inset-0">
        <NightclubScene />
      </div>

      {/* Layer 2: Bottom-up vignette so text reads against the scene */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, #0A0A0B 0%, rgba(10,10,11,0.75) 40%, transparent 100%)",
        }}
      />

      {/* Top brand label */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="absolute top-7 left-0 right-0 z-20 flex justify-center pointer-events-none"
      >
        <p
          className="text-[22px] font-black uppercase tracking-[0.55em] text-white"
          style={{ textShadow: "0 0 24px rgba(255,255,255,0.3)" }}
        >
          THE C1RCLE
        </p>
      </motion.div>

      {/* Layer 3: HTML content — only visible after pan completes */}
      {panDone && (
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-20 px-6 text-center">
          {/* Main headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.9, delay: 0, ease: [0.4, 0, 0.2, 1] }}
            className="text-[clamp(36px,8vw,72px)] font-black uppercase tracking-tight leading-[1.0] text-white mb-5"
            style={{
              textShadow: "0 0 60px rgba(244,74,34,0.35), 0 2px 40px rgba(0,0,0,0.8)",
            }}
          >
            Command Your
            <br />
            <span style={{ color: "#F44A22" }}>Nightlife Empire</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.7, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="text-[15px] font-bold text-white/55 mb-10 max-w-sm leading-relaxed"
          >
            The all-in-one partner platform for venues, hosts &amp; promoters.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.7, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <MagneticButton href="/login" className="group">
              <span
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-[15px] font-semibold text-white cursor-pointer select-none
                  transition-all duration-200 ease-out
                  group-hover:bg-white/20 group-hover:scale-[1.03]
                  group-active:scale-[0.97]"
                style={{
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                Already a User
              </span>
            </MagneticButton>

            <MagneticButton href="/onboard" className="group">
              <span
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-[15px] font-semibold text-white cursor-pointer select-none
                  transition-all duration-200 ease-out
                  group-hover:brightness-110 group-hover:scale-[1.03]
                  group-active:scale-[0.97]"
                style={{
                  background: "#F44A22",
                  boxShadow: "0 0 40px rgba(244,74,34,0.35), 0 4px 16px rgba(0,0,0,0.4)",
                }}
              >
                Apply for Partner Access
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </span>
            </MagneticButton>
          </motion.div>
        </div>
      )}
    </main>
  );
}
