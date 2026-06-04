import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation_en.json';
import hiTranslation from './locales/hi/translation_hi.json';
import mrTranslation from './locales/mr/translation_mr.json';

// ─── i18next initialisation ───────────────────────────────────────────────────
// Bundled resources are used instead of a backend plugin so the app works
// fully offline (aligns with the v2.0 PWA / localforage spec requirement).

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation },
      mr: { translation: mrTranslation },
    },

    // Detect from localStorage key 'lng', fallback to English.
    lng: (localStorage.getItem('lng') ?? 'en'),
    fallbackLng: 'en',

    interpolation: {
      // React already escapes by default — no double-escaping needed.
      escapeValue: false,
    },
  });

export default i18n;
