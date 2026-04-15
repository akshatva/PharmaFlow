import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#d9dee7",
        background: "#f4f7fb",
        surface: "#ffffff",
        foreground: "#142033",
        muted: "#5f6b7a",
        accent: "#0f766e",
        "accent-foreground": "#f7fffd",
      },
      boxShadow: {
        panel: "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
