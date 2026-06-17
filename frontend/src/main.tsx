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

// ── Splash dismissal ─────────────────────────────────────
// Total splash animation: 1.8s pour + 0.8s brand reveal = 2.6s
// We wait 3s (pour + brand reveal + 0.4s pause), then fade out.
const splash = document.getElementById('splash');
if (splash) {
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.remove();
      sessionStorage.setItem('splash_shown', '1');
    }, 500); // matches splashFadeOut duration
  }, 3000);
}
