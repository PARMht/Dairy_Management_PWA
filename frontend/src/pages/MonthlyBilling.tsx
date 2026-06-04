import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonthlyBillEntry, MonthlyBillResponse } from '../types';
import { getMonthlyBill } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n);
}

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

interface SummaryBarProps {
  billed: number;
  paid: number;
  pending: number;
}

function SummaryBar({ billed, paid, pending }: SummaryBarProps) {
  const { t } = useTranslation();

  const stats = [
    { label: t('billing.grand_total'),   value: billed,  color: 'var(--color-brand-400)' },
    { label: t('billing.grand_paid'),    value: paid,    color: '#34d399' },
    { label: t('billing.grand_pending'), value: pending, color: '#f59e0b' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.75rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '1rem',
        border: '1px solid var(--color-surface-3)',
        marginBottom: '1.5rem',
      }}
    >
      {stats.map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.375rem',
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color,
              letterSpacing: '-0.02em',
            }}
          >
            {fmt(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Customer Bill Card ───────────────────────────────────────────────────────

interface BillCardProps {
  entry: MonthlyBillEntry;
  monthLabel: string;
}

function BillCard({ entry, monthLabel: mLabel }: BillCardProps) {
  const { t } = useTranslation();

  const buildWhatsAppUrl = () => {
    const msg = t('billing.whatsapp_message', {
      month:   mLabel,
      name:    entry.customer_name,
      total:   Number(entry.total_billed).toFixed(2),
      paid:    Number(entry.total_paid).toFixed(2),
      pending: Number(entry.pending_amount).toFixed(2),
    });
    const phone = entry.phone.replace(/\D/g, '');
    return `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
  };

  const pendingColor =
    Number(entry.pending_amount) > 0 ? '#f59e0b' : 'var(--color-brand-400)';

  return (
    <div
      style={{
        padding: '1.125rem 1.375rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.875rem',
        border: '1px solid var(--color-surface-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        transition: 'all 0.15s',
      }}
    >
      {/* Name + phone + delivery count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: 'var(--color-text)',
              marginBottom: '0.125rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.customer_name}
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{entry.phone}</p>
        </div>

        <span
          style={{
            padding: '0.2rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 700,
            backgroundColor: 'rgba(148,163,184,0.12)',
            color: 'var(--color-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.delivery_count} {t('billing.deliveries')}
        </span>
      </div>

      {/* Money row */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.2rem',
            }}
          >
            {t('billing.total_billed')}
          </p>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
            {fmt(entry.total_billed)}
          </p>
        </div>

        <div>
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.2rem',
            }}
          >
            {t('billing.total_paid')}
          </p>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#34d399' }}>
            {fmt(entry.total_paid)}
          </p>
        </div>

        <div>
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.2rem',
            }}
          >
            {t('billing.pending')}
          </p>
          <p
            style={{
              fontWeight: 900,
              fontSize: '1rem',
              color: pendingColor,
            }}
          >
            {fmt(entry.pending_amount)}
          </p>
        </div>

        {/* WhatsApp button — pushed to the right */}
        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          id={`wa-btn-${entry.customer_id}`}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.625rem',
            fontWeight: 700,
            fontSize: '0.8rem',
            textDecoration: 'none',
            backgroundColor: 'rgba(37,211,102,0.15)',
            color: '#25d366',
            border: '1px solid rgba(37,211,102,0.3)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {/* WhatsApp SVG icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.847L.057 23.5a.5.5 0 0 0 .613.63l5.758-1.507A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.95 9.95 0 0 1-5.088-1.394l-.362-.214-3.754.983.999-3.647-.235-.374A9.953 9.953 0 0 1 2 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
          </svg>
          {t('billing.btn_whatsapp')}
        </a>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          style={{
            height: '7rem',
            borderRadius: '0.875rem',
            backgroundColor: 'var(--color-surface-2)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyBilling() {
  const { t } = useTranslation();

  const [month, setMonth]           = useState(currentMonthStr());
  const [bill, setBill]             = useState<MonthlyBillResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  const fetchBill = useCallback(async (m: string) => {
    if (!m) return;
    setLoading(true);
    setErrorMsg(null);
    setBill(null);
    try {
      const { data } = await getMonthlyBill(m);
      setBill(data);
    } catch {
      setErrorMsg('Could not load billing data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBill(month);
  }, [month, fetchBill]);

  const mLabel = monthLabel(month);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        maxWidth: '52rem',
        margin: '0 auto',
        padding: '2rem 1rem',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1
          style={{
            fontSize: '1.875rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
          }}
        >
          {t('billing.page_title')}
        </h1>
        <p style={{ color: 'var(--color-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          {t('billing.page_subtitle')}
        </p>
      </div>

      {/* Month picker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: '0.875rem',
          border: '1px solid var(--color-surface-3)',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <label
          htmlFor="billing-month"
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          {t('billing.label_month')}
        </label>
        <input
          id="billing-month"
          type="month"
          value={month}
          max={currentMonthStr()}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            padding: '0.5rem 0.875rem',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-surface-3)',
            borderRadius: '0.5rem',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
          }}
        />
        {!loading && bill && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.825rem',
              color: 'var(--color-muted)',
              fontWeight: 600,
            }}
          >
            {mLabel} · {bill.customers.length} customers
          </span>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid #ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            color: '#fca5a5',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          ❌ {errorMsg}
        </div>
      )}

      {/* Loading */}
      {loading && <SkeletonCards />}

      {/* Summary bar + customer cards */}
      {!loading && bill && (
        <>
          <SummaryBar
            billed={bill.grand_total_billed}
            paid={bill.grand_total_paid}
            pending={bill.grand_total_pending}
          />

          {bill.customers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--color-muted)',
              }}
            >
              <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🧾</p>
              <p style={{ fontWeight: 600 }}>{t('billing.no_bills')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {bill.customers.map((entry: MonthlyBillEntry) => (
                <BillCard key={entry.customer_id} entry={entry} monthLabel={mLabel} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
