/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Assistant = professional Hebrew UI/body; Rubik = display headings & numbers.
        sans: ['Assistant', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        display: ['Rubik', 'Assistant', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Branded deep indigo-navy — used for the dashboard band and dark surfaces.
        ink: {
          50: '#f3f4fb',
          100: '#e4e6f5',
          200: '#c7cbe9',
          300: '#a3a9d8',
          400: '#7b82c2',
          500: '#565ea8',
          600: '#3f4688',
          700: '#2e3468',
          800: '#20244a',
          900: '#16182d',
          950: '#0e0f1f',
        },
        // Primary brand — indigo.
        brand: {
          50: '#eef1ff',
          100: '#e0e5ff',
          200: '#c6cdff',
          300: '#a3adfc',
          400: '#7f86f8',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#372fa6',
          800: '#2f2a84',
          900: '#2a286b',
        },
        // Accent — technical cyan, used sparingly.
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
        ok: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        fault: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        pending: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      borderRadius: {
        lg: '0.7rem',
        xl: '0.95rem',
        '2xl': '1.25rem',
        '3xl': '1.6rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,18,45,0.04), 0 1px 3px rgba(16,18,45,0.05)',
        soft: '0 8px 28px -12px rgba(16,18,45,0.18)',
        lift: '0 18px 40px -16px rgba(16,18,45,0.30)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        'ring-primary': '0 0 0 4px rgba(79,70,229,0.16)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        pop: 'pop 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
