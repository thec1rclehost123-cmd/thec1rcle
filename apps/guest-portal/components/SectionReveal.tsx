"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { type ReactNode } from "react";
import { motionPresets, transitions, type MotionPresetKey } from "../lib/motion";
import { useScrollFade } from "../lib/hooks/useScrollFade";

interface SectionRevealProps {
  variant?: MotionPresetKey;
  delay?: number;
  once?: boolean;
  className?: string;
  children: ReactNode;
}

export default function SectionReveal({ children, className, variant = "fadeInUp", delay = 0, once = true }: SectionRevealProps) {
  const { ref, controls } = useScrollFade({ delay, once });
  const preset = motionPresets[variant] ?? motionPresets.fadeInUp;

  return (
    <motion.div
      ref={ref}
      className={clsx("will-change-transform", className)}
      variants={preset}
      initial="hidden"
      animate={controls}
      transition={{ ...transitions.default, delay }}
    >
      {children}
    </motion.div>
  );
}
