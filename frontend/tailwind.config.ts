import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a5f',
        },
        tier: {
          1: '#059669',
          2: '#2563eb',
          3: '#7c3aed',
        },
        status: {
          active: '#059669',
          retired: '#2563eb',
          deferred: '#d97706',
          terminated: '#dc2626',
        },
        // Institutional Warmth palette
        iw: {
          page: '#F8F7F4',
          card: '#FFFFFF',
          warm: '#FDFCF9',
          navy: '#1B2E4A',
          navyLight: '#2D4A6F',
          sage: '#5B8A72',
          sageLight: '#EDF5F0',
          sageDark: '#4A7360',
          gold: '#C49A3C',
          goldLight: '#FBF5E8',
          sky: '#6AADCF',
          coral: '#D4725C',
          border: '#E5E2DC',
          borderLight: '#EDEAE4',
          text: '#2C2A26',
          textSecondary: '#6B6760',
          textTertiary: '#9C9890',
        },
      },
      fontFamily: {
        display: ["'Fraunces'", 'Georgia', 'serif'],
        body: ["'Plus Jakarta Sans'", '-apple-system', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
