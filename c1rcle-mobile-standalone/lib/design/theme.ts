// THE C1RCLE - Premium Design System Theme
// INSPIRED BY HIGH-END MOBILE DESIGNS - GLASSMORPHISM, HOLOGRAPHIC, NEON

// Colors - Premium Palette
export const colors = {
    // Base (Midnight dark mode)
    base: {
        DEFAULT: "#0A0A0A",
        50: "#121212",
        100: "#1A1A1A",
        200: "#252525",
        300: "#333333",
        400: "#4D4D4D",
        500: "#666666",
        600: "#808080",
        700: "#999999",
        800: "#B3B3B3",
        900: "#CCCCCC",
    },

    // Primary brand (Orange/Iris)
    iris: "#F44A22",
    irisGlow: "#FF6B4A",
    irisDim: "#CC3311",

    // Premium accent colors (from reference designs)
    pink: "#FF2D78",
    pinkGlow: "#FF5E9E",
    pinkDim: "#CC2460",

    purple: "#9B4DFF",
    purpleGlow: "#B87BFF",
    purpleDim: "#7A3DCC",

    cyan: "#00D9FF",
    cyanGlow: "#4DE4FF",
    cyanDim: "#00ADCC",

    // Metallics/Text (Gold palette)
    gold: "#FFFFFF",
    goldLight: "#FFFFFF",
    goldDark: "#E4E2E3",
    goldMetallic: "#8A8A8A",
    goldStone: "#6B6B6B",

    // Legacy aliases
    midnight: "#0A0A0A",
    silver: "#FFFFFF",
    grey: "#E4E2E3",
    stone: "#6B6B6B",
    cream: "#FEF8E8",
    peach: "#F44A22",

    // Surface colors (glassmorphism)
    surface: "rgba(255, 255, 255, 0.04)",
    surfaceHover: "rgba(255, 255, 255, 0.08)",
    surfaceActive: "rgba(255, 255, 255, 0.12)",
    surfaceGlass: "rgba(255, 255, 255, 0.06)",
    surfaceElevated: "rgba(30, 30, 30, 0.85)",

    // Semantic
    success: "#00D68F",
    successMuted: "rgba(0, 214, 143, 0.15)",
    warning: "#FFAA00",
    warningMuted: "rgba(255, 170, 0, 0.15)",
    error: "#FF3D71",
    errorMuted: "rgba(255, 61, 113, 0.15)",
    info: "#0095FF",
    infoMuted: "rgba(0, 149, 255, 0.15)",

    // Overlay
    overlay: "rgba(0, 0, 0, 0.6)",
    overlayHeavy: "rgba(0, 0, 0, 0.9)",
    overlayGlass: "rgba(10, 10, 10, 0.75)",
};

// Premium Gradients
export const gradients = {
    // Primary brand
    primary: ["#F44A22", "#FF6B4A"],
    primaryReverse: ["#FF6B4A", "#F44A22"],

    // Holographic/Rainbow
    holographic: ["#00D9FF", "#9B4DFF", "#FF2D78", "#F44A22"],
    sunset: ["#FF2D78", "#F44A22", "#FFAA00"],
    aurora: ["#00D9FF", "#9B4DFF", "#FF2D78"],

    // Neon Pink (for influencer/creator sections)
    neonPink: ["#FF2D78", "#FF5E9E"],

    // Deep Purple (for tickets/cinema)
    deepPurple: ["#1a0b2e", "#2d1b4e", "#4a2070"],

    // Glass effects
    glass: ["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.02)"],
    glassStrong: ["rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.04)"],
    glassAccent: ["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"],

    // Hero fades
    heroFade: ["transparent", "rgba(10,10,10,0.3)", "rgba(10,10,10,0.8)", "#0A0A0A"],
    heroFadeSubtle: ["transparent", "rgba(10,10,10,0.6)"],

    // Card overlays
    cardOverlay: ["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.95)"],
};

// Spacing
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,
};

// Border radii - EXACT MATCH to website
export const radii = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
    "3xl": 48,
    bubble: 32,
    dash: 40,
    pill: 999,
};

// Typography
export const typography = {
    fontFamily: {
        heading: "Satoshi-Bold",
        body: "Inter-Regular",
        display: "Satoshi-Black",
    },
    fontSize: {
        xs: 10,
        sm: 12,
        base: 14,
        md: 16,
        lg: 18,
        xl: 20,
        "2xl": 24,
        "3xl": 30,
        "4xl": 36,
        "5xl": 48,
    },
};

// Shadows - EXACT MATCH to website
export const shadows = {
    glow: {
        shadowColor: "#F44A22",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 40,
        elevation: 15,
    },
    glowLg: {
        shadowColor: "#F44A22",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 80,
        elevation: 20,
    },
    card: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
        elevation: 10,
    },
    elevate: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 60,
        elevation: 15,
    },
    floating: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 30 },
        shadowOpacity: 0.8,
        shadowRadius: 100,
        elevation: 20,
    },
};

// Animation configs
export const animations = {
    duration: {
        fast: 150,
        normal: 250,
        slow: 400,
    },
    spring: {
        snappy: { damping: 15, stiffness: 400 },
        bouncy: { damping: 10, stiffness: 300 },
        smooth: { damping: 20, stiffness: 200 },
    },
    stagger: {
        fast: 30,
        normal: 50,
        slow: 80,
    },
};

export default {
    colors,
    gradients,
    spacing,
    radii,
    typography,
    shadows,
    animations,
};
