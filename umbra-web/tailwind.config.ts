import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        umbra: "#16121C",
        penumbra: "#241C2E",
        "penumbra-2": "#2E2539",
        corona: "#E8B04B",
        "corona-soft": "#f0c987",
        ember: "#C6613F",
        bone: "#EFE7D6",
        "bone-dim": "#d8cfbd",
        haze: "#A99BB5",
        "haze-dim": "#7d7188",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
