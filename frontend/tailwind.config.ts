import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/data/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/store/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAF6F0",
        ink: "#17201A",
        muted: "#5E6A63",
        line: "#E2E8E3",
        primary: "#0B6B4E",
        coral: "#E75A4F"
      },
      borderRadius: {
        panel: "8px"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(23, 32, 26, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
