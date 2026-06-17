import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRoute, getMonthlyBill, getCustomers } from '../services/api';
import type { Customer, MonthlyBillResponse, RouteEntry } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  todayDeliveries:  number;
  pendingBalance:   number;
  monthlyBilled:    number;
  activeCustomers:  number;
  subscribersCount: number;
  khataCount:       number;
  pendingCustomers: Array<{ name: string; amount: number }>;
}

// ─── Greeting helper ──────────────────────────────────────────────────────────
function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'dashboard.greeting_morning';
  if (h < 17) return 'dashboard.greeting_afternoon';
  return 'dashboard.greeting_evening';
}

function getGreetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return '☀️';
  if (h < 17) return '🌤️';
  return '🌙';
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
function SkeletonBlock({ width = '60%', height = '2rem' }: { width?: string; height?: string }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '6px',
        background: 'linear-gradient(90deg, var(--color-surface-3) 25%, var(--color-brand-100) 50%, var(--color-surface-3) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

// ─── Carousel component ───────────────────────────────────────────────────────
interface CarouselCardProps {
  slides: React.ReactNode[];
}

function CarouselCard({ slides }: CarouselCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Track current slide via scroll event
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setCurrentSlide(index);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const nextIndex = (currentSlide + 1) % slides.length;
      el.scrollTo({ left: nextIndex * el.clientWidth, behavior: 'smooth' });
    }, 3500);
    return () => clearInterval(timer);
  }, [currentSlide, isPaused, slides.length]);

  // Pause on touch
  const handleTouchStart = useCallback(() => setIsPaused(true),  []);
  const handleTouchEnd   = useCallback(() => setIsPaused(false), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable area */}
      <div
        ref={scrollRef}
        className="hide-scrollbar"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          flex: 1,
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            style={{
              minWidth: '100%',
              scrollSnapAlign: 'start',
              flexShrink: 0,
            }}
          >
            {slide}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '5px',
            marginTop: '8px',
          }}
        >
          {slides.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === currentSlide ? '8px' : '6px',
                height: i === currentSlide ? '8px' : '6px',
                borderRadius: '50%',
                backgroundColor: i === currentSlide
                  ? 'var(--color-brand-600)'
                  : 'var(--color-brand-200)',
                transition: 'all 200ms',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Slide inner content ──────────────────────────────────────────────────────
function SlideContent({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Emoji circle */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-brand-50)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
        }}
      >
        {emoji}
      </div>
      {/* Number */}
      <div
        style={{
          fontSize: '1.8rem',
          fontWeight: 700,
          color: 'var(--color-text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {/* Label */}
      <div
        style={{
          fontSize: '0.8rem',
          color: 'var(--color-muted)',
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Summary card wrapper ─────────────────────────────────────────────────────
function SummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 2px 8px var(--color-shadow)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '140px',
      }}
    >
      {children}
    </div>
  );
}

