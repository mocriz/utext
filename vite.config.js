import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.svg', 'og-image.svg'],
      manifest: {
        name: 'uText — Chat Terenkripsi',
        short_name: 'uText',
        description: 'Chat pribadi terenkripsi end-to-end. Hanya kamu dan lawan bicara yang bisa membaca pesan.',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // precache app shell (JS/CSS/HTML) biar bisa buka tanpa internet
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // jangan cache Supabase API (harus online)
        navigateFallbackDenylist: [/^\/api\//, /^https:\/\/sgmiqkqigfmwgiajaqvo\.supabase\.co/],
        runtimeCaching: [
          {
            // Supabase REST/storage: network-first, jangan cache (data sensitif)
            urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false, // PWA aktif cuma di build (dev tetep normal)
      },
    }),
  ],
})
