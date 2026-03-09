/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'apple-black': '#000000',
        'apple-dark':  '#0a0a0a',
        'apple-gray':  '#1d1d1f',
        'glass':       'rgba(255,255,255,0.04)',
        'glass-light': 'rgba(255,255,255,0.08)',
        'glass-border':'rgba(255,255,255,0.1)',
        'text-primary':   '#ffffff',
        'text-secondary': 'rgba(255,255,255,0.5)',
        'text-tertiary':  'rgba(255,255,255,0.25)',
        'accent-green':  '#00ff88',
        'accent-red':    '#ff453a',
        'accent-orange': '#ff9f0a',
        'accent-blue':   '#0a84ff',
        'accent-purple': '#bf5af2',
        'accent-pink':   '#ff375f',
        'accent-yellow': '#ffd60a',
        'accent-teal':   '#64d2ff',
      },
      fontFamily: {
        'mono': ['SF Mono','Menlo','Monaco','Courier New','monospace'],
      },
      boxShadow: {
        'glass':    '0 8px 32px rgba(0,0,0,0.5),0 1px 0 rgba(255,255,255,0.08) inset',
        'glass-lg': '0 16px 64px rgba(0,0,0,0.6),0 1px 0 rgba(255,255,255,0.1) inset',
        'glow-green':'0 0 20px rgba(0,255,136,0.3)',
        'glow-red':  '0 0 20px rgba(255,69,58,0.3)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { '0%':{ opacity:'0' }, '100%':{ opacity:'1' } },
        slideUp:  { '0%':{ opacity:'0', transform:'translateY(8px)' }, '100%':{ opacity:'1', transform:'translateY(0)' } },
        pulseDot: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'0.3' } },
      },
    },
  },
  plugins: [],
}
