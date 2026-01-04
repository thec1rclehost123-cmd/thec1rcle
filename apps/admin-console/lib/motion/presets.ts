import type { Transition, Variants } from "framer-motion";

export const transitions = {
  default: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } as Transition,
  slow: { duration: 0.9, ease: [0.22, 0.1, 0.25, 1] } as Transition,
  fast: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } as Transition,
  springy: { type: "spring", stiffness: 210, damping: 24 } as Transition,
};

export const createFadeInUp = (distance = 32, opacity = 1): Variants => ({
  hidden: { opacity: 0, y: distance },
  visible: { opacity, y: 0 },
});

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const createSlideIn = (direction: "left" | "right" | "up" | "down" = "up", distance = 48): Variants => {
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const multiplier = direction === "left" || direction === "up" ? -1 : 1;
  const hiddenValue = distance * multiplier;
  return {
    hidden: { opacity: 0, [axis]: hiddenValue },
    visible: { opacity: 1, [axis]: 0 },
  };
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

export const motionPresets = {
  fadeIn,
  fadeInUp: createFadeInUp(),
  slideInUp: createSlideIn("up"),
  slideInLeft: createSlideIn("left"),
  slideInRight: createSlideIn("right"),
  slideInDown: createSlideIn("down"),
  scaleIn,
  stagger: staggerContainer,
};

export type MotionPresetKey = keyof typeof motionPresets;

export const hoverEffects = {
  scale: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.985 },
  },
  shadowBloom: {
    whileHover: { scale: 1.01, boxShadow: "0 25px 80px rgba(255,255,255,0.08)" },
    whileTap: { scale: 0.98 },
  },
  pressShrink: {
    whileTap: { scale: 0.94 },
  },
};

export const pageTransitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: transitions.slow,
  },
  slide: (direction: "forward" | "back" = "forward") => ({
    initial: { opacity: 0, x: direction === "forward" ? 40 : -40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction === "forward" ? -40 : 40 },
    transition: transitions.default,
  }),
};

export const shimmerMotion = {
  initial: { backgroundPosition: "0% 0%" },
  animate: {
    backgroundPosition: ["0% 0%", "100% 0%"],
    transition: { duration: 2.4, repeat: Infinity, ease: "linear" },
  },
};
