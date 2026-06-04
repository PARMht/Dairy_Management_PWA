import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import type { Customer, LogHistoryEntry } from '../types';
import { getCustomers, getLogHistory, updateLog } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const SHIFT_COLORS: Record<string, { bg: string; color: string }> = {
  Morning:   { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  Afternoon: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  Evening:   { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-surface-3)',
  borderRadius: '0.5rem',
  color: 'var(--color-text)',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'var(--color-muted)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

// ─── Log Card ─────────────────────────────────────────────────────────────────

interface LogCardProps {
  entry: LogHistoryEntry;
  onSaved: (id: number, qty: number, price: number, totalCharge: number) => void;
}

function LogCard({ entry, onSaved }: LogCardProps) {
  const { t } = useTranslation();

  const [editing, setEditing]   = useState(false);
  const [qty, setQty]           = useState(String(entry.quantity));
  const [price, setPrice]       = useState(String(entry.recorded_price));
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState<string | null>(null);

  // Keep local state in sync if parent data changes
  useEffect(() => {
    setQty(String(entry.quantity));
    setPrice(String(entry.recorded_price));
  }, [entry.quantity, entry.recorded_price]);

  const shiftStyle =
    entry.shift && SHIFT_COLORS[entry.shift]
      ? SHIFT_COLORS[entry.shift]
      : { bg: 'rgba(148,163,184,0.15)', color: 'var(--color-muted)' };

  const handleSave = async () => {
    const parsedQty   = parseFloat(qty);
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedQty) || parsedQty <= 0 || isNaN(parsedPrice) || parsedPrice <= 0) return;

    setSaving(true);
    setErrMsg(null);
    try {
      const { data } = await updateLog(entry.id, {
        quantity:       parsedQty,
        recorded_price: parsedPrice,
      });
      onSaved(entry.id, parsedQty, parsedPrice, data.total_charge);
      setEditing(false);
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      setErrMsg(ae.response?.data?.message ?? t('logs.error_update'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setQty(String(entry.quantity));
    setPrice(String(entry.recorded_price));
    setErrMsg(null);
    setEditing(false);
  };

  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.875rem',
        border: '1px solid var(--color-surface-3)',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Top row — name + date + shift badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
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
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {entry.product_name} · {fmtDate(entry.log_date)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {entry.shift && (
            <span
              style={{
                padding: '0.2rem 0.625rem',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: shiftStyle.bg,
                color: shiftStyle.color,
                whiteSpace: 'nowrap',
              }}
            >
              {entry.shift}
            </span>
          )}
        </div>
      </div>

      {/* Detail row — qty · price · total */}
      {!editing ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p style={labelStyle}>{t('logs.label_qty')}</p>
            <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
              {entry.quantity}
            </p>
          </div>
          <div>
            <p style={labelStyle}>{t('logs.label_price')}</p>
            <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
              {fmt(entry.recorded_price)}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={labelStyle}>{t('logs.label_total')}</p>
            <p
              style={{
                fontWeight: 900,
                fontSize: '1.1rem',
                color: 'var(--color-brand-400)',
                letterSpacing: '-0.01em',
              }}
            >
              {fmt(entry.total_charge)}
            </p>
          </div>

          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.78rem',
              border: '1px solid var(--color-surface-3)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--color-text)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            ✏️ {t('logs.btn_edit')}
          </button>
        </div>
      ) : (
        /* ── Inline edit form ─────────────────────────────────────────────── */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '0.875rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '0.625rem',
            border: '1px solid var(--color-brand-600)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '6rem' }}>
              <label style={labelStyle}>{t('logs.label_qty')}</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '6rem' }}>
              <label style={labelStyle}>{t('logs.label_price')}</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {errMsg && (
            <p style={{ fontSize: '0.8rem', color: '#f87171', margin: 0 }}>❌ {errMsg}</p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                backgroundColor: 'var(--color-brand-600)',
                color: '#ffffff',
                transition: 'all 0.15s',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? '…' : t('logs.btn_save')}
            </button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: '1px solid var(--color-surface-3)',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: 'var(--color-muted)',
                transition: 'all 0.15s',
              }}
            >
              {t('logs.btn_cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            height: '5.5rem',
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

const PAGE_LIMIT = 20;

export default function LogHistory() {
  const { t } = useTranslation();

  // ── Filters ────────────────────────────────────────────────────────────────
  const [from, setFrom]               = useState(firstOfMonth());
  const [to, setTo]                   = useState(todayStr());
  const [customerId, setCustomerId]   = useState<number | ''>('');
  const [customers, setCustomers]     = useState<Customer[]>([]);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [logs, setLogs]       = useState<LogHistoryEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Load customer list ─────────────────────────────────────────────────────
  useEffect(() => {
    getCustomers(null)
      .then(({ data }) => setCustomers(data))
      .catch(console.error);
  }, []);

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = {
          page:  p,
          limit: PAGE_LIMIT,
          from,
          to,
        };
        if (customerId !== '') params.customer_id = customerId;

        const { data } = await getLogHistory(params as Parameters<typeof getLogHistory>[0]);
        setLogs(data.logs);
        setTotal(data.total);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [from, to, customerId],
  );

  // Re-fetch when filters change; reset to page 1
  useEffect(() => {
    setPage(1);
    void fetchLogs(1);
  }, [fetchLogs]);

  const goToPage = (p: number) => {
    setPage(p);
    void fetchLogs(p);
  };

  // ── Inline save handler ────────────────────────────────────────────────────
  const handleSaved = (
    id: number,
    qty: number,
    price: number,
    totalCharge: number,
  ) => {
    setLogs((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, quantity: qty, recorded_price: price, total_charge: totalCharge }
          : e,
      ),
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

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
          {t('logs.page_title')}
        </h1>
        <p style={{ color: 'var(--color-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          {t('logs.page_subtitle')}
        </p>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0.875rem',
          flexWrap: 'wrap',
          padding: '1.125rem 1.25rem',
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: '0.875rem',
          border: '1px solid var(--color-surface-3)',
          marginBottom: '1.5rem',
          alignItems: 'flex-end',
        }}
      >
        {/* From */}
        <div style={{ flex: '1 1 8rem' }}>
          <label htmlFor="log-from" style={labelStyle}>
            {t('logs.filter_from')}
          </label>
          <input
            id="log-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* To */}
        <div style={{ flex: '1 1 8rem' }}>
          <label htmlFor="log-to" style={labelStyle}>
            {t('logs.filter_to')}
          </label>
          <input
            id="log-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Customer */}
        <div style={{ flex: '2 1 12rem' }}>
          <label htmlFor="log-customer" style={labelStyle}>
            {t('logs.filter_customer')}
          </label>
          <select
            id="log-customer"
            value={customerId}
            onChange={(e) =>
              setCustomerId(e.target.value === '' ? '' : Number(e.target.value))
            }
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
          >
            <option value="">{t('logs.filter_all')}</option>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Result count ────────────────────────────────────────────────────── */}
      {!loading && (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-muted)',
            marginBottom: '1rem',
          }}
        >
          {total} result{total !== 1 ? 's' : ''} · page {page} of {totalPages}
        </p>
      )}

      {/* ── Log cards ───────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonCards />
      ) : logs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: 'var(--color-muted)',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</p>
          <p style={{ fontWeight: 600 }}>{t('logs.no_logs')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {logs.map((entry) => (
            <LogCard key={entry.id} entry={entry} onSaved={handleSaved} />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginTop: '1.5rem',
          }}
        >
          <button
            id="log-prev-page"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.625rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              border: '1px solid var(--color-surface-3)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              backgroundColor: 'transparent',
              color: page <= 1 ? 'var(--color-surface-3)' : 'var(--color-text)',
              transition: 'all 0.15s',
              opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            ← {t('logs.prev_page')}
          </button>

          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-muted)',
            }}
          >
            {page} / {totalPages}
          </span>

          <button
            id="log-next-page"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.625rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              border: '1px solid var(--color-surface-3)',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              backgroundColor: 'transparent',
              color: page >= totalPages ? 'var(--color-surface-3)' : 'var(--color-text)',
              transition: 'all 0.15s',
              opacity: page >= totalPages ? 0.4 : 1,
            }}
          >
            {t('logs.next_page')} →
          </button>
        </div>
      )}
    </section>
  );
}
