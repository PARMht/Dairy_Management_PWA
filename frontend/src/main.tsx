import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';   // must be imported before App so i18next is ready on first render
import App from './App';

// ── Service Worker (PWA) registration ───────────────────────
// Registers the Workbox-generated SW silently on page load.
// registerSW({ immediate: true }) triggers installation without
// waiting for the user to navigate away — the app shell is
// cached on the very first visit.
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      console.log(`[SW] Registered at ${swUrl}`);
    }
  },
  onOfflineReady() {
    console.log('[SW] App is ready for offline use');
  },
});

// ── React root ──────────────────────────────────────────────
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
