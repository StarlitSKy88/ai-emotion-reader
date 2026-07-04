import type { Config } from "tailwindcss";

/**
 * 问心 AI 设计系统（V3 · Prisma 深色电影感）
 *
 * 设计语言：dark, moody, cinematic + warm cream
 * - 背景：black / #101010 / #212121 三层深色
 * - 主色：#DEDBC8 warm cream（Tailwind primary）
 * - 文字：#E1E0CC（inline style 用，与 primary 略有差异）
 * - 字体：Almarai（全局默认）/ Instrument Serif italic（accent）
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // V3：Prisma 深色电影感调色板
        primary: {
          DEFAULT: "#DEDBC8", // warm cream，主文字/强调
        },
        // 保留旧调色板供渐进迁移（V3 完成后可移除）
        paper: {
          50: "#FDFCF9",
          100: "#FAF8F5",
          200: "#F5F1EA",
          300: "#EDE7DC",
          400: "#DCD2C2",
        },
        ink: {
          50: "#F5F5F5",
          100: "#E5E5E5",
          200: "#A3A3A3",
          300: "#737373",
          400: "#525252",
          500: "#262626",
          600: "#1F1F1F",
          700: "#0A0A0A",
          800: "#050505",
        },
        accent: {
          DEFAULT: "#D97706",
          dark: "#92400E",
        },
      },
      fontFamily: {
        // V3：Almarai 全局默认 + Instrument Serif italic accent
        sans: ['Almarai', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
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
