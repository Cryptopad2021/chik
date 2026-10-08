import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0f766e', dark: '#115e59', light: '#14b8a6' },
      },
    },
  },
  plugins: [],
};
export default config;
