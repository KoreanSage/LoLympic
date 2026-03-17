import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "rgb(var(--color-background) / <alpha-value>)",
          surface: "rgb(var(--color-background-surface) / <alpha-value>)",
          elevated: "rgb(var(--color-background-elevated) / <alpha-value>)",
          overlay: "rgb(var(--color-background-overlay) / <alpha-value>)",
        },
        foreground: {
          DEFAULT: "rgb(var(--color-foreground) / <alpha-value>)",
          muted: "rgb(var(--color-foreground-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-foreground-subtle) / <alpha-value>)",
        },
        accent: {
          gold: "#c9a84c",
          "gold-hover": "#d4b85e",
          "gold-muted": "rgba(201, 168, 76, 0.15)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
          hover: "rgb(var(--color-border-hover) / <alpha-value>)",
          active: "rgb(var(--color-border-active) / <alpha-value>)",
        },
        medal: {
          gold: "#ffd700",
          silver: "#c0c0c0",
          bronze: "#cd7f32",
        },
        status: {
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#3b82f6",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans KR",
          "Noto Sans JP",
          "Noto Sans SC",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "Impact",
          "Noto Sans KR",
          "Noto Sans JP",
          "Noto Sans SC",
          "Arial Black",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15)",
        "soft-lg": "0 2px 8px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.2)",
        "gold-glow": "0 0 12px rgba(201, 168, 76, 0.15), 0 0 4px rgba(201, 168, 76, 0.1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        "scale-in": "scaleIn 0.2s ease-out",
        "fade-up": "fadeUp 0.35s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201, 168, 76, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(201, 168, 76, 0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gold-shimmer":
          "linear-gradient(110deg, #c9a84c 0%, #f0d78c 25%, #c9a84c 50%, #a8893a 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
