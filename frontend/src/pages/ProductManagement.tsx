import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import type { ProductListItem, CreateProductPayload, UpdateProductPayload } from '../types';
import { getProducts, createProduct, updateProduct, deactivateProduct } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitOption = 'litre' | 'kg' | 'packet';

interface ProductFormState {
  name: string;
  unit: UnitOption;
  current_price: string;
}

const UNIT_OPTIONS: UnitOption[] = ['litre', 'kg', 'packet'];

const EMPTY_FORM: ProductFormState = { name: '', unit: 'litre', current_price: '' };

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProductCardProps {
  product: ProductListItem;
  onEdit: (p: ProductListItem) => void;
  onDeactivate: (p: ProductListItem) => void;
}

function ProductCard({ product, onEdit, onDeactivate }: ProductCardProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        padding: '1.25rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.875rem',
        border: '1px solid var(--color-surface-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        transition: 'all 0.15s',
      }}
    >
      {/* Name + price */}
      <div>
        <p
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--color-text)',
            marginBottom: '0.25rem',
          }}
        >
          {product.name}
        </p>
        <p
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            color: 'var(--color-brand-400)',
            letterSpacing: '-0.02em',
          }}
        >
          ₹{Number(product.current_price).toFixed(2)}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.125rem' }}>
          ID #{product.product_id}
        </p>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onEdit(product)}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.8rem',
            border: '1px solid var(--color-surface-3)',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: 'var(--color-text)',
            transition: 'all 0.15s',
          }}
        >
          ✏️ {t('products.btn_edit')}
        </button>
        <button
          onClick={() => onDeactivate(product)}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.8rem',
            border: '1px solid rgba(239,68,68,0.3)',
            cursor: 'pointer',
            backgroundColor: 'rgba(239,68,68,0.08)',
            color: '#f87171',
            transition: 'all 0.15s',
          }}
        >
          🗑 {t('products.btn_deactivate')}
        </button>
      </div>
    </div>
  );
}

// ─── Product form (inline add / edit) ────────────────────────────────────────

