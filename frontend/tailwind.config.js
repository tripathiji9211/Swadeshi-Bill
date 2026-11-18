/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Baloo 2"', 'Poppins', 'sans-serif'],
        body: ['Mukta', 'Hind', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Swadeshi Khata Authentic Indian Palette
        saffron: {
          DEFAULT: '#FF9933',
          muted: 'rgba(255, 153, 51, 0.15)',
          glow: 'rgba(255, 153, 51, 0.45)',
          dark: '#E07D1E',
        },
        indiagreen: {
          DEFAULT: '#138808',
          muted: 'rgba(19, 136, 8, 0.15)',
          glow: 'rgba(19, 136, 8, 0.45)',
          light: '#23B015',
        },
        gold: {
          DEFAULT: '#D4A017',
          muted: 'rgba(212, 160, 23, 0.15)',
          glow: 'rgba(212, 160, 23, 0.45)',
          light: '#F3C044',
        },
        kumkum: {
          DEFAULT: '#B3202A',
          muted: 'rgba(179, 32, 42, 0.15)',
          glow: 'rgba(179, 32, 42, 0.45)',
          light: '#D33842',
        },
        warmwhite: '#F5EFE6',
        warmmuted: '#A59E92',
        warmdim: '#656057',

        // Core Neutral Command Dashboard Tokens
        bg: '#000000',
        surface: {
          DEFAULT: '#0A0A0A',
          2: '#111111',
          3: '#161618',
        },
        border: {
          DEFAULT: '#1C1C1F',
          strong: '#2A2A2E',
        },
        txt: {
          DEFAULT: '#F5EFE6',
          muted: '#A59E92',
          dim: '#656057',
        },
        // Accents
        cyan: {
          DEFAULT: '#2DD4D4',
          muted: 'rgba(45, 212, 212, 0.12)',
        },
        periwinkle: {
          DEFAULT: '#8B8DFF',
          muted: 'rgba(139, 141, 255, 0.12)',
        },
        ok: {
          DEFAULT: '#34D399',
          muted: 'rgba(52, 211, 153, 0.12)',
        },
        warn: {
          DEFAULT: '#F5B544',
          muted: 'rgba(245, 181, 68, 0.12)',
        },
        danger: {
          DEFAULT: '#F87171',
          muted: 'rgba(248, 113, 113, 0.12)',
        },
        // Allowed accents for testimonials and CTA
        lime: {
          DEFAULT: '#C6FF3D',
          dark: '#9ECE1F',
        },
        mint: {
          DEFAULT: '#CFE9E4',
          dark: '#A6CDC6',
        },
        // Mapped legacy tokens (strictly neutralized: pure black & grey)
        dark: {
          950: '#000000',
          900: '#0A0A0A',
          850: '#0A0A0A',
          800: '#111111',
          750: '#161618',
          700: '#1C1C1F',
          600: '#2A2A2E',
          500: '#52555C',
        },
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4D4',
          DEFAULT: '#2DD4D4',
          500: '#2DD4D4',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
          glow: 'rgba(45, 212, 212, 0.4)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '8px',
        xl: '8px',
        '2xl': '8px',
        '3xl': '8px',
      },
      boxShadow: {
        'glow-cyan': '0 0 8px rgba(45, 212, 212, 0.4)',
        'glow-periwinkle': '0 0 8px rgba(139, 141, 255, 0.4)',
        'glow-ok': '0 0 8px rgba(52, 211, 153, 0.4)',
        'glow-warn': '0 0 8px rgba(245, 181, 68, 0.4)',
        'glow-danger': '0 0 8px rgba(248, 113, 113, 0.4)',
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.6)',
      },
      letterSpacing: {
        tech: '0.12em',
      },
      lineHeight: {
        tightest: '1.05',
      },
    },
  },
  plugins: [],
};
