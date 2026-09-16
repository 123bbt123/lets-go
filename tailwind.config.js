/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbecfe',
          200: '#bfdefe',
          300: '#93c8fd',
          400: '#60a8fa',
          500: '#3b87f6',
          600: '#256aeb',
          700: '#1d54d8',
          800: '#1e47af',
          900: '#1e3f8a',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};