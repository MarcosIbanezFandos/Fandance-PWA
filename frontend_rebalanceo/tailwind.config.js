/** @type {import('tailwindcss').Config} */

// Los colores salen de variables CSS (definidas en index.css) para que claro y
// oscuro compartan un único juego de nombres semánticos. Una clase como
// `bg-surface` funciona en ambos temas sin arrastrar `dark:` por todas partes.
const withOpacity = (variable) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(${variable}))`
    : `rgb(var(${variable}) / ${opacityValue})`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // En iPhone/Mac manda SF Pro: es la tipografía del sistema y hace que la
        // app deje de parecer una web dentro de un navegador. Inter va detrás
        // porque sus métricas son casi idénticas, así que el resto de
        // plataformas ve el mismo diseño sin reajustar nada.
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', '"Inter Variable"', 'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // --- Superficies ---
        canvas: withOpacity('--c-canvas'),        // fondo de la app
        surface: withOpacity('--c-surface'),      // tarjetas
        'surface-2': withOpacity('--c-surface-2'), // inputs, zonas hundidas
        'surface-3': withOpacity('--c-surface-3'), // hover
        line: withOpacity('--c-line'),            // bordes
        'line-strong': withOpacity('--c-line-strong'),

        // --- Texto ---
        ink: withOpacity('--c-ink'),              // principal
        'ink-2': withOpacity('--c-ink-2'),        // secundario
        'ink-3': withOpacity('--c-ink-3'),        // terciario / etiquetas

        // --- Marca y estados ---
        brand: {
          DEFAULT: withOpacity('--c-brand'),
          soft: withOpacity('--c-brand-soft'),
          ink: withOpacity('--c-brand-ink'),
        },
        positive: withOpacity('--c-positive'),
        'positive-soft': withOpacity('--c-positive-soft'),
        negative: withOpacity('--c-negative'),
        'negative-soft': withOpacity('--c-negative-soft'),
        warning: withOpacity('--c-warning'),
        'warning-soft': withOpacity('--c-warning-soft'),

        // Paleta categórica para gráficos y barras (ver dataviz)
        viz: {
          1: withOpacity('--c-viz-1'),
          2: withOpacity('--c-viz-2'),
          3: withOpacity('--c-viz-3'),
          4: withOpacity('--c-viz-4'),
          5: withOpacity('--c-viz-5'),
          6: withOpacity('--c-viz-6'),
        },
      },
      borderRadius: {
        // Radios de iOS: tarjeta agrupada 12-16pt, control 10-12pt.
        card: '1rem',
        control: '0.75rem',
        field: '0.625rem',
      },
      spacing: {
        // Altura mínima de zona táctil según las HIG. Que sea un token y no un
        // número suelto evita que se vuelva a colar un botón de 32px.
        tap: '2.75rem',   // 44pt
        tabbar: '3.0625rem', // 49pt, la barra de pestañas nativa
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.10)',
        'card-hover': '0 1px 2px rgb(15 23 42 / 0.05), 0 12px 32px -12px rgb(15 23 42 / 0.16)',
        pop: '0 8px 32px -8px rgb(15 23 42 / 0.24), 0 2px 8px -2px rgb(15 23 42 / 0.12)',
      },
      fontSize: {
        // Escala tipográfica de iOS (Dynamic Type en tamaño por defecto). Nada
        // baja de 11pt: por debajo, Apple lo considera ilegible y es justo
        // donde estaba la mitad del texto de esta app.
        'caption2': ['0.6875rem', { lineHeight: '0.8125rem' }],   // 11
        'caption1': ['0.75rem', { lineHeight: '1rem' }],          // 12
        'footnote': ['0.8125rem', { lineHeight: '1.125rem' }],    // 13
        'subhead': ['0.9375rem', { lineHeight: '1.25rem' }],      // 15
        'callout': ['1rem', { lineHeight: '1.3125rem' }],         // 16
        'body': ['1.0625rem', { lineHeight: '1.375rem' }],        // 17
        'title3': ['1.25rem', { lineHeight: '1.5625rem' }],       // 20
        'title2': ['1.375rem', { lineHeight: '1.75rem' }],        // 22
        'title1': ['1.75rem', { lineHeight: '2.125rem' }],        // 28
        'largetitle': ['2.125rem', { lineHeight: '2.5625rem', letterSpacing: '0.008em' }], // 34

        // Etiqueta en versalitas para encabezar bloques de datos.
        'label': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.02em' }],
        'micro': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }],
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
