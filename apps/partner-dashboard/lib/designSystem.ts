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

// Gradients removed in favor of state-based colors

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
