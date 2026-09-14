import type { Config } from "tailwindcss";

/**
 * F&C Design System (FC_Portal_UI_mockups 由来)。
 * 基本5色 + 派生12色以外の色は作らない。
 * 旧トークン名 (bg/card/border/green/black/text/status) は互換のため
 * F&C パレットへ再マッピングして残す。新規コードは fc-* を使う。
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 英数 = Manrope / かなカナ漢字 = M PLUS 2(指定順で自動振り分け)
        display: ["var(--font-manrope)", "var(--font-mplus)", "system-ui", "sans-serif"],
        body: ["var(--font-manrope)", "var(--font-mplus)", "system-ui", "sans-serif"],
      },
      colors: {
        // --- F&C 基本5色 ---
        wasabi: { DEFAULT: "#E9F056", ink: "#666C14" },
        orange: { DEFAULT: "#FF5C34", tint: "#FFD8C2", ink: "#B03616" },
        coolblue: { DEFAULT: "#D7EFFF", ink: "#33566F" },
        cassis: { DEFAULT: "#351E28", tint: "#C9A2B8", soft: "#9C8290" },
        sauge: { DEFAULT: "#AEB8A0", ink: "#4C5544" },
        // --- 派生ニュートラル ---
        line: "#E2E1DA",
        ink: { soft: "#84787D" },
        // --- 旧トークン名の互換マッピング ---
        bg: {
          DEFAULT: "#EFEFEA",
          elevated: "#FFFFFF",
        },
        card: {
          DEFAULT: "#FFFFFF",
          hover: "#FBFAF6",
          soft: "#FBFAF6",
        },
        border: {
          DEFAULT: "#E2E1DA",
          solid: "#E2E1DA",
        },
        green: {
          DEFAULT: "#E9F056", // Wasabi(今ここ・次にやること)
          dark: "#666C14",    // Wasabi Ink(Wasabi面の文字)
          light: "rgba(233,240,86,0.35)",
        },
        black: "#351E28",     // Cassis(ナビの面・本文・基準線)
        text: {
          DEFAULT: "#351E28",
          mid: "#351E28",
          sub: "#84787D",
          light: "#AEB8A0",
          mute: "#E2E1DA",
        },
        status: {
          pending: "#AEB8A0",   // 見積中 = Sauge
          confirmed: "#666C14", // 確定 = Wasabi Ink
          warning: "#B03616",   // 要対応 = Orange Ink
          active: "#351E28",    // 進行中 = Cassis
          shipping: "#84787D",  // 配送中 = Ink Soft
        },
      },
      borderRadius: {
        card: "16px",    // カード・リスト行・表の外周
        button: "999px", // 操作はピル
        pill: "9999px",
        input: "12px",   // 入力欄・メニュー項目
        toggle: "11px",
        frame: "24px",   // 画面の外枠・サイドバー
      },
      boxShadow: {
        frame: "0 20px 50px rgba(53,30,40,.12)", // 影は画面の外枠1箇所のみ
      },
      spacing: {
        "card-gap": "8px",
        "card-px": "16px",
        "card-py": "16px",
        "page-x": "26px",
        "header": "52px",
      },
      fontSize: {
        // F&C: 文字5段 + 主要数値24px。KPIは24pxを上限とする
        "kpi-xl": ["24px", { lineHeight: "1", letterSpacing: "0" }],
        "kpi-lg": ["21px", { lineHeight: "1", letterSpacing: "0" }],
        "kpi-md": ["18px", { lineHeight: "1", letterSpacing: "0" }],
        "page-title": ["21px", { lineHeight: "1.3", letterSpacing: "0" }],
        "card-label": ["12.5px", { lineHeight: "1" }],
        "small-val": ["12.5px", { lineHeight: "1" }],
        "small-label": ["11px", { lineHeight: "1" }],
        "table-header": ["11px", { lineHeight: "1" }],
      },
      transitionTimingFunction: {
        fc: "cubic-bezier(.2,.6,.3,1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
