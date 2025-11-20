export type RadiusScale = "xs" | "sm" | "md" | "lg" | "pill" | "full";

export const radii: Record<RadiusScale, string> = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  pill: "999px",
  full: "9999px",
};

export type ShadowScale = "soft" | "card" | "glow" | "floating";

export const shadows: Record<ShadowScale, string> = {
  soft: "0 12px 40px rgba(5,5,9,0.35)",
  card: "0 18px 60px rgba(6,6,20,0.55)",
  glow: "0 25px 80px rgba(255,255,255,0.12)",
  floating: "0 40px 140px rgba(15,15,35,0.75)",
};

export const blurs = {
  sm: "6px",
  md: "12px",
  xl: "24px",
};

export const spacingScale = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  gutter: "min(6vw, 3.5rem)",
};

export const gradients = {
  aurora: "linear-gradient(120deg, rgba(136,69,255,0.8), rgba(255,181,167,0.8))",
  midnight: "linear-gradient(160deg, rgba(5,5,9,0.95), rgba(15,15,25,0.95))",
  peachGlow: "linear-gradient(140deg, #FFB5A7, #FFD7BA, #F5E6D7)",
  emeraldPulse: "linear-gradient(140deg, #0EA5E9, #22D3EE, #14B8A6)",
};

export const palette = {
  base: "#050509",
  surface: "#0B0B14",
  surfaceElevated: "#151522",
  outline: "rgba(255,255,255,0.08)",
  outlineBold: "rgba(255,255,255,0.18)",
  textHigh: "#F9FAFB",
  textMuted: "rgba(249,250,251,0.6)",
  cream: "#F5E6D7",
  peach: "#FFB5A7",
  iris: "#8845FF",
  midnight: "#0A0A12",
};

export type AccentName = "iris" | "peach" | "emerald" | "rose";

export const accentTokens: Record<
  AccentName,
  {
    base: string;
    soft: string;
    text: string;
    gradient: string;
    border: string;
    shadow: string;
  }
> = {
  iris: {
    base: "#8845FF",
    soft: "rgba(136,69,255,0.15)",
    text: "#F5E6D7",
    gradient: "linear-gradient(130deg, #8845FF, #B794FF)",
    border: "rgba(136,69,255,0.6)",
    shadow: "0 15px 30px rgba(136,69,255,0.35)",
  },
  peach: {
    base: "#FF9E80",
    soft: "rgba(255,158,128,0.18)",
    text: "#0A0A12",
    gradient: "linear-gradient(130deg, #FF9E80, #FFD7BA)",
    border: "rgba(255,158,128,0.5)",
    shadow: "0 15px 30px rgba(255,158,128,0.3)",
  },
  emerald: {
    base: "#34D399",
    soft: "rgba(52,211,153,0.18)",
    text: "#04100C",
    gradient: "linear-gradient(130deg, #10B981, #34D399)",
    border: "rgba(52,211,153,0.5)",
    shadow: "0 15px 30px rgba(52,211,153,0.3)",
  },
  rose: {
    base: "#FB7185",
    soft: "rgba(251,113,133,0.2)",
    text: "#2B0A0F",
    gradient: "linear-gradient(130deg, #FB7185, #FDA4AF)",
    border: "rgba(251,113,133,0.5)",
    shadow: "0 15px 30px rgba(251,113,133,0.35)",
  },
};

export const tokens = {
  radii,
  shadows,
  blurs,
  spacing: spacingScale,
  gradients,
  palette,
  accents: accentTokens,
};

export const accentNames = Object.keys(accentTokens) as AccentName[];

export const getAccentToken = (accent: AccentName = "iris") => accentTokens[accent];
