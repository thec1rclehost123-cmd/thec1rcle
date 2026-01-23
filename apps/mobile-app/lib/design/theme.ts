// THE C1RCLE - Design System Theme
// ALIGNED WITH WEBSITE/PLATFORM DESIGN TOKENS

// Colors - EXACT MATCH to platform
export const colors = {
    // Base (Midnight dark mode)
    base: {
        DEFAULT: "#161616",
        50: "#1F1F1F",
        100: "#292929",
        200: "#3D3D3D",
        300: "#525252",
        400: "#666666",
        500: "#808080",
        600: "#999999",
        700: "#B3B3B3",
        800: "#CCCCCC",
        900: "#E6E6E6",
    },

    // Primary brand (Orange/Iris)
    iris: "#F44A22",
    irisGlow: "#FF6B4A",
    irisDim: "#CC3311",

    // Metallics/Text (Gold palette)
    gold: "#FEF8E8",
    goldLight: "#FFFFFF",
    goldDark: "#E4E2E3",
    goldMetallic: "#A8AAAC",
    goldStone: "#A8AAAC",

    // Legacy aliases
    midnight: "#161616",
    silver: "#FEF8E8",
    grey: "#E4E2E3",
    stone: "#A8AAAC",
    cream: "#FEF8E8",
    peach: "#F44A22",

    // Surface colors (glassmorphism)
    surface: "rgba(255, 255, 255, 0.03)",
    surfaceHover: "rgba(255, 255, 255, 0.08)",
    surfaceActive: "rgba(255, 255, 255, 0.12)",

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
    overlayHeavy: "rgba(0, 0, 0, 0.85)",
};

// Gradients - matching website
export const gradients = {
    primary: ["#F44A22", "#FF6B4A"],
    heroFade: ["rgba(22,22,22,0)", "#161616"],
    glass: ["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.01)"],
    holographic: ["rgba(244,74,34,0.2)", "rgba(254,248,232,0.2)", "rgba(168,170,172,0.2)"],
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
