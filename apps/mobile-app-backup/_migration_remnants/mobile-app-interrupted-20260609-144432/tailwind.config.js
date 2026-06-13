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
                // Base Colors (Midnight Dark Mode) - EXACT MATCH TO WEBSITE
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

                // Primary brand color - EXACT MATCH
                iris: {
                    DEFAULT: "#F44A22",
                    glow: "#FF6B4A",
                    dim: "#CC3311",
                },

                // Text/Metallics - EXACT MATCH TO WEBSITE
                gold: {
                    DEFAULT: "#FEF8E8",
                    light: "#FFFFFF",
                    dark: "#E4E2E3",
                    metallic: "#A8AAAC",
                    stone: "#A8AAAC", // Alias for compatibility
                    rose: "#F44A22",
                },

                // Orange alias (same as iris)
                orange: {
                    DEFAULT: "#F44A22",
                    glow: "#FF6B4A",
                    dim: "#CC3311",
                },

                // Legacy aliases - EXACT MATCH
                midnight: "#161616",
                silver: "#FEF8E8",
                grey: "#E4E2E3",
                stone: "#A8AAAC",
                cream: "#FEF8E8",
                peach: "#F44A22",

                // Surface colors (Glassmorphism) - EXACT MATCH
                surface: {
                    DEFAULT: "rgba(255, 255, 255, 0.03)",
                    hover: "rgba(255, 255, 255, 0.08)",
                    active: "rgba(255, 255, 255, 0.12)",
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
                // EXACT MATCH to website fonts
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
                black: "900",
            },

            // EXACT MATCH to website
            borderRadius: {
                bubble: "32px",
                dash: "40px",
                pill: "999px",
                xl: "24px",
                "2xl": "32px",
                "3xl": "48px",
            },

            // EXACT MATCH to website shadows
            boxShadow: {
                glow: "0 0 40px rgba(244, 74, 34, 0.3)",
                "glow-lg": "0 0 80px rgba(244, 74, 34, 0.45)",
                card: "0 8px 32px rgba(0, 0, 0, 0.4)",
                elevate: "0 20px 60px rgba(0, 0, 0, 0.6)",
                floating: "0 30px 100px rgba(0, 0, 0, 0.8)",
                glass: "inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
            },

            // EXACT MATCH to website animations
            animation: {
                shimmer: "shimmer 2.5s linear infinite",
                float: "float 6s ease-in-out infinite",
                "pulse-glow": "pulse-glow 3s ease-in-out infinite",
                "gradient-shift": "gradient-shift 3s ease infinite",
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
            },
        },
    },
    plugins: [],
};
