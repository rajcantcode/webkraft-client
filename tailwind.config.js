/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        moveX: {
          "0%": { left: "0" },
          "99%": { left: "calc(100% - 0.75rem)" }, // w-3 equals 0.75rem
          "100%": { left: "0" },
        },
      },
      animation: {
        moveX: "moveX 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
