/**
 * THE C1RCLE — Operator Design Tokens
 * Apple Pro. Operator-First. State-Based Color.
 * 
 * Color is state, not decoration.
 * Every color must answer: "Is this okay, or do I need to act?"
 */

export type RadiusScale = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export const radii: Record<RadiusScale, string> = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  full: "9999px",
};

export type ShadowScale = "subtle" | "card" | "elevated" | "panel";

export const shadows: Record<ShadowScale, string> = {
  subtle: "0 1px 2px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)",
  card: "0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.03)",
  elevated: "0 2px 4px rgba(0,0,0,0.02), 0 12px 24px rgba(0,0,0,0.04)",
  panel: "-20px 0 60px rgba(0,0,0,0.08)",
};

export const blurs = {
  sm: "8px",
  md: "16px",
  lg: "24px",
};

export const spacingScale = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
};

// Neutral warm grey palette
export const palette = {
  // Surfaces
  surface: {
    primary: "#fafaf9",     // Warm off-white
    secondary: "#f5f5f4",   // Stone 100
    tertiary: "#e7e5e4",    // Stone 200
    elevated: "#ffffff",
  },

  // Text hierarchy
  text: {
    primary: "#1c1917",     // Stone 900
    secondary: "#57534e",   // Stone 600
    tertiary: "#a8a29e",    // Stone 400
    placeholder: "#d6d3d1", // Stone 300
  },

  // Borders
  border: {
    subtle: "rgba(0, 0, 0, 0.04)",
    default: "rgba(0, 0, 0, 0.06)",
    strong: "rgba(0, 0, 0, 0.10)",
  },
};

/**
 * Canonical State Colors
 * These are the ONLY colors that should appear in the UI.
 * Each color communicates a specific operational state.
 */
export type StateName = "confirmed" | "pending" | "risk" | "draft" | "neutral";

export const stateTokens: Record<
  StateName,
  {
    color: string;
    bg: string;
    border: string;
    text: string;
  }
> = {
  // 🟢 Confirmed / Locked / Healthy
  confirmed: {
    color: "#059669",       // Emerald 600
    bg: "#ecfdf5",          // Emerald 50
    border: "#a7f3d0",      // Emerald 200
    text: "#065f46",        // Emerald 800
  },

  // 🟡 Pending / Needs Attention
  pending: {
    color: "#d97706",       // Amber 600
    bg: "#fffbeb",          // Amber 50
    border: "#fde68a",      // Amber 200
    text: "#92400e",        // Amber 800
  },

  // 🔴 Risk / Blocked / Problem
  risk: {
    color: "#dc2626",       // Red 600
    bg: "#fef2f2",          // Red 50
    border: "#fecaca",      // Red 200
    text: "#991b1b",        // Red 800
  },

  // 🔵 Draft / Informational
  draft: {
    color: "#4f46e5",       // Indigo 600
    bg: "#eef2ff",          // Indigo 50
    border: "#c7d2fe",      // Indigo 200
    text: "#3730a3",        // Indigo 800
  },

  // ⚪ Neutral / Empty
  neutral: {
    color: "#78716c",       // Stone 500
    bg: "#f5f5f4",          // Stone 100
    border: "#d6d3d1",      // Stone 300
    text: "#57534e",        // Stone 600
  },
};

/**
 * Role-Specific Accent Colors
 * Used only for branding elements (sidebar pill, logo backgrounds)
 * NOT for state indication
 */
export type RoleAccent = "venue" | "host" | "promoter";

export const roleAccents: Record<
  RoleAccent,
  {
    base: string;
    light: string;
  }
> = {
  venue: {
    base: "#292524",        // Stone 800 (Authority)
    light: "#f5f5f4",
  },
  host: {
    base: "#4f46e5",        // Indigo 600 (Creative)
    light: "#eef2ff",
  },
  promoter: {
    base: "#059669",        // Emerald 600 (Money/Success)
    light: "#ecfdf5",
  },
};

// Legacy accent support for backwards compatibility
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
    base: "#4f46e5",
    soft: "rgba(79, 70, 229, 0.1)",
    text: "#4f46e5",
    gradient: "linear-gradient(130deg, #4f46e5, #6366f1)",
    border: "rgba(79, 70, 229, 0.3)",
    shadow: "0 4px 16px rgba(79, 70, 229, 0.2)",
  },
  peach: {
    base: "#f97316",
    soft: "rgba(249, 115, 22, 0.1)",
    text: "#ea580c",
    gradient: "linear-gradient(130deg, #f97316, #fb923c)",
    border: "rgba(249, 115, 22, 0.3)",
    shadow: "0 4px 16px rgba(249, 115, 22, 0.2)",
  },
  emerald: {
    base: "#059669",
    soft: "rgba(5, 150, 105, 0.1)",
    text: "#059669",
    gradient: "linear-gradient(130deg, #059669, #10b981)",
    border: "rgba(5, 150, 105, 0.3)",
    shadow: "0 4px 16px rgba(5, 150, 105, 0.2)",
  },
  rose: {
    base: "#e11d48",
    soft: "rgba(225, 29, 72, 0.1)",
    text: "#e11d48",
    gradient: "linear-gradient(130deg, #e11d48, #f43f5e)",
    border: "rgba(225, 29, 72, 0.3)",
    shadow: "0 4px 16px rgba(225, 29, 72, 0.2)",
  },
};

// Export consolidated tokens
export const tokens = {
  radii,
  shadows,
  blurs,
  spacing: spacingScale,
  palette,
  states: stateTokens,
  roles: roleAccents,
  accents: accentTokens,
};

export const stateNames = Object.keys(stateTokens) as StateName[];
export const accentNames = Object.keys(accentTokens) as AccentName[];

export const getAccentToken = (accent: AccentName = "iris") => accentTokens[accent];
export const getStateToken = (state: StateName = "neutral") => stateTokens[state];
export const getRoleAccent = (role: RoleAccent = "venue") => roleAccents[role];
