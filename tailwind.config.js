/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Heebo is the single system typeface; hierarchy comes from weight.
        sans: ['Heebo', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        display: ['Heebo', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      colors: {
        // Official navy — header, official emphasis.
        navy: {
          50: '#eef2f8',
          100: '#d8e0ee',
          200: '#b0c1db',
          300: '#809ac2',
          400: '#5273a4',
          500: '#345286',
          600: '#233f6c',
          700: '#1a3059',
          800: '#132646',
          900: '#0e1f3a',
          950: '#081426',
        },
        // Neutral-dark (headings / text) — a cool near-navy.
        ink: {
          50: '#f4f6f9',
          100: '#e7ebf1',
          200: '#cfd6e2',
          300: '#aeb8ca',
          400: '#7f8ba3',
          500: '#5a6579',
          600: '#414b5c',
          700: '#2d3644',
          800: '#1c2430',
          900: '#0f1726',
          950: '#080d17',
        },
        // Official action blue (buttons, links).
        brand: {
          50: '#eff5ff',
          100: '#dbe7fe',
          200: '#bed2fc',
          300: '#91b4f9',
          400: '#5e8cf4',
          500: '#3b6ae8',
          600: '#1d4ed8',
          700: '#1a41b3',
          800: '#1b3a91',
          900: '#1b3576',
        },
        ok: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
        fault: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
        },
        pending: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
        },
      },
      borderRadius: {
        none: '0',
        sm: '0.25rem',
        DEFAULT: '0.3125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.625rem',
        '2xl': '0.75rem',
        '3xl': '0.875rem',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.05)',
        soft: '0 2px 6px rgba(15,23,42,0.07)',
        header: '0 1px 0 rgba(15,23,42,0.10)',
        modal: '0 20px 45px -20px rgba(8,20,38,0.45)',
        none: 'none',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Gentle, premium entrance + ambient motion for the login screen.
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(-1.2deg)' },
        },
        'float-slower': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(10px) scale(1.03)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.16s ease-out',
        'scale-in': 'scale-in 0.16s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
        'rise-in': 'rise-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'float-slow': 'float-slow 11s ease-in-out infinite',
        'float-slower': 'float-slower 16s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
