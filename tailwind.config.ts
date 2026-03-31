import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "!./components/_unused/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* 메인/보조 색상은 CSS 변수로 통일. 기본값: app/globals.css :root, 런타임: SiteThemeStyles가 DB 설정으로 덮어씀 */
      colors: {
        site: {
          bg: "var(--site-bg)",
          card: "var(--site-card)",
          text: {
            DEFAULT: "var(--site-text)",
            muted: "var(--site-text-muted)",
          },
          border: "var(--site-border)",
          primary: "var(--site-primary)",
          secondary: "var(--site-secondary)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