// ─── Dashboard component ──────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(false);
      try {
        const month = getCurrentMonth();

        const [routeRes, billRes, customersRes] = await Promise.all([
          getRoute('Morning'),
          getMonthlyBill(month),
          getCustomers(null),
        ]);

        if (cancelled) return;

        const routeEntries: RouteEntry[]      = routeRes.data;
        const bill: MonthlyBillResponse       = billRes.data;
        const allCustomers: Customer[]        = customersRes.data;

        // Active customers
        const active      = allCustomers.filter(c => c.is_active);
        const subscribers = active.filter(c => c.is_subscriber);
        const khata       = active.filter(c => !c.is_subscriber);

        const pendingCustomers = (bill.customers ?? [])
          .filter((c) => c.pending_amount > 0)
          .sort((a, b) => b.pending_amount - a.pending_amount)
          .map((c) => ({ name: c.customer_name, amount: c.pending_amount }));

        setData({
          todayDeliveries:  routeEntries.length,
          pendingBalance:   bill.grand_total_pending ?? 0,
          monthlyBilled:    bill.grand_total_billed  ?? 0,
          activeCustomers:  active.length,
          subscribersCount: subscribers.length,
          khataCount:       khata.length,
          pendingCustomers,
        });
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── Quick actions ──────────────────────────────────────────────────────────
  const quickActions = [
    { emoji: '▶',  labelKey: 'dashboard.action_start_route',     path: '/route' },
    { emoji: '💰', labelKey: 'dashboard.action_record_payment',  path: '/payments' },
    { emoji: '➕', labelKey: 'dashboard.action_add_customer',    path: '/customers' },
  ];

  // ── Card 2: Pending Balance slides ────────────────────────────────────────
  const pendingSlides: React.ReactNode[] = [
    <SlideContent
      key="total"
      emoji="💰"
      value={data ? `₹${data.pendingBalance.toLocaleString()}` : '—'}
      label={t('dashboard.pending_balance')}
    />,
    ...(data?.pendingCustomers.slice(0, 5).map((c, i) => (
      <SlideContent
        key={i}
        emoji="👤"
        value={<span style={{ fontSize: '1.3rem' }}>{c.name}</span>}
        label={t('dashboard.pending_amount', { amount: c.amount.toLocaleString() })}
      />
    )) ?? []),
  ];

  // ── Card 4: Active Customers slides ──────────────────────────────────────
  const customersSlides: React.ReactNode[] = [
    <SlideContent
      key="total"
      emoji="👥"
      value={data ? data.activeCustomers : '—'}
      label={t('dashboard.active_customers')}
    />,
    <SlideContent
      key="breakdown"
      emoji="📊"
      value={
        data
          ? <span style={{ fontSize: '1rem', fontWeight: 600 }}>
              {t('dashboard.subscribers_count', { count: data.subscribersCount })}
              {' · '}
              {t('dashboard.khata_count', { count: data.khataCount })}
            </span>
          : '—'
      }
      label={t('dashboard.active_customers')}
    />,
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="page-enter"
      style={{
        padding: '16px',
        paddingBottom: '24px',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      {/* ── Greeting ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-brand-600)',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {t(getGreetingKey())} {getGreetingEmoji()}
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-muted)',
            margin: '4px 0 0',
          }}
        >
          {formatDate()}
        </p>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '0.85rem',
            color: 'var(--color-danger)',
            marginBottom: '16px',
          }}
        >
          ⚠️ Could not load data. Showing partial info.
        </div>
      )}

      {/* ── Summary cards grid ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Today's Deliveries (static) */}
        <SummaryCard>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
              <SkeletonBlock width="36px" height="36px" />
              <SkeletonBlock width="50%" height="1.8rem" />
              <SkeletonBlock width="80%" height="0.9rem" />
            </div>
          ) : (
            <SlideContent
              emoji="🥛"
              value={data?.todayDeliveries ?? '—'}
              label={t('dashboard.today_deliveries')}
            />
          )}
        </SummaryCard>

        {/* Card 2: Pending Balance (carousel) */}
        <SummaryCard>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
              <SkeletonBlock width="36px" height="36px" />
              <SkeletonBlock width="60%" height="1.8rem" />
              <SkeletonBlock width="80%" height="0.9rem" />
            </div>
          ) : (
            <CarouselCard slides={pendingSlides} />
          )}
        </SummaryCard>

        {/* Card 3: Monthly Billed (static) */}
        <SummaryCard>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
              <SkeletonBlock width="36px" height="36px" />
              <SkeletonBlock width="65%" height="1.8rem" />
              <SkeletonBlock width="80%" height="0.9rem" />
            </div>
          ) : (
            <SlideContent
              emoji="🧾"
              value={data ? `₹${data.monthlyBilled.toLocaleString()}` : '—'}
              label={t('dashboard.monthly_billed')}
            />
          )}
        </SummaryCard>

        {/* Card 4: Active Customers (carousel) */}
        <SummaryCard>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
              <SkeletonBlock width="36px" height="36px" />
              <SkeletonBlock width="40%" height="1.8rem" />
              <SkeletonBlock width="80%" height="0.9rem" />
            </div>
          ) : (
            <CarouselCard slides={customersSlides} />
          )}
        </SummaryCard>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '8px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--color-text)',
            margin: '0 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'var(--color-surface-3)',
            }}
          />
          {t('dashboard.quick_actions')}
          <span
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'var(--color-surface-3)',
            }}
          />
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {quickActions.map(({ emoji, labelKey, path }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '14px 16px',
                backgroundColor: 'var(--color-brand-50)',
                border: '1px solid var(--color-brand-200)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--color-brand-600)',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background-color 150ms, transform 100ms',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-brand-100)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-brand-50)';
              }}
              onMouseDown={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{emoji}</span>
              <span>{t(labelKey as Parameters<typeof t>[0])}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Shimmer keyframe ────────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
