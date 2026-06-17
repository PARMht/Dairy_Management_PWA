import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import type {
  Customer,
  ProductListItem,
  Shift,
  ToggleSubscriberPayload,
  UpdateSubscriptionPayload,
} from '../types';
import {
  getCustomers,
  getProducts,
  toggleSubscriberStatus,
  updateSubscription,
  deactivateCustomer,
} from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: Shift[] = ['Morning', 'Afternoon', 'Evening'];

// ─── Subscription Edit Form ───────────────────────────────────────────────────

interface SubEditFormProps {
  customer: Customer;
  products: ProductListItem[];
  onSave: (payload: UpdateSubscriptionPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function SubEditForm({ customer, products, onSave, onCancel, saving }: SubEditFormProps) {
  const { t } = useTranslation();
  const [productId, setProductId] = useState<string>(String(products[0]?.product_id ?? ''));
  const [shift, setShift]         = useState<Shift>('Morning');
  const [qty, setQty]             = useState('1');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-surface-3)',
    borderRadius: '0.5rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0 || !productId) return;
    await onSave({ product_id: Number(productId), shift, default_qty: q });
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      style={{
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-brand-600)',
        marginTop: '0.875rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
        {t('subscribers.btn_edit_sub')} — {customer.name}
      </p>

      <div>
        <label style={labelStyle}>Product</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>
              {p.name} (₹{p.current_price})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Shift</label>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {SHIFTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShift(s)}
              style={{
                flex: 1,
                padding: '0.375rem 0.5rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: shift === s ? 'var(--color-brand-600)' : 'var(--color-surface-3)',
                color: shift === s ? '#ffffff' : 'var(--color-muted)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Default Qty</label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={inputStyle}
          required
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
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
          {saving ? '…' : t('products.btn_save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
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
          {t('products.btn_cancel')}
        </button>
      </div>
    </form>
  );
}

// ─── Customer Row Card ────────────────────────────────────────────────────────

interface CustomerRowProps {
  customer: Customer;
  products: ProductListItem[];
  onToggle: (c: Customer, payload: ToggleSubscriberPayload) => Promise<void>;
  onEditSub: (c: Customer, payload: UpdateSubscriptionPayload) => Promise<void>;
  onDeactivate: (c: Customer) => void;
  toggling: boolean;
}

function CustomerRow({
  customer,
  products,
  onToggle,
  onEditSub,
  onDeactivate,
  toggling,
}: CustomerRowProps) {
  const { t } = useTranslation();
  const [showEditForm, setShowEditForm] = useState(false);
  const [subSaving, setSubSaving]       = useState(false);

  const badge = customer.is_subscriber
    ? { label: t('subscribers.badge_subscriber'), bg: 'var(--color-success-bg)', color: 'var(--color-success)' }
    : { label: t('subscribers.badge_khata'),      bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' };

  const handleEditSave = async (payload: UpdateSubscriptionPayload) => {
    setSubSaving(true);
    await onEditSub(customer, payload);
    setSubSaving(false);
    setShowEditForm(false);
  };

  return (
    <div
      style={{
        padding: '1.125rem 1.25rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.875rem',
        border: '1px solid var(--color-surface-3)',
        boxShadow: '0 2px 8px var(--color-shadow)',
        transition: 'all 0.15s',
      }}
    >
      {/* Top row: info + badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.875rem',
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
            }}
          >
            {customer.name}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{customer.phone}</p>
        </div>

        <span
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 700,
            backgroundColor: badge.bg,
            color: badge.color,
            whiteSpace: 'nowrap',
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Convert toggle */}
        <button
          onClick={() =>
            void onToggle(customer, {
              is_subscriber: !customer.is_subscriber,
              product_id: products[0]?.product_id,
              shift: 'Morning',
              default_qty: 1,
            })
          }
          disabled={toggling}
          style={{
            padding: '0.4rem 0.875rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.75rem',
            border: '1px solid var(--color-surface-3)',
            cursor: toggling ? 'not-allowed' : 'pointer',
            backgroundColor: 'transparent',
            color: 'var(--color-text)',
            transition: 'all 0.15s',
            opacity: toggling ? 0.5 : 1,
          }}
        >
          {customer.is_subscriber
            ? `🔄 ${t('subscribers.btn_convert_khata')}`
            : `🔄 ${t('subscribers.btn_convert_subscriber')}`}
        </button>

        {/* Edit subscription (subscribers only) */}
        {customer.is_subscriber && (
          <button
            onClick={() => setShowEditForm((v) => !v)}
            style={{
              padding: '0.4rem 0.875rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.75rem',
              border: '1px solid var(--color-surface-3)',
              cursor: 'pointer',
              backgroundColor: showEditForm ? 'var(--color-surface-3)' : 'transparent',
              color: 'var(--color-text)',
              transition: 'all 0.15s',
            }}
          >
            ✏️ {t('subscribers.btn_edit_sub')}
          </button>
        )}

        {/* Deactivate */}
        <button
          onClick={() => onDeactivate(customer)}
          style={{
            padding: '0.4rem 0.875rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.75rem',
            border: '1px solid var(--color-danger)',
            cursor: 'pointer',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            transition: 'all 0.15s',
            marginLeft: 'auto',
          }}
        >
          🗑 {t('subscribers.btn_deactivate')}
        </button>
      </div>

      {/* Inline subscription edit form */}
      {showEditForm && (
        <SubEditForm
          customer={customer}
          products={products}
          onSave={(p) => void handleEditSave(p)}
          onCancel={() => setShowEditForm(false)}
          saving={subSaving}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubscriberManagement() {
  const { t } = useTranslation();

  const [tab, setTab]               = useState<'subscribers' | 'adhoc'>('subscribers');
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [products, setProducts]     = useState<ProductListItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [toggling, setToggling]     = useState<number | null>(null);
  const [confirmDeact, setConfirmDeact] = useState<Customer | null>(null);

  // Banner
  const [banner, setBanner] = useState<{ msg: string; ok: boolean } | null>(null);
  const showBanner = (msg: string, ok: boolean) => {
    setBanner({ msg, ok });
    setTimeout(() => setBanner(null), 4000);
  };

  const isSubscriber = tab === 'subscribers';

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: custs }, { data: prods }] = await Promise.all([
        getCustomers(isSubscriber),
        getProducts(),
      ]);
      setCustomers(custs);
      setProducts(prods);
    } catch {
      showBanner('Could not load data.', false);
    } finally {
      setLoading(false);
    }
  }, [isSubscriber]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  // ── Toggle subscriber ─────────────────────────────────────────────────────────
  const handleToggle = async (c: Customer, payload: ToggleSubscriberPayload) => {
    setToggling(c.customer_id);
    try {
      await toggleSubscriberStatus(c.customer_id, payload);
      showBanner(t('subscribers.success_toggled'), true);
      await fetchCustomers();
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      showBanner(ae.response?.data?.message ?? 'Error.', false);
    } finally {
      setToggling(null);
    }
  };

  // ── Update subscription ───────────────────────────────────────────────────────
  const handleEditSub = async (c: Customer, payload: UpdateSubscriptionPayload) => {
    try {
      await updateSubscription(c.customer_id, payload);
      showBanner(t('subscribers.success_updated'), true);
      await fetchCustomers();
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      showBanner(ae.response?.data?.message ?? 'Error.', false);
    }
  };

  // ── Deactivate ────────────────────────────────────────────────────────────────
  const handleDeactivateConfirm = async () => {
    if (!confirmDeact) return;
    try {
      await deactivateCustomer(confirmDeact.customer_id);
      showBanner(t('subscribers.success_deactivated'), true);
      setConfirmDeact(null);
      await fetchCustomers();
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      showBanner(ae.response?.data?.message ?? 'Error.', false);
      setConfirmDeact(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <section
      className="page-enter"
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
          {t('subscribers.page_title')}
        </h1>
        <p style={{ color: 'var(--color-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          {t('subscribers.page_subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          padding: '0.25rem',
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: '0.75rem',
          width: 'fit-content',
          marginBottom: '1.5rem',
        }}
      >
        {(['subscribers', 'adhoc'] as const).map((t_) => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              backgroundColor: tab === t_ ? 'var(--color-brand-600)' : 'transparent',
              color: tab === t_ ? '#ffffff' : 'var(--color-muted)',
            }}
          >
            {t_ === 'subscribers' ? `📋 ${t('subscribers.tab_subscribers')}` : `📒 ${t('subscribers.tab_adhoc')}`}
          </button>
        ))}
      </div>

      {/* Banner */}
      {banner && (
        <div
          style={{
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
          {banner.ok ? '✅' : '❌'} {banner.msg}
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmDeact && (
        <div
          style={{
            padding: '1.125rem 1.375rem',
            backgroundColor: 'var(--color-surface-2)',
            borderRadius: '0.875rem',
            border: '1px solid var(--color-danger)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <p
            style={{
              flex: 1,
              color: 'var(--color-text)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ⚠️ {t('subscribers.confirm_deactivate')} — <strong>{confirmDeact.name}</strong>?
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              id="confirm-deactivate-customer-yes"
              onClick={() => void handleDeactivateConfirm()}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'var(--color-danger)',
                color: '#ffffff',
                transition: 'all 0.15s',
              }}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDeact(null)}
              style={{
                padding: '0.5rem 1.25rem',
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
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Customer list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: '6rem',
                borderRadius: '0.875rem',
                backgroundColor: 'var(--color-surface-2)',
              }}
            />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: 'var(--color-muted)',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👥</p>
          <p style={{ fontWeight: 600 }}>{t('subscribers.no_customers')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {customers.map((c) => (
            <CustomerRow
              key={c.customer_id}
              customer={c}
              products={products}
              onToggle={handleToggle}
              onEditSub={handleEditSub}
              onDeactivate={(cust) => setConfirmDeact(cust)}
              toggling={toggling === c.customer_id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
