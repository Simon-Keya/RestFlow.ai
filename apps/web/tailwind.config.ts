import type { Config } from "tailwindcss";

/**
 * RestFlow Ops Console — design tokens
 *
 * Palette rationale: a cool slate base (not warm cream) so long shifts staring at
 * inventory tables stay easy on the eyes; a single "sage" accent (deep teal-green,
 * not terracotta/indigo) that reads as "fresh stock / kitchen" without being a cliché;
 * amber reserved strictly for near-expiry/low-stock warnings and red strictly for
 * waste/critical variance, so color always carries meaning in this app rather than
 * decoration.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(210 20% 98%)",
        surface: "hsl(0 0% 100%)",
        "surface-muted": "hsl(210 20% 96%)",
        border: {
          DEFAULT: "hsl(214 16% 88%)",
          strong: "hsl(214 16% 78%)",
        },
        ink: {
          DEFAULT: "hsl(215 25% 15%)",
          muted: "hsl(215 14% 42%)",
          faint: "hsl(215 10% 60%)",
        },
        primary: {
          50: "hsl(168 40% 96%)",
          100: "hsl(168 45% 90%)",
          200: "hsl(168 45% 80%)",
          300: "hsl(168 42% 66%)",
          400: "hsl(168 45% 50%)",
          500: "hsl(168 62% 34%)",
          600: "hsl(168 68% 27%)",
          700: "hsl(168 70% 21%)",
          800: "hsl(168 65% 16%)",
          900: "hsl(168 60% 12%)",
        },
        warning: {
          50: "hsl(38 92% 95%)",
          200: "hsl(38 92% 80%)",
          500: "hsl(38 92% 50%)",
          600: "hsl(32 85% 44%)",
          700: "hsl(26 80% 38%)",
        },
        danger: {
          50: "hsl(4 86% 96%)",
          200: "hsl(4 80% 85%)",
          500: "hsl(4 74% 52%)",
          600: "hsl(4 74% 44%)",
          700: "hsl(4 70% 36%)",
        },
        success: {
          50: "hsl(150 55% 95%)",
          200: "hsl(150 50% 82%)",
          500: "hsl(150 55% 36%)",
          600: "hsl(150 60% 28%)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter-tight)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
      boxShadow: {
        card: "0 1px 2px 0 hsl(215 25% 15% / 0.04), 0 1px 3px 0 hsl(215 25% 15% / 0.06)",
        popover: "0 4px 16px -4px hsl(215 25% 15% / 0.16), 0 2px 6px -2px hsl(215 25% 15% / 0.08)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
