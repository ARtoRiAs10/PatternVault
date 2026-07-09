/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#0f172a",
          panel: "#1e293b",
          accent: "#6366f1",
        },
      },
    },
  },
  plugins: [],
};
