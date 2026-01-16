import type { Variants } from "framer-motion";
import { tokens } from "./design-system/tokens";
import { transitions as motionTransitions, motionPresets, hoverEffects, pageTransitions, type MotionPresetKey } from "./motion";

export const radii = tokens.radii;

export const elevation = {
  none: "none",
  low: tokens.shadows.soft,
  medium: tokens.shadows.card,
  high: tokens.shadows.floating,
  glow: tokens.shadows.glow,
};

export const spacing = tokens.spacing;

export const gradients = tokens.gradients;

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
