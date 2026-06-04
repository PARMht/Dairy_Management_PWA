import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// ─── Typed route map ──────────────────────────────────────────────────────────
// Kept here so any future route additions are in one place and the nav links
// never fall out of sync with the router definition in App.tsx.

interface NavItem {
  /** Must match a path in the createBrowserRouter route tree. */
  to:      string;
  /** i18n key inside the "nav" namespace. */
  labelKey:
    | 'nav.daily_route'
    | 'nav.customers'
    | 'nav.payments'
    | 'nav.products'
    | 'nav.subscribers'
    | 'nav.log_history'
    | 'nav.billing';
  /** Accessible icon label (screen-reader only). */
  emoji:   string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',            labelKey: 'nav.daily_route',  emoji: '🥛' },
  { to: '/customers',   labelKey: 'nav.customers',    emoji: '👤' },
  { to: '/payments',    labelKey: 'nav.payments',     emoji: '💰' },
  { to: '/products',    labelKey: 'nav.products',     emoji: '📦' },
  { to: '/subscribers', labelKey: 'nav.subscribers',  emoji: '👥' },
  { to: '/logs',        labelKey: 'nav.log_history',  emoji: '📋' },
  { to: '/billing',     labelKey: 'nav.billing',      emoji: '🧾' },
];

/** Language options surfaced in the nav switcher. */
const LANG_OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'mr', label: 'म' },
] as const;

type LangCode = typeof LANG_OPTIONS[number]['code'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AppLayout
 *
 * Persistent shell rendered by the root route.  Children are injected via
 * react-router-dom's <Outlet />.
 *
 * Layout structure:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Top nav bar (brand • module tabs • lang switcher)  │
 *   ├─────────────────────────────────────────────────────┤
 *   │  <Outlet /> — page-level content fills this area    │
 *   └─────────────────────────────────────────────────────┘
 *
 * Styling: exclusively via CSS variables defined in index.css.
 * No inline hex values; no Tailwind arbitrary colour literals beyond
 * what maps to the existing tokens.
 */
export default function AppLayout() {
  const { t } = useTranslation();
  const currentLang = i18n.language as LangCode;

  const handleLangChange = (code: LangCode) => {
    void i18n.changeLanguage(code);
    localStorage.setItem('lng', code);
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top navigation bar ───────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-surface-3)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <nav
          style={{
            maxWidth: '64rem',
            margin: '0 auto',
            padding: '0 1rem',
            height: '3.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
          aria-label="Main navigation"
        >
          {/* Brand */}
          <span
            style={{
              fontWeight: 800,
              fontSize: '1rem',
              color: 'var(--color-brand-400)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              marginRight: '0.5rem',
            }}
          >
            🧑‍🌾 {t('nav.app_title')}
          </span>

          {/* Module links */}
          <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
            {NAV_ITEMS.map(({ to, labelKey, emoji }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}   // `end` ensures "/" only matches exactly
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.875rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  backgroundColor: isActive
                    ? 'var(--color-brand-600)'
                    : 'transparent',
                  color: isActive
                    ? '#ffffff'
                    : 'var(--color-muted)',
                })}
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{t(labelKey)}</span>
              </NavLink>
            ))}
          </div>

          {/* Language switcher */}
          <div
            role="group"
            aria-label={t('nav.language')}
            style={{
              display: 'flex',
              gap: '0.25rem',
              padding: '0.25rem',
              borderRadius: '0.625rem',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {LANG_OPTIONS.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLangChange(code)}
                aria-pressed={currentLang === code}
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor:
                    currentLang === code
                      ? 'var(--color-brand-600)'
                      : 'transparent',
                  color:
                    currentLang === code
                      ? '#ffffff'
                      : 'var(--color-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ── Page content (router outlet) ─────────────────────────────────── */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
