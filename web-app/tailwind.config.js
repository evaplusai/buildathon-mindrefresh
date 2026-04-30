/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dashboard palette — DO NOT REMOVE
        surface: {
          900: '#0f172a', // slate-900
          800: '#1e293b', // slate-800
          700: '#334155', // slate-700
        },
        accent: {
          cyan: '#22d3ee',   // cyan-400
          violet: '#8b5cf6', // violet-500
        },
        // Marketing palette — per ADR-013 §Color token mapping
        // Maps to CSS variables in src/styles/marketing-tokens.css
        marketing: {
          green: {
            50:  '#EAF3DE',
            100: '#C0DD97',
            200: '#97C459',
            300: '#7FB13C',
            400: '#639922',
            600: '#3B6D11',
            700: '#2F5A0D',
            800: '#27500A',
            900: '#173404',
          },
          cream:     '#FBF9F2',
          cream2:    '#F5F1E4',
          warmWhite: '#FFFEFA',
          ink:       '#1A2310',
          inkSoft:   '#3D4A2E',
          inkMuted:  '#6B7558',
          rose:      '#C97A6B',
          line:      'rgba(39,80,10,0.12)',
          lineSoft:  'rgba(39,80,10,0.06)',
        },
      },
      fontFamily: {
        // Dashboard font — DO NOT REMOVE
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Marketing fonts — per ADR-013 §Font loading
        serif: ['"Source Serif 4"', 'Georgia', '"Iowan Old Style"', 'serif'],
        sans:  ['"Source Sans 3"', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
