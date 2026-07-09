import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EduForge',
        short_name: 'EduForge',
        description: 'Aprendizagem interativa gerada pela EduForge.',
        theme_color: '#0ea5e9',
        background_color: '#0b1120',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  optimizeDeps: {
    exclude: ['@eduforge/schemas'],
  },
  resolve: {
    alias: {
      'node:crypto': 'node:crypto',
    },
  },
});
