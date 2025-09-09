import type { Config } from 'tailwindcss'


const config: Config = {
content: [
'./pages/**/*.{ts,tsx}',
'./components/**/*.{ts,tsx}',
'./app/**/*.{ts,tsx}',
],
theme: {
extend: {
container: { center: true, padding: '1rem' },
colors: {
background: 'var(--background)',
foreground: 'var(--foreground)',
muted: 'var(--muted)',
'muted-foreground': 'var(--muted-foreground)',
border: 'var(--border)',
card: 'var(--card)',
'card-foreground': 'var(--card-foreground)',
primary: 'var(--primary)',
'primary-foreground': 'var(--primary-foreground)',
secondary: 'var(--secondary)',
'secondary-foreground': 'var(--secondary-foreground)',
accent: 'var(--accent)',
'accent-foreground': 'var(--accent-foreground)',
success: 'var(--success)',
warning: 'var(--warning)',
danger: 'var(--danger)'
},
borderRadius: {
xl: '1rem',
'2xl': '1.25rem'
},
boxShadow: {
soft: '0 6px 24px -8px rgb(0 0 0 / 0.15)',
lift: '0 10px 30px -10px rgb(0 0 0 / 0.2)'
},
fontFamily: {
sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'Apple Color Emoji', 'Segoe UI Emoji']
}
}
},
plugins: []
}
export default config