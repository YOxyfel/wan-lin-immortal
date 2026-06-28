/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './assets/site.js'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Cinzel', 'serif'],
        story: ['"Cormorant Garamond"', 'serif'],
      },
      colors: {
        obsidian: { 900: '#050505', 800: '#0a0a0c', 700: '#121214' },
        imperial: { 300: '#FDE047', 400: '#EAB308', 500: '#C28E0E', 800: '#5A4310', 900: '#2E2209' },
        jade: { 400: '#34D399', 500: '#059669', 900: '#022C22' },
        cinnabar: { 500: '#C83232', 800: '#5C1212', 900: '#2D0606' },
      },
    },
  },
  plugins: [],
};
