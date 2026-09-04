import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: { xs: "400px" },
      colors: {
        canvas: "rgb(var(--base) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        well: "rgb(var(--well) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent) / 0.14)",
          faint: "rgb(var(--accent) / 0.07)",
        },
        cipher: {
          DEFAULT: "rgb(var(--cipher) / <alpha-value>)",
          soft: "rgb(var(--cipher) / 0.14)",
        },
        mint: "rgb(var(--mint) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--line) / 0.1)",
          strong: "rgb(var(--line) / 0.18)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgb(255 255 255 / 0.04) inset, 0 12px 40px -20px rgb(0 0 0 / 0.6)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.35), 0 8px 30px -8px rgb(var(--accent) / 0.45)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        reveal: { "0%": { opacity: "0", filter: "blur(6px)" }, "100%": { opacity: "1", filter: "blur(0)" } },
        pulseRing: { "0%": { transform: "scale(0.9)", opacity: "0.6" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
        floatIn: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        reveal: "reveal 420ms ease-out both",
        pulseRing: "pulseRing 1.6s ease-out infinite",
        floatIn: "floatIn 360ms ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
