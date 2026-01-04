/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#161616", // Midnight
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
        iris: {
          DEFAULT: "#F44A22", // Orange
          glow: "#FF6B4A",
          dim: "#CC3311",
        },
        gold: {
          DEFAULT: "#FEF8E8", // Silver
          light: "#FFFFFF",
          dark: "#E4E2E3", // Grey
          metallic: "#A8AAAC", // Stone
          rose: "#F44A22", // Orange as accent
        },
        orange: {
          DEFAULT: "#F44A22",
          glow: "#FF6B4A",
          dim: "#CC3311",
        },
        midnight: "#161616",
        silver: "#FEF8E8",
        grey: "#E4E2E3",
        stone: "#A8AAAC",
        cream: "#FEF8E8", // Mapped to Silver
        peach: "#F44A22", // Mapped to Orange
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.03)",
          hover: "rgba(255, 255, 255, 0.08)",
          active: "rgba(255, 255, 255, 0.12)",
        }
      },
      spacing: {
        gutter: "min(6vw, 3.5rem)"
      },
      borderRadius: {
        bubble: "32px",
        dash: "40px",
        pill: "999px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Satoshi", "Inter", "sans-serif"],
        body: ["var(--font-body)", "Inter", "sans-serif"],
        display: ["var(--font-heading)", "Satoshi", "Inter", "sans-serif"]
      },
      fontWeight: {
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        black: "900"
      },
      boxShadow: {
        glow: "0 0 40px rgba(244, 74, 34, 0.3)",
        "glow-lg": "0 0 80px rgba(244, 74, 34, 0.45)",
        card: "0 8px 32px rgba(0, 0, 0, 0.4)",
        elevate: "0 20px 60px rgba(0, 0, 0, 0.6)",
        floating: "0 30px 100px rgba(0, 0, 0, 0.8)",
        glass: "inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
      },
      backgroundImage: {
        "hero-fade": "linear-gradient(180deg, rgba(22,22,22,0) 0%, #161616 100%)",
        "glass-gradient": "linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
        "holographic": "linear-gradient(135deg, rgba(244,74,34,0.2), rgba(254,248,232,0.2), rgba(168,170,172,0.2))",
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        "pulse-glow": {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(1.05)' },
        }
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
        "pulse-glow": 'pulse-glow 3s ease-in-out infinite',
      }
    }
  },
  plugins: [],
};
