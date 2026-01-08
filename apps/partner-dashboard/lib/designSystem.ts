import type { Variants } from "framer-motion";
import { tokens } from "./design-system/tokens";
import { transitions as motionTransitions, motionPresets, hoverEffects, pageTransitions, type MotionPresetKey } from "./motion";

export const radii = tokens.radii;

export const elevation = {
  none: "none",
  low: tokens.shadows.subtle,
  medium: tokens.shadows.card,
  high: tokens.shadows.elevated,
  panel: tokens.shadows.panel,
};

export const spacing = tokens.spacing;

// Gradients for decorative elements
export const gradients = {
  aurora: "linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(236, 72, 153, 0.4) 100%)",
  shimmer: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
};

export const transitions = {
  ...motionTransitions,
};

export { motionPresets, hoverEffects, pageTransitions };

export const hoverStates = {
  whileHover: hoverEffects.scale.whileHover,
  whileTap: hoverEffects.scale.whileTap,
};

export const motionMap: Record<MotionPresetKey, Variants> = motionPresets;

export const glassSurface = "bg-white/5 border border-white/10 backdrop-blur-[24px]";
