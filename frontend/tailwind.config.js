/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f7f7f5',
          100: '#ecf0e7',
          200: '#d9e0cf',
          300: '#c7d1b8',
          400: '#b5c1a1',
          500: '#a3b18a',
          600: '#829270',
          700: '#616d54',
          800: '#414938',
          900: '#20241c',
        },
        secondary: {
          50: '#f0efeb',
          100: '#e8e7e1',
          200: '#e1dfd7',
          300: '#dad7cd',
          400: '#aeab9f',
          500: '#827f72',
          600: '#57554c',
          700: '#2b2a26',
          800: '#20241c',
          900: '#14160f',
        },
        accent: {
          50: '#c7d9c6',
          100: '#abc3aa',
          200: '#8fad8e',
          300: '#73974a',
          400: '#588157',
          500: '#466644',
          600: '#344d33',
          700: '#223322',
          800: '#111a11',
          900: '#0a0f0a',
        },
        dark: {
          50: '#9ad6a0',
          100: '#82b788',
          200: '#6a9870',
          300: '#527958',
          400: '#3a5a40',
          500: '#2e5b25',
          600: '#22441c',
          700: '#172d12',
          800: '#0b1709',
          900: '#080a07',
        },
        darkest: {
          50: '#8ccaa5',
          100: '#76ab8c',
          200: '#608c73',
          300: '#4a6d5a',
          400: '#344e41',
          500: '#2a4924',
          600: '#1f371b',
          700: '#142512',
          800: '#0a1309',
          900: '#060907',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
