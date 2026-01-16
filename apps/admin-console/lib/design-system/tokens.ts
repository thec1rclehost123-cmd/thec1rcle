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
  aurora: "linear-gradient(120deg, rgba(244,74,34,0.8), rgba(254,248,232,0.8))",
  midnight: "linear-gradient(160deg, #161616, #1F1F1F)",
  peachGlow: "linear-gradient(140deg, #F44A22, #FF6B4A, #FEF8E8)",
  emeraldPulse: "linear-gradient(140deg, #0EA5E9, #22D3EE, #14B8A6)",
};

export const palette = {
  base: "#161616",
  surface: "#1F1F1F",
  surfaceElevated: "#292929",
  outline: "rgba(255,255,255,0.08)",
  outlineBold: "rgba(255,255,255,0.18)",
  textHigh: "#FEF8E8",
  textMuted: "rgba(254,248,232,0.6)",
  cream: "#FEF8E8",
  peach: "#F44A22",
  iris: "#F44A22",
  midnight: "#161616",
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
    base: "#F44A22",
    soft: "rgba(244,74,34,0.15)",
    text: "#FEF8E8",
    gradient: "linear-gradient(130deg, #F44A22, #FF6B4A)",
    border: "rgba(244,74,34,0.6)",
    shadow: "0 15px 30px rgba(244,74,34,0.35)",
  },
  peach: {
    base: "#FF6B4A",
    soft: "rgba(255,107,74,0.18)",
    text: "#161616",
    gradient: "linear-gradient(130deg, #FF6B4A, #FEF8E8)",
    border: "rgba(255,107,74,0.5)",
    shadow: "0 15px 30px rgba(255,107,74,0.3)",
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
