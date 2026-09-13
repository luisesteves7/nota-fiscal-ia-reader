import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          500: "#2563eb",
          600: "#1d4ed8",
          900: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
