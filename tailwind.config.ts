import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 编辑设计风格的暖米色调色板
        paper: {
          50: "#FDFCF9",   // 最浅的米色
          100: "#FAF8F5",  // 主背景
          200: "#F5F1EA",  // 卡片背景
          300: "#EDE7DC",  // 边框
          400: "#DCD2C2",  // 次要边框
        },
        ink: {
          50: "#F5F5F5",
          100: "#E5E5E5",
          200: "#A3A3A3",
          300: "#737373",
          400: "#525252",
          500: "#262626",
          600: "#1F1F1F",
          700: "#0A0A0A",  // 主文字
          800: "#050505",
        },
        accent: {
          DEFAULT: "#D97706", // 暖橘色 - 仅用于最关键的 CTA
          dark: "#92400E",
        },
        deep: {
          DEFAULT: "#1A1F2E", // 深蓝黑 - 用于深色块
          light: "#2A3142",
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        'instrument-serif': ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // 编辑设计风格的排版尺度
        'display-xl': ['5rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-lg': ['3.75rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-md': ['2.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-sm': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '500' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
        'fade-up': 'fadeUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;