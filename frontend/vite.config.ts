import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // ── PWA (offline-first) ────────────────────────────────
    VitePWA({
      registerType: 'autoUpdate',   // silently apply new SW versions
      includeAssets: [               // static files NOT in the Vite bundle graph
        'favicon.svg',
        'icons.svg',
      ],

      // ── App Manifest ──────────────────────────────────────
      manifest: {
        name: 'Dairy Farm Manager',
        short_name: 'DairyMgr',
        description:
          'Offline-first dairy route management, billing & ledger app.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f172a',       // --color-surface
        background_color: '#0f172a',  // --color-surface
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },

      // ── Workbox — strict CacheFirst for app shell ─────────
      workbox: {
        // Precache the entire build output (index.html + JS/CSS bundles).
        // Note: locale JSONs are bundled into the JS via static imports in
        // i18n.ts, so they're already inside the precached JS chunk.
        globPatterns: [
          '**/*.{js,css,html}',         // compiled TSX/CSS bundles + index.html
        ],

        // Runtime caching for assets loaded outside the bundle graph
        runtimeCaching: [
          {
            // Cache the SVG icons / any other static assets
            urlPattern: /\.(?:svg|png|jpg|jpeg|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Google Fonts (if added later)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
})
