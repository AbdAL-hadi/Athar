/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        blush: '#f1ddd6',
        rose: '#ead1c8',
        cream: '#f8f2ee',
        line: '#efe3dc',
        ink: '#2b1a14',
        'ink-soft': '#6e5548',
        muted: '#a38373',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 35px rgba(80, 45, 28, 0.08)',
        soft: '0 28px 60px rgba(80, 45, 28, 0.08)',
      },
    },
  },
  plugins: [],
};
