import type { Config } from "tailwindcss";
// @ts-ignore
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "#e2e8f0",
        "border-strong": "#cbd5e1",
        background: "#c3d8e3ff",
        surface: "#ffffff",
        foreground: "#0f172a",
        muted: "#8ba5caff",
        accent: "#2563eb",
        "accent-foreground": "#eff6ff",
        sidebar: {
          DEFAULT: "#0f172a",
          foreground: "#e2e8f0",
          muted: "#94a3b8",
          active: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.05)",
          border: "rgba(255,255,255,0.06)",
        },
      },
      boxShadow: {
        panel: "0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)",
        "panel-lg": "0 4px 12px rgba(15, 23, 42, 0.05)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        aurora: "aurora 60s linear infinite",
      },
      keyframes: {
        aurora: {
          from: {
            backgroundPosition: "50% 50%, 50% 50%",
          },
          to: {
            backgroundPosition: "350% 50%, 350% 50%",
          },
        },
      },
    },
  },
  plugins: [addVariablesForColors],
};

// This plugin adds each Tailwind color as a global CSS variable, e.g. var(--gray-200).
function addVariablesForColors({ addBase, theme }: any) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );

  addBase({
    ":root": newVars,
  });
}

export default config;
