import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Las librerías pesadas van en trozos aparte para que un cambio en el
        // código de la app no obligue a volver a descargarlas, y para que el
        // arranque no espere a las que sólo usan pantallas concretas.
        //
        // Vite 8 (Rolldown) requiere una función en vez de un objeto.
        manualChunks(id) {
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/react-router/')) {
            return 'react';
          }
          // recharts NO se declara aquí a propósito: un trozo manual se
          // considera alcanzable desde la entrada y Vite lo precarga, que es
          // justo lo contrario de lo que se busca. Dejándolo automático,
          // acaba dentro de los trozos que lo importan de forma diferida.
          if (id.includes('node_modules/framer-motion/')) {
            return 'motion';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase';
          }
        },
      },
    },
    // Con los trozos ya separados, el aviso de 500 kB sólo generaba ruido.
    chunkSizeWarningLimit: 700,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Fandance',
        short_name: 'Fandance',
        description: 'Investment Portfolio Manager',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})
