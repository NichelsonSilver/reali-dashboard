/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Tokens de marca REALI (fuente de verdad: diseño/paleta.md + DISEÑADOR/PLAYBOOK.md)
      colors: {
        midnight: "#0B1A2E",
        bone: "#F4F1EA",
        graphite: "#1C2433",
        accent: {
          DEFAULT: "#F5A524", // relleno/acción — usar texto Midnight encima
          strong: "#C98410", // iconos y texto grande sobre claro (≥3:1)
          text: "#9A6206", // texto pequeño sobre claro (≥4.5:1, AA)
        },
        // Semánticos: SOLO data viz (aperturas/cierres, estados de mapa)
        positive: "#2D8A6B",
        warning: "#D4A017",
        negative: "#C13B3B",
      },
      fontFamily: {
        display: ['"Archivo Black"', "Inter", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
