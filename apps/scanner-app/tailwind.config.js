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
                // Dark theme palette
                background: {
                    primary: "#0A0A0B",
                    secondary: "#141416",
                    elevated: "#1C1C1F",
                    glass: "rgba(28, 28, 31, 0.8)",
                },
                accent: {
                    DEFAULT: "#6366F1",
                    light: "#818CF8",
                    dark: "#4F46E5",
                },
                success: {
                    DEFAULT: "#22C55E",
                    light: "#4ADE80",
                    dark: "#16A34A",
                },
                warning: {
                    DEFAULT: "#F59E0B",
                    light: "#FBBF24",
                    dark: "#D97706",
                },
                error: {
                    DEFAULT: "#EF4444",
                    light: "#F87171",
                    dark: "#DC2626",
                },
                text: {
                    primary: "#FFFFFF",
                    secondary: "#A1A1AA",
                    muted: "#71717A",
                },
                border: {
                    DEFAULT: "#27272A",
                    light: "#3F3F46",
                },
            },
            fontFamily: {
                inter: ["Inter", "system-ui", "sans-serif"],
            },
            fontSize: {
                "display": ["72px", { lineHeight: "1", fontWeight: "900" }],
                "heading": ["32px", { lineHeight: "1.2", fontWeight: "700" }],
                "title": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
                "body": ["16px", { lineHeight: "1.5", fontWeight: "500" }],
                "caption": ["14px", { lineHeight: "1.4", fontWeight: "400" }],
            },
        },
    },
    plugins: [],
};
