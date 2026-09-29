/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sampled from the Google Cloud Console.
        gcp: {
          blue: '#1a73e8',
          'blue-dark': '#1765cc',
          'blue-selected': '#e8f0fe',
          text: '#202124',
          secondary: '#5f6368',
          border: '#dadce0',
          divider: '#e8eaed',
          canvas: '#f8f9fa',
          red: '#d93025',
          'red-dark': '#b3261e',
          green: '#1e8e3e',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Roboto Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // GCP data-density scale.
        'gcp-xs': ['11px', '16px'],
        'gcp-sm': ['12px', '16px'],
        'gcp-base': ['13px', '20px'],
        'gcp-md': ['14px', '20px'],
        'gcp-lg': ['18px', '24px'],
        'gcp-xl': ['22px', '28px'],
      },
      boxShadow: {
        'gcp-1': '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
        'gcp-2': '0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)',
        'gcp-menu': '0 2px 6px 2px rgba(60,64,67,.15), 0 1px 2px 0 rgba(60,64,67,.3)',
      },
    },
  },
  plugins: [],
};
