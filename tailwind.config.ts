/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      colors: {
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-2': 'var(--border-2)',
        tx: 'var(--text)',
        'tx-muted': 'var(--text-muted)',
        'tx-faint': 'var(--text-faint)',
        connected: 'var(--connected)',
        'connected-bg': 'var(--connected-bg)',
        error: 'var(--error)',
        'error-bg': 'var(--error-bg)',
        'code-bg': 'var(--code-bg)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'sm-warm': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'md-warm': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'lg-warm': '0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
