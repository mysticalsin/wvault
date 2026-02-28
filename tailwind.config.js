/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'SF Pro Display',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Segoe UI',
                    'Roboto',
                    'sans-serif',
                ],
            },
            colors: {
                // Dynamic accent based on CSS var
                // defined as --accent: r g b (space separated)
                accent: {
                    DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
                    glow: 'rgb(var(--accent) / 0.25)',
                    light: 'rgb(var(--accent) / 0.15)',
                    dim: 'rgb(var(--accent) / 0.05)',
                },
                glass: {
                    100: 'rgba(255, 255, 255, 0.10)',
                    200: 'rgba(255, 255, 255, 0.20)',
                    300: 'rgba(255, 255, 255, 0.30)',
                    dark: 'rgba(0, 0, 0, 0.25)',
                },
            },
            backdropBlur: {
                xs: '2px',
                glass: '16px',
                heavy: '32px',
            },
            boxShadow: {
                glass: '0 8px 32px rgba(0, 0, 0, 0.25)',
                'glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                glow: '0 0 20px rgb(var(--accent) / 0.3)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.4s ease-out forwards',
                'slide-down': 'slideDown 0.3s ease-out forwards',
                'scale-in': 'scaleIn 0.3s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
};
