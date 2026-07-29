import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0D1B2F",
          soft: "#1F2F44",
          deep: "#07101F",
        },
        arcblue: "#3E74BB",
        sky: {
          DEFAULT: "#5FBFFF",
          soft: "#8FD6FF",
        },
        pale: "#ACC6E9",
        ice: "#E9F2FD",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(13,27,47,0.04), 0 12px 32px -12px rgba(13,27,47,0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
