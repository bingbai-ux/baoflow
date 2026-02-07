import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Zen Kaku Gothic New'", "system-ui", "sans-serif"],
      },
      colors: {
        bg: {
          DEFAULT: "#f2f2f0",
          elevated: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          hover: "#fcfcfb",
        },
        border: {
          DEFAULT: "rgba(0,0,0,0.06)",
          solid: "#e8e8e6",
        },
        green: {
          DEFAULT: "#22c55e",
          dark: "#15803d",
          light: "rgba(34,197,94,0.12)",
        },
        black: "#0a0a0a",
        text: {
          DEFAULT: "#0a0a0a",
          mid: "#555555",
          sub: "#888888",
          light: "#bbbbbb",
          mute: "#dddddd",
        },
        status: {
          pending: "#bbbbbb",
          confirmed: "#22c55e",
          warning: "#e5a32e",
          active: "#0a0a0a",
          shipping: "#888888",
        },
      },
      borderRadius: {
        card: "20px",
        button: "8px",
        pill: "9999px",
        input: "10px",
        toggle: "11px",
      },
      spacing: {
        "card-gap": "8px",
        "card-px": "22px",
        "card-py": "20px",
        "page-x": "26px",
        "header": "52px",
      },
      fontSize: {
        // KPI sizes
        "kpi-xl": ["44px", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "kpi-lg": ["36px", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "kpi-md": ["26px", { lineHeight: "1", letterSpacing: "-0.03em" }],
        // Page title
        "page-title": ["36px", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        // Body
        "card-label": ["12.5px", { lineHeight: "1" }],
        "small-val": ["13px", { lineHeight: "1" }],
        "small-label": ["11px", { lineHeight: "1" }],
        "table-header": ["11px", { lineHeight: "1" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