interface ProductFormProps {
  initial?: ProductListItem | null;
  onSave: (data: CreateProductPayload | UpdateProductPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ProductForm({ initial, onSave, onCancel, saving }: ProductFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ProductFormState>(
    initial
      ? { name: initial.name, unit: 'litre', current_price: String(initial.current_price) }
      : EMPTY_FORM,
  );

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
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    marginBottom: '0.375rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(form.current_price);
    if (!form.name.trim() || isNaN(price) || price <= 0) return;
    await onSave({ name: form.name.trim(), unit: form.unit, current_price: price });
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '1rem',
        border: '1px solid var(--color-brand-600)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <p
        style={{
          fontWeight: 700,
          color: 'var(--color-text)',
          fontSize: '0.95rem',
          marginBottom: '0.25rem',
        }}
      >
        {initial ? t('products.btn_edit') : t('products.btn_add')}
      </p>

      {/* Name */}
      <div>
        <label htmlFor="prod-name" style={labelStyle}>
          {t('products.label_name')}
        </label>
        <input
          id="prod-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Full Cream Milk"
          style={inputStyle}
          required
        />
      </div>

      {/* Unit */}
      <div>
        <label htmlFor="prod-unit" style={labelStyle}>
          {t('products.label_unit')}
        </label>
        <select
          id="prod-unit"
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as UnitOption }))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div>
        <label style={labelStyle}>
          {t('products.label_price')} (₹)
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-surface-3)',
            borderRadius: '0.75rem',
            padding: '0.375rem',
          }}
        >
          {/* Minus button */}
          <button
            type="button"
            aria-label="Decrease price"
            onClick={() => {
              const val = parseFloat(form.current_price) || 0;
              if (val > 0) setForm((f) => ({ ...f, current_price: Math.max(0, val - 1).toFixed(2) }));
            }}
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '0.625rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'var(--color-surface-3)',
              color: 'var(--color-text)',
              fontSize: '1.25rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            −
          </button>

          {/* Price display / input */}
          <input
            id="prod-price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.current_price}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                setForm((f) => ({ ...f, current_price: raw }));
              }
            }}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--color-brand-400)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              minWidth: 0,
              letterSpacing: '-0.02em',
            }}
            required
          />

          {/* Plus button */}
          <button
            type="button"
            aria-label="Increase price"
            onClick={() => {
              const val = parseFloat(form.current_price) || 0;
              setForm((f) => ({ ...f, current_price: (val + 1).toFixed(2) }));
            }}
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '0.625rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'var(--color-brand-600)',
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          id="prod-save-btn"
          type="submit"
          disabled={saving}
          style={{
            flex: 1,
            padding: '0.625rem',
            borderRadius: '0.625rem',
            fontWeight: 700,
            fontSize: '0.9rem',
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
            padding: '0.625rem',
            borderRadius: '0.625rem',
            fontWeight: 700,
            fontSize: '0.9rem',
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductManagement() {
  const { t } = useTranslation();

  const [products, setProducts]   = useState<ProductListItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formMode, setFormMode]   = useState<'hidden' | 'add' | 'edit'>('hidden');
  const [editing, setEditing]     = useState<ProductListItem | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  // Banner
  const [banner, setBanner] = useState<{ msg: string; ok: boolean } | null>(null);

  const showBanner = (msg: string, ok: boolean) => {
    setBanner({ msg, ok });
    setTimeout(() => setBanner(null), 4000);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProducts();
      setProducts(data);
    } catch {
      showBanner('Could not load products.', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async (payload: CreateProductPayload | UpdateProductPayload) => {
    setSaving(true);
    try {
      await createProduct(payload as CreateProductPayload);
      showBanner(t('products.success_created'), true);
      setFormMode('hidden');
      await fetchProducts();
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      showBanner(ae.response?.data?.message ?? 'Error.', false);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const handleEditSave = async (payload: CreateProductPayload | UpdateProductPayload) => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateProduct(editing.product_id, payload as UpdateProductPayload);
      showBanner(t('products.success_updated'), true);
      setFormMode('hidden');
      setEditing(null);
      await fetchProducts();
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      showBanner(ae.response?.data?.message ?? 'Error.', false);
    } finally {
      setSaving(false);
    }
  };

  // ── Deactivate ───────────────────────────────────────────────────────────────
  const handleDeactivateConfirm = async () => {
    if (confirmId === null) return;
    try {
      await deactivateProduct(confirmId);
      showBanner(t('products.success_deactivated'), true);
      setConfirmId(null);
      await fetchProducts();
    } catch (e) {
      const ae = e as AxiosError<{ message?: string }>;
      showBanner(ae.response?.data?.message ?? 'Error.', false);
      setConfirmId(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        maxWidth: '56rem',
        margin: '0 auto',
        padding: '2rem 1rem',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
            }}
          >
            {t('products.page_title')}
          </h1>
          <p style={{ color: 'var(--color-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            {t('products.page_subtitle')}
          </p>
        </div>

        <button
          id="btn-add-product"
          onClick={() => {
            setEditing(null);
            setFormMode(formMode === 'add' ? 'hidden' : 'add');
          }}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '0.75rem',
            fontWeight: 700,
            fontSize: '0.875rem',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'var(--color-brand-600)',
            color: '#ffffff',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          + {t('products.btn_add')}
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderRadius: '0.75rem',
            border: `1px solid ${banner.ok ? 'var(--color-brand-600)' : '#ef4444'}`,
            backgroundColor: banner.ok ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
            color: banner.ok ? 'var(--color-brand-100)' : '#fca5a5',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {banner.ok ? '✅' : '❌'} {banner.msg}
        </div>
      )}

      {/* Inline form */}
      {formMode === 'add' && (
        <ProductForm
          initial={null}
          onSave={(d) => void handleAdd(d)}
          onCancel={() => setFormMode('hidden')}
          saving={saving}
        />
      )}
      {formMode === 'edit' && editing && (
        <ProductForm
          initial={editing}
          onSave={(d) => void handleEditSave(d)}
          onCancel={() => { setFormMode('hidden'); setEditing(null); }}
          saving={saving}
        />
      )}

      {/* Confirm deactivate dialog */}
      {confirmId !== null && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--color-surface-2)',
            borderRadius: '0.875rem',
            border: '1px solid rgba(239,68,68,0.4)',
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
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            ⚠️ {t('products.confirm_deactivate')}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              id="confirm-deactivate-product-yes"
              onClick={() => void handleDeactivateConfirm()}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                transition: 'all 0.15s',
              }}
            >
              Yes, deactivate
            </button>
            <button
              onClick={() => setConfirmId(null)}
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

      {/* Products grid */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: '10rem',
                borderRadius: '0.875rem',
                backgroundColor: 'var(--color-surface-2)',
              }}
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: 'var(--color-muted)',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📦</p>
          <p style={{ fontWeight: 600 }}>{t('products.no_products')}</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {products.map((p) => (
            <ProductCard
              key={p.product_id}
              product={p}
              onEdit={(prod) => {
                setEditing(prod);
                setFormMode('edit');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeactivate={(prod) => setConfirmId(prod.product_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
