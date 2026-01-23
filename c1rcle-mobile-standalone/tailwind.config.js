/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                // Base Colors (Deep Black Mode) - PREMIUM
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

                // Primary brand color - PREMIUM ORANGE
                iris: {
                    DEFAULT: "#F44A22",
                    glow: "#FF6B4A",
                    dim: "#CC3311",
                },

                // Premium accent colors
                pink: {
                    DEFAULT: "#FF2D78",
                    glow: "#FF5E9E",
                    dim: "#CC2460",
                },
                purple: {
                    DEFAULT: "#9B4DFF",
                    glow: "#B87BFF",
                    dim: "#7A3DCC",
                },
                cyan: {
                    DEFAULT: "#00D9FF",
                    glow: "#4DE4FF",
                    dim: "#00ADCC",
                },

                // Text/Metallics - PREMIUM WHITE
                gold: {
                    DEFAULT: "#FFFFFF",
                    light: "#FFFFFF",
                    dark: "#E4E2E3",
                    metallic: "#8A8A8A",
                    stone: "#6B6B6B",
                    rose: "#F44A22",
                },

                // Orange alias (same as iris)
                orange: {
                    DEFAULT: "#F44A22",
                    glow: "#FF6B4A",
                    dim: "#CC3311",
                },

                // Legacy aliases
                midnight: "#0A0A0A",
                silver: "#FFFFFF",
                grey: "#E4E2E3",
                stone: "#6B6B6B",
                cream: "#FEF8E8",
                peach: "#F44A22",

                // Surface colors (Premium Glassmorphism)
                surface: {
                    DEFAULT: "rgba(255, 255, 255, 0.04)",
                    hover: "rgba(255, 255, 255, 0.08)",
                    active: "rgba(255, 255, 255, 0.12)",
                    glass: "rgba(255, 255, 255, 0.06)",
                    elevated: "rgba(30, 30, 30, 0.85)",
                },

                // Semantic colors for app
                success: {
                    DEFAULT: "#00D68F",
                    muted: "rgba(0, 214, 143, 0.15)",
                },
                warning: {
                    DEFAULT: "#FFAA00",
                    muted: "rgba(255, 170, 0, 0.15)",
                },
                error: {
                    DEFAULT: "#FF3D71",
                    muted: "rgba(255, 61, 113, 0.15)",
                },
                info: {
                    DEFAULT: "#0095FF",
                    muted: "rgba(0, 149, 255, 0.15)",
                },
            },

            fontFamily: {
                // Premium fonts
                heading: ["Satoshi-Bold", "System", "sans-serif"],
                body: ["Inter-Regular", "System", "sans-serif"],
                display: ["Satoshi-Black", "System", "sans-serif"],
                satoshi: ["Satoshi-Regular", "System", "sans-serif"],
                "satoshi-medium": ["Satoshi-Medium", "System", "sans-serif"],
                "satoshi-bold": ["Satoshi-Bold", "System", "sans-serif"],
                "satoshi-black": ["Satoshi-Black", "System", "sans-serif"],
                inter: ["Inter-Regular", "System", "sans-serif"],
                "inter-medium": ["Inter-Medium", "System", "sans-serif"],
                "inter-semibold": ["Inter-SemiBold", "System", "sans-serif"],
                "inter-bold": ["Inter-Bold", "System", "sans-serif"],
            },

            fontWeight: {
                light: "300",
                normal: "400",
                medium: "500",
                semibold: "600",
                bold: "700",
                extrabold: "800",
                black: "900",
            },

            // Premium border radii
            borderRadius: {
                bubble: "32px",
                dash: "40px",
                pill: "999px",
                xl: "24px",
                "2xl": "32px",
                "3xl": "48px",
            },

            // Premium shadows with glow effects
            boxShadow: {
                glow: "0 0 40px rgba(244, 74, 34, 0.3)",
                "glow-lg": "0 0 80px rgba(244, 74, 34, 0.45)",
                "glow-pink": "0 0 40px rgba(255, 45, 120, 0.3)",
                "glow-purple": "0 0 40px rgba(155, 77, 255, 0.3)",
                "glow-cyan": "0 0 40px rgba(0, 217, 255, 0.3)",
                card: "0 8px 32px rgba(0, 0, 0, 0.5)",
                elevate: "0 20px 60px rgba(0, 0, 0, 0.7)",
                floating: "0 30px 100px rgba(0, 0, 0, 0.85)",
                glass: "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
            },

            // Premium animations
            animation: {
                shimmer: "shimmer 2.5s linear infinite",
                float: "float 6s ease-in-out infinite",
                "pulse-glow": "pulse-glow 3s ease-in-out infinite",
                "gradient-shift": "gradient-shift 3s ease infinite",
                aurora: "aurora 8s ease-in-out infinite",
            },

            keyframes: {
                shimmer: {
                    "0%": { backgroundPosition: "-1000px 0" },
                    "100%": { backgroundPosition: "1000px 0" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
                "pulse-glow": {
                    "0%, 100%": { opacity: "1", transform: "scale(1)" },
                    "50%": { opacity: "0.8", transform: "scale(1.05)" },
                },
                "gradient-shift": {
                    "0%, 100%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                },
                aurora: {
                    "0%, 100%": { transform: "translateX(0)" },
                    "50%": { transform: "translateX(50px)" },
                },
            },
        },
    },
    plugins: [],
};
