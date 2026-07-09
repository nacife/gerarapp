import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(6,182,212,0.15), 0 0 40px rgba(6,182,212,0.05)' },
          '50%': { boxShadow: '0 0 35px rgba(6,182,212,0.3), 0 0 70px rgba(6,182,212,0.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'cyan-gradient': 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 50%, #0891b2 100%)',
        'cyan-text': 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #67e8f9 100%)',
        'cyan-radial': 'radial-gradient(circle at center, rgba(6,182,212,0.15) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
};

export default config;
