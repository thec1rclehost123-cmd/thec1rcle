/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // C1RCLE Brand
        c1rcle: {
          orange: "#F44A22",
          "orange-glow": "rgba(244, 74, 34, 0.25)",
          "orange-dim": "#CC3311",
          "orange-light": "#FF6B4A",
        },
        // Legacy aliases
        iris: {
          DEFAULT: "#F44A22",
          glow: "#FF6B4A",
          dim: "#CC3311",
        },
        orange: {
          DEFAULT: "#F44A22",
          glow: "#FF6B4A",
          dim: "#CC3311",
        },
        // Surfaces
        obsidian: {
          base: "var(--surface-base)",
          surface: "var(--surface-secondary)",
          sidebar: "var(--sidebar-bg)",
          elevated: "var(--surface-elevated)",
        },
        surface: {
          base: "var(--surface-base)",
          secondary: "var(--surface-secondary)",
          tertiary: "var(--surface-tertiary)",
          elevated: "var(--surface-elevated)",
        },
        // Semantic
        midnight: "#0A0A0B",
        silver: "#FAFAFA",
        grey: "#E4E2E3",
        stone: "#A8AAAC",
      },
      spacing: {
        gutter: "min(6vw, 3.5rem)",
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        bubble: "32px",
        dash: "40px",
        pill: "9999px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
        "4xl": "32px",
      },
      fontFamily: {
        heading: ["var(--font-system)", "SF Pro Display", "Inter", "sans-serif"],
        body: ["var(--font-system)", "SF Pro Text", "Inter", "sans-serif"],
        display: ["var(--font-system)", "SF Pro Display", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "SF Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        // Display
        "display-xl": ["56px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display": ["40px", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display-sm": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        // Headlines
        "headline": ["28px", { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-sm": ["22px", { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "600" }],
        // Stats / KPI
        "stat-hero": ["64px", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "600" }],
        "stat-xl": ["48px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "600" }],
        "stat-lg": ["36px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "stat": ["28px", { lineHeight: "1", letterSpacing: "-0.015em", fontWeight: "600" }],
        "stat-sm": ["22px", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "600" }],
        // Body
        "body-lg": ["17px", { lineHeight: "1.6", letterSpacing: "-0.01em" }],
        "body": ["15px", { lineHeight: "1.6", letterSpacing: "-0.01em" }],
        "body-sm": ["14px", { lineHeight: "1.5" }],
        // Captions
        "caption": ["13px", { lineHeight: "1.4" }],
        "label": ["11px", { lineHeight: "1", letterSpacing: "0.04em", fontWeight: "600" }],
        "label-sm": ["10px", { lineHeight: "1", letterSpacing: "0.06em", fontWeight: "700" }],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
        sm: "0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        md: "0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)",
        lg: "0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)",
        xl: "0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.06)",
        glow: "0 0 20px rgba(244, 74, 34, 0.25)",
        "glow-lg": "0 0 40px rgba(244, 74, 34, 0.35)",
        "glow-xl": "0 0 60px rgba(244, 74, 34, 0.4)",
        card: "0 4px 16px rgba(0, 0, 0, 0.08)",
        elevate: "0 12px 40px rgba(0, 0, 0, 0.15)",
        floating: "0 24px 80px rgba(0, 0, 0, 0.2)",
        glass: "inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
      },
      backgroundImage: {
        "hero-fade": "linear-gradient(180deg, rgba(10,10,11,0) 0%, #0A0A0B 100%)",
        "glass-gradient": "linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
        "holographic": "linear-gradient(135deg, rgba(244,74,34,0.2), rgba(254,248,232,0.2), rgba(168,170,172,0.2))",
        "glow-radial": "radial-gradient(circle at center, rgba(244, 74, 34, 0.15) 0%, transparent 70%)",
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        "pulse-glow": {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 74, 34, 0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(244, 74, 34, 0.25)' },
        },
        "fade-in": {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        "slide-up": {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        "slide-down": {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        "scale-in": {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        "pulse-dot": {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.1)' },
        }
      },
      animation: {
        shimmer: 'shimmer 1.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
        "pulse-glow": 'pulse-glow 2s ease-in-out infinite',
        "fade-in": 'fade-in 0.2s ease-out',
        "slide-up": 'slide-up 0.3s ease-out',
        "slide-down": 'slide-down 0.3s ease-out',
        "scale-in": 'scale-in 0.2s ease-out',
        "pulse-dot": 'pulse-dot 2s infinite',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      screens: {
        'xs': '480px',
      },
    }
  },
  plugins: [],
};
