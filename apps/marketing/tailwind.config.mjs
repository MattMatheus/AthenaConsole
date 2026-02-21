/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: '#5bb0ff',
        'brand-strong': '#2c8eff',
        mission: {
          bg: '#081325',
          'bg-alt': '#101e36',
          panel: '#152745',
          text: '#e7edf7',
          muted: '#b8c4d9',
          border: '#2b3e61',
          code: '#0d1a30',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
