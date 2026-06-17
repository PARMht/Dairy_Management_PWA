import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// ─── Language options ─────────────────────────────────────────────────────────
const LANG_OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'mr', label: 'म' },
] as const;

type LangCode = typeof LANG_OPTIONS[number]['code'];

// ─── Routes in "More" sheet ───────────────────────────────────────────────────
const MORE_ROUTES = ['/customers', '/products', '/subscribers', '/logs'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AppLayout
 *
 * Persistent shell rendered by the root route. Children are injected via
 * react-router-dom's <Outlet />.
 *
 * Layout structure:
 *   ┌──────────────────────────────────────────────┐
 *   │  🥛 Dairy Manager                 🟢 Online │  ← minimal top bar
 *   ├──────────────────────────────────────────────┤
 *   │              Page Content (scrollable)        │
 *   ├──────────────────────────────────────────────┤
 *   │   🏠       🥛       💰       🧾       ⋯    │  ← bottom tabs
 *   └──────────────────────────────────────────────┘
 *
 * Styling: exclusively via CSS variables defined in index.css.
 */
export default function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLang = i18n.language as LangCode;

  const [moreOpen, setMoreOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Online/offline reactivity ────────────────────────────────────────────
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Close "More" sheet when navigating ──────────────────────────────────
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleLangChange = (code: LangCode) => {
    void i18n.changeLanguage(code);
    localStorage.setItem('lng', code);
  };

  const handleMoreNavigation = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  // ── Active tab logic ─────────────────────────────────────────────────────
  const isMoreActive = MORE_ROUTES.some(r => location.pathname.startsWith(r));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Minimal Top Bar ─────────────────────────────────────────────── */}
      <header
        style={{
          height: '48px',
          backgroundColor: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-surface-3)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <span
          style={{
            fontWeight: 700,
            fontSize: '1.1rem',
            color: 'var(--color-brand-600)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          🥛 {t('nav.app_title')}
        </span>

        {/* Online / Offline status */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.75rem',
            color: 'var(--color-muted)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-warning)',
              flexShrink: 0,
            }}
          />
          {isOnline ? t('dashboard.status_online') : t('dashboard.status_offline')}
        </span>
      </header>

      {/* ── Page content (router outlet) ─────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <Outlet />
      </main>

      {/* ── Bottom Tab Bar ──────────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        style={{
          height: '64px',
          paddingBottom: 'env(safe-area-inset-bottom)',
          backgroundColor: 'var(--color-surface-2)',
          boxShadow: '0 -2px 10px var(--color-shadow)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        {/* Home Tab */}
        <NavLink
          to="/"
          end
          className="tab-home"
          style={({ isActive }) => tabStyle(isActive)}
        >
          {({ isActive }) => <TabContent emoji="🏠" label={t('nav.home')} isActive={isActive} />}
        </NavLink>

        {/* Route Tab */}
        <NavLink
          to="/route"
          className="tab-route"
          style={({ isActive }) => tabStyle(isActive)}
        >
          {({ isActive }) => <TabContent emoji="🥛" label={t('nav.daily_route')} isActive={isActive} />}
        </NavLink>

        {/* Payments Tab */}
        <NavLink
          to="/payments"
          className="tab-payments"
          style={({ isActive }) => tabStyle(isActive)}
        >
          {({ isActive }) => <TabContent emoji="💰" label={t('nav.payments')} isActive={isActive} />}
        </NavLink>

        {/* Billing Tab */}
        <NavLink
          to="/billing"
          className="tab-billing"
          style={({ isActive }) => tabStyle(isActive)}
        >
          {({ isActive }) => <TabContent emoji="🧾" label={t('nav.billing')} isActive={isActive} />}
        </NavLink>

        {/* More Tab — opens sheet instead of navigating */}
        <button
          type="button"
          className="tab-more"
          onClick={() => setMoreOpen(prev => !prev)}
          style={{
            ...tabStyle(isMoreActive),
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <TabContent emoji="⋯" label={t('nav.more')} isActive={isMoreActive} />
        </button>
      </nav>

      {/* ── "More" Bottom Sheet ──────────────────────────────────────────── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--color-overlay)',
              zIndex: 50,
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: '20px 20px 0 0',
              padding: '16px 24px',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
              maxHeight: '60vh',
              overflowY: 'auto',
              zIndex: 51,
              animation: 'slideUp 300ms ease-out',
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: 'var(--color-surface-3)',
                borderRadius: '2px',
                margin: '0 auto 16px',
              }}
            />

            {/* Navigation items */}
            {[
              { emoji: '👤', labelKey: 'nav.customers',   path: '/customers' },
              { emoji: '📦', labelKey: 'nav.products',    path: '/products' },
              { emoji: '👥', labelKey: 'nav.subscribers', path: '/subscribers' },
              { emoji: '📋', labelKey: 'nav.log_history', path: '/logs' },
            ].map(({ emoji, labelKey, path }) => (
              <button
                key={path}
                type="button"
                onClick={() => handleMoreNavigation(path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  height: '56px',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--color-surface-3)',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
                <span>{t(labelKey as Parameters<typeof t>[0])}</span>
              </button>
            ))}

            {/* Divider */}
            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--color-surface-3)',
                margin: '8px 0',
              }}
            />

            {/* Language switcher row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '56px',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>🌐</span>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  flex: 1,
                }}
              >
                {t('nav.language')}
              </span>
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
                      fontFamily: 'inherit',
                      backgroundColor: currentLang === code ? 'var(--color-brand-600)' : 'transparent',
                      color: currentLang === code ? '#ffffff' : 'var(--color-muted)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Slide-up keyframe animation ──────────────────────────────────── */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Helper: Tab style ────────────────────────────────────────────────────────
function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    flex: 1,
    color: isActive ? 'var(--color-brand-600)' : 'var(--color-muted)',
    transition: 'color 150ms',
    textDecoration: 'none',
    minWidth: 0,
  };
}

// ─── Helper: Tab content ──────────────────────────────────────────────────────
function TabContent({
  emoji,
  label,
  isActive,
}: {
  emoji: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <>
      <span style={{ fontSize: '1.4rem', lineHeight: 1 }} aria-hidden="true">
        {emoji}
      </span>
      {/* Active indicator dot */}
      {isActive && (
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-brand-600)',
            position: 'absolute',
            marginTop: '-2px',
          }}
        />
      )}
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 500,
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {label}
      </span>
    </>
  );
}
