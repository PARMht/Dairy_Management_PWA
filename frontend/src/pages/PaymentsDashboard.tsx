import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import type { Customer, CustomerBalance, PaymentRecord, PaymentMethod } from '../types';
import {
  getCustomers,
  getCustomerBalance,
  getPaymentsByCustomer,
  createPayment,
} from '../services/api';

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MethodToggleProps {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}

function MethodToggle({ value, onChange }: MethodToggleProps) {
  const methods: PaymentMethod[] = ['Cash', 'UPI'];
  return (
    <div
      role="group"
      style={{
        display: 'flex',
        gap: '0.375rem',
        padding: '0.25rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '0.625rem',
        width: 'fit-content',
      }}
    >
      {methods.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={value === m}
          style={{
            padding: '0.375rem 1.25rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            backgroundColor: value === m ? 'var(--color-brand-600)' : 'transparent',
            color: value === m ? '#ffffff' : 'var(--color-muted)',
          }}
        >
          {m === 'Cash' ? '💵 Cash' : '📱 UPI'}
        </button>
      ))}
    </div>
  );
}

interface PaymentCardProps {
  payment: PaymentRecord;
}

function PaymentCard({ payment }: PaymentCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-surface-3)',
        boxShadow: '0 2px 8px var(--color-shadow)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-muted)',
            marginBottom: '0.125rem',
          }}
        >
          {fmtDate(payment.payment_date)} · {payment.method}
        </p>
        {payment.notes && (
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-muted)',
              fontStyle: 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {payment.notes}
          </p>
        )}
      </div>
      <span
        style={{
          fontWeight: 800,
          fontSize: '1rem',
          color: 'var(--color-brand-400)',
          whiteSpace: 'nowrap',
        }}
      >
        {fmt(payment.amount)}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentsDashboard() {
  const { t } = useTranslation();

  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [selectedId, setSelectedId]     = useState<number | ''>('');
  const [balance, setBalance]           = useState<CustomerBalance | null>(null);
  const [payments, setPayments]         = useState<PaymentRecord[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Partial payment form
  const [amount, setAmount]   = useState('');
  const [method, setMethod]   = useState<PaymentMethod>('Cash');
  const [notes, setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Banner
  const [banner, setBanner] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Load customers on mount ──────────────────────────────────────────────────
  useEffect(() => {
    getCustomers(null)
      .then(({ data }) => setCustomers(data))
      .catch(console.error);
  }, []);

  // ── Fetch balance + history when customer changes ────────────────────────────
  const loadCustomerData = useCallback(async (id: number) => {
    setBalance(null);
    setPayments([]);
    setBanner(null);

    setLoadingBalance(true);
    setLoadingHistory(true);

    try {
      const [{ data: bal }, { data: hist }] = await Promise.all([
        getCustomerBalance(id),
        getPaymentsByCustomer(id),
      ]);
      setBalance(bal);
      setPayments(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBalance(false);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId !== '') void loadCustomerData(selectedId);
  }, [selectedId, loadCustomerData]);

  // ── Full-clear payment ────────────────────────────────────────────────────────
  const handleClearFull = async () => {
    if (!balance || Number(balance.pending_amount) <= 0 || selectedId === '') return;
    setSubmitting(true);
    try {
      await createPayment({
        customer_id: balance.customer_id,
        amount:      Number(balance.pending_amount),
        method:      'Cash',
        notes:       'Full balance cleared',
      });
      setBanner({ msg: t('payments.success_payment'), ok: true });
      await loadCustomerData(selectedId as number);
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      setBanner({ msg: ae.response?.data?.message ?? t('payments.error_payment'), ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Partial payment ───────────────────────────────────────────────────────────
  const handlePartialPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0 || selectedId === '') return;
    setSubmitting(true);
    try {
      await createPayment({
        customer_id: selectedId as number,
        amount:      parsed,
        method,
        notes,
      });
      setBanner({ msg: t('payments.success_payment'), ok: true });
      setAmount('');
      setNotes('');
      await loadCustomerData(selectedId as number);
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      setBanner({ msg: ae.response?.data?.message ?? t('payments.error_payment'), ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shared input style ───────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-surface-3)',
    borderRadius: '0.5rem',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    marginBottom: '0.375rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <section
      className="page-enter"
      style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '2rem 1rem',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '1.875rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
          }}
        >
          {t('payments.page_title')}
        </h1>
        <p style={{ color: 'var(--color-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          {t('payments.page_subtitle')}
        </p>
      </div>

      {/* Customer selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="customer-select" style={labelStyle}>
          {t('payments.select_customer')}
        </label>
        <select
          id="customer-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">— {t('payments.select_customer')} —</option>
          {customers.map((c) => (
            <option key={c.customer_id} value={c.customer_id}>
              {c.name} ({c.phone})
            </option>
          ))}
        </select>
      </div>

      {/* Banner */}
      {banner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.875rem 1.25rem',
            borderRadius: '0.75rem',
            border: `1px solid ${banner.ok ? 'var(--color-brand-600)' : 'var(--color-danger)'}`,
            backgroundColor: banner.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: banner.ok ? 'var(--color-success)' : 'var(--color-danger)',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <span>{banner.ok ? '✅' : '❌'} {banner.msg}</span>
          <button
            onClick={() => setBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1rem',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Balance card + Full-clear button */}
      {selectedId !== '' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: '1rem',
              border: '1px solid var(--color-surface-3)',
              boxShadow: '0 2px 8px var(--color-shadow)',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            {loadingBalance ? (
              <div
                style={{
                  height: '2rem',
                  width: '10rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--color-surface-3)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ) : balance ? (
              <>
                <div>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('payments.pending_amount')}
                  </p>
                  <p
                    style={{
                      fontSize: '2rem',
                      fontWeight: 900,
                      color:
                        Number(balance.pending_amount) > 0
                          ? 'var(--color-warning)'
                          : 'var(--color-brand-400)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {fmt(balance.pending_amount)}
                  </p>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-muted)',
                      marginTop: '0.25rem',
                    }}
                  >
                    Billed: {fmt(balance.total_billed)} · Paid: {fmt(balance.total_paid)}
                  </p>
                </div>

                {Number(balance.pending_amount) > 0 && (
                  <button
                    id="btn-clear-full"
                    onClick={() => void handleClearFull()}
                    disabled={submitting}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.75rem',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      border: 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#ffffff',
                      transition: 'all 0.15s',
                      opacity: submitting ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✅ {t('payments.btn_paid')}
                  </button>
                )}
              </>
            ) : null}
          </div>

          {/* Partial payment form */}
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: '1rem',
              border: '1px solid var(--color-surface-3)',
              boxShadow: '0 2px 8px var(--color-shadow)',
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-muted)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: 'var(--color-surface-3)',
                }}
              />
              {t('payments.partial_title')}
              <span
                style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: 'var(--color-surface-3)',
                }}
              />
            </p>

            <form onSubmit={(e) => void handlePartialPay(e)} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Amount */}
                <div>
                  <label htmlFor="payment-amount" style={labelStyle}>
                    {t('payments.label_amount')}
                  </label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                {/* Method toggle */}
                <div>
                  <p style={labelStyle}>{t('payments.label_method')}</p>
                  <MethodToggle value={method} onChange={setMethod} />
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="payment-notes" style={labelStyle}>
                    {t('payments.label_notes')}
                  </label>
                  <input
                    id="payment-notes"
                    type="text"
                    placeholder="Optional note…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <button
                  id="btn-pay-amount"
                  type="submit"
                  disabled={submitting || !amount}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: submitting || !amount ? 'not-allowed' : 'pointer',
                    backgroundColor: 'var(--color-brand-600)',
                    color: '#ffffff',
                    transition: 'all 0.15s',
                    opacity: submitting || !amount ? 0.5 : 1,
                  }}
                >
                  {submitting ? '…' : t('payments.btn_pay')}
                </button>
              </div>
            </form>
          </div>

          {/* Payment history */}
          <div>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--color-text)',
                marginBottom: '0.875rem',
              }}
            >
              {t('payments.history_title')}
            </h2>

            {loadingHistory ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: '4rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--color-surface-2)',
                    }}
                  />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--color-muted)',
                  fontSize: '0.875rem',
                }}
              >
                💸 {t('payments.no_payments')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {payments.map((p) => (
                  <PaymentCard key={p.id} payment={p} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
