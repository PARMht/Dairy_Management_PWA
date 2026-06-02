import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  searchInactiveCustomers,
  createCustomer,
  getProducts,
} from '../services/api';
import type {
  Shift,
  ProductListItem,
  InactiveCustomerSearchResult,
  CreateCustomerPayload,
} from '../types';
import type { AxiosError } from 'axios';

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: Shift[] = ['Morning', 'Afternoon', 'Evening'];
const DEBOUNCE_MS       = 300;
const SEARCH_TRIGGER_LEN = 3;

// ─── Local types ──────────────────────────────────────────────────────────────

/** Which context the form is operating in. */
type FormMode = 'new' | 'reactivation';

/** All controlled fields kept in one flat state object. */
interface FormFields {
  phone:         string;
  name:          string;
  is_subscriber: boolean;
  product_id:    string;  // string so <select> value round-trips cleanly; coerced on submit
  shift:         Shift;
  default_qty:   string;  // subscriber-only
  quantity:      string;  // ad-hoc-only
}

/** Props accepted by this component. */
export interface CustomerToggleFormProps {
  /** Called after a successful save so the parent can refresh its list. */
  onSuccess?: () => void;
}

// ─── Initial-state factory ────────────────────────────────────────────────────

/**
 * Returns a blank FormFields object.
 * `product_id` cannot be seeded from a static constant anymore — it is set to
 * '' here and will be updated once the product list loads (see the products
 * useEffect below).
 */
const emptyFields = (): FormFields => ({
  phone:         '',
  name:          '',
  is_subscriber: true,
  product_id:    '',
  shift:         'Morning',
  default_qty:   '',
  quantity:      '',
});

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CustomerToggleForm
 *
 * Handles two registration flows:
 *   1. New customer   — POST /api/customers → fresh INSERT
 *   2. Reactivation   — same endpoint; backend upsert detects inactive phone
 *                       and sets is_active = TRUE
 *
 * Phone field appears first (spec requirement).
 * A 300 ms debounce fires searchInactiveCustomers() when phone.length ≥ 3.
 * Selecting a dropdown suggestion switches the form to Reactivation Mode.
 *
 * Products are fetched dynamically from GET /api/products on mount.
 * All UI strings are served through react-i18next (en / hi / mr).
 */
export default function CustomerToggleForm({ onSuccess }: CustomerToggleFormProps) {
  const { t } = useTranslation();

  // ── Product list state (dynamic fetch) ─────────────────────────────────────
  const [products, setProducts]           = useState<ProductListItem[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError]     = useState<boolean>(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [fields, setFields] = useState<FormFields>(emptyFields());
  const [mode, setMode]     = useState<FormMode>('new');

  // ── Debounce / search state ────────────────────────────────────────────────
  const [suggestions, setSuggestions]   = useState<InactiveCustomerSearchResult[]>([]);
  const [isSearching, setIsSearching]   = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const debounceTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting, setSubmitting]     = useState<boolean>(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const phoneWrapperRef = useRef<HTMLDivElement>(null);

  // ─── Fetch products on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setProductsLoading(true);
      setProductsError(false);
      try {
        const { data } = await getProducts();
        if (!cancelled) {
          setProducts(data);
          // Seed the select to the first returned product
          setFields((prev) => ({
            ...prev,
            product_id: data[0] ? String(data[0].product_id) : '',
          }));
        }
      } catch {
        if (!cancelled) setProductsError(true);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };

    void fetchProducts();
    return () => { cancelled = true; };
  }, []);

  // ─── Outside-click: close dropdown ────────────────────────────────────────
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        phoneWrapperRef.current &&
        !phoneWrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ─── Debounced inactive-customer search ───────────────────────────────────
  const triggerSearch = useCallback((phone: string) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    if (phone.length < SEARCH_TRIGGER_LEN) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await searchInactiveCustomers(phone);
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        // Silent failure — search error must not block the form
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ─── Field change handlers ─────────────────────────────────────────────────

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Editing phone while in reactivation mode exits that mode
    if (mode === 'reactivation') {
      setMode('new');
      setFields({
        ...emptyFields(),
        product_id: fields.product_id, // preserve current product selection
        phone: val,
      });
    } else {
      setFields((prev) => ({ ...prev, phone: val }));
    }
    setSubmitError(null);
    setSubmitSuccess(null);
    triggerSearch(val);
  };

  const handleFieldChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked =
      type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFields((prev) => ({
      ...prev,
      [name]: checked !== undefined ? checked : value,
    }));
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  // ─── Suggestion click → Reactivation Mode ─────────────────────────────────

  const handleSuggestionSelect = (result: InactiveCustomerSearchResult) => {
    setFields((prev) => ({
      ...prev,
      phone: result.phone,
      name:  result.name,
    }));
    setMode('reactivation');
    setShowDropdown(false);
    setSuggestions([]);
  };

  // ─── Reset ─────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFields({
      ...emptyFields(),
      // Keep the loaded product selection so the user doesn't face an empty select
      product_id: products[0] ? String(products[0].product_id) : '',
    });
    setMode('new');
    setSuggestions([]);
    setShowDropdown(false);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    try {
      let payload: CreateCustomerPayload;

      if (fields.is_subscriber) {
        if (!fields.default_qty || Number(fields.default_qty) <= 0) {
          setSubmitError(t('form.error_qty_zero'));
          setSubmitting(false);
          return;
        }
        payload = {
          name:          fields.name.trim(),
          phone:         fields.phone.trim(),
          is_subscriber: true,
          product_id:    Number(fields.product_id),
          shift:         fields.shift,
          default_qty:   Number(fields.default_qty),
        };
      } else {
        if (!fields.quantity || Number(fields.quantity) <= 0) {
          setSubmitError(t('form.error_adhoc_qty'));
          setSubmitting(false);
          return;
        }
        payload = {
          name:          fields.name.trim(),
          phone:         fields.phone.trim(),
          is_subscriber: false,
          product_id:    Number(fields.product_id),
          quantity:      Number(fields.quantity),
        };
      }

      await createCustomer(payload);

      const successKey =
        mode === 'reactivation' ? 'form.success_reactivated' : 'form.success_registered';
      setSubmitSuccess(t(successKey, { name: fields.name }));
      resetForm();
      onSuccess?.();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
      const msg =
        axiosErr.response?.data?.message ??
        axiosErr.response?.data?.error ??
        t('form.error_generic');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Shared CSS helpers ────────────────────────────────────────────────────

  const labelClass =
    'block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5';

  const inputClass =
    'w-full rounded-lg px-3.5 py-2.5 text-sm text-[var(--color-text)] ' +
    'bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] ' +
    'placeholder:text-[var(--color-muted)] ' +
    'focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)] ' +
    'focus:border-[var(--color-brand-600)] transition-all';

  const selectClass = inputClass + ' cursor-pointer';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] p-6 w-full max-w-lg mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text)]">
          {mode === 'reactivation' ? t('form.title_reactivate') : t('form.title_register')}
        </h2>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          {mode === 'reactivation'
            ? t('form.subtitle_reactivate')
            : t('form.subtitle_register')}
        </p>
      </div>

      {/* ── Reactivation banner ──────────────────────────────────────────────── */}
      {mode === 'reactivation' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-900/25 border border-amber-600/60 text-amber-300 text-xs mb-5">
          <span className="text-base mt-0.5">⚠️</span>
          <span>
            <strong>{t('form.title_reactivate')}</strong>
            {' — '}
            {t('form.banner_reactivation')}
          </span>
        </div>
      )}

      {/* ── Success banner ───────────────────────────────────────────────────── */}
      {submitSuccess && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--color-brand-700)]/25 border border-[var(--color-brand-600)] text-[var(--color-brand-100)] text-sm mb-5">
          <span>✅ {submitSuccess}</span>
          <button
            type="button"
            onClick={() => setSubmitSuccess(null)}
            className="text-[var(--color-brand-400)] hover:text-white font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-900/25 border border-red-700 text-red-300 text-sm mb-5">
          <span>❌ {submitError}</span>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-red-400 hover:text-white font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="flex flex-col gap-5">

          {/* ── 1. Phone number (always first — spec requirement) ─────────────── */}
          <div ref={phoneWrapperRef} className="relative">
            <label htmlFor="ctf-phone" className={labelClass}>
              {t('form.label_phone')}
            </label>
            <div className="relative">
              <input
                id="ctf-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                maxLength={15}
                placeholder={t('form.placeholder_phone')}
                value={fields.phone}
                onChange={handlePhoneChange}
                readOnly={mode === 'reactivation'}
                className={
                  inputClass +
                  (mode === 'reactivation'
                    ? ' opacity-60 cursor-not-allowed select-none'
                    : '')
                }
                autoComplete="off"
              />
              {/* Inline search spinner */}
              {isSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] text-xs animate-pulse">
                  {t('form.searching')}
                </span>
              )}
            </div>

            {/* ── Inactive-customer dropdown ─────────────────────────────────── */}
            {showDropdown && suggestions.length > 0 && (
              <ul
                role="listbox"
                aria-label={t('form.dropdown_hint')}
                className={
                  'absolute z-50 top-full mt-1.5 left-0 right-0 ' +
                  'rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] ' +
                  'shadow-xl shadow-black/40 overflow-hidden'
                }
              >
                <li className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-surface-3)]">
                  {t('form.dropdown_hint')}
                </li>
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSuggestionSelect(s)}
                      className={
                        'w-full text-left px-3.5 py-3 flex items-center justify-between gap-3 ' +
                        'hover:bg-[var(--color-surface-3)] transition-colors group'
                      }
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-brand-400)] transition-colors">
                          {s.name}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">{s.phone}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-700/30 text-amber-300 border border-amber-600/40 shrink-0">
                        {t('form.badge_inactive')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── 2. Full name ──────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="ctf-name" className={labelClass}>
              {t('form.label_name')}
            </label>
            <input
              id="ctf-name"
              name="name"
              type="text"
              required
              maxLength={150}
              placeholder={t('form.placeholder_name')}
              value={fields.name}
              onChange={handleFieldChange}
              className={inputClass}
              autoComplete="off"
            />
          </div>

          {/* ── 3. Subscriber toggle ──────────────────────────────────────────── */}
          <div>
            <p className={labelClass}>{t('form.label_customer_type')}</p>
            <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-surface)] w-fit">
              {(
                [
                  { labelKey: 'form.type_subscriber' as const, value: true  },
                  { labelKey: 'form.type_adhoc'       as const, value: false },
                ]
              ).map(({ labelKey, value }) => (
                <button
                  key={labelKey}
                  type="button"
                  onClick={() =>
                    setFields((prev) => ({ ...prev, is_subscriber: value }))
                  }
                  className={[
                    'px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                    fields.is_subscriber === value
                      ? 'bg-[var(--color-brand-600)] text-white shadow-md'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]',
                  ].join(' ')}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* ── 4. Product (dynamic) ──────────────────────────────────────────── */}
          <div>
            <label htmlFor="ctf-product" className={labelClass}>
              {t('form.label_product')}
            </label>
            {productsLoading ? (
              <p className="text-xs text-[var(--color-muted)] py-2.5 animate-pulse">
                {t('form.products_loading')}
              </p>
            ) : productsError ? (
              <p className="text-xs text-red-400 py-2.5">
                {t('form.products_error')}
              </p>
            ) : (
              <select
                id="ctf-product"
                name="product_id"
                required
                value={fields.product_id}
                onChange={handleFieldChange}
                className={selectClass}
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ── 5a. Subscriber-only fields ────────────────────────────────────── */}
          {fields.is_subscriber && (
            <>
              {/* Shift */}
              <div>
                <label htmlFor="ctf-shift" className={labelClass}>
                  {t('form.label_shift')}
                </label>
                <select
                  id="ctf-shift"
                  name="shift"
                  required
                  value={fields.shift}
                  onChange={handleFieldChange}
                  className={selectClass}
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Default Qty */}
              <div>
                <label htmlFor="ctf-default-qty" className={labelClass}>
                  {t('form.label_default_qty')}
                </label>
                <input
                  id="ctf-default-qty"
                  name="default_qty"
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder={t('form.placeholder_qty')}
                  value={fields.default_qty}
                  onChange={handleFieldChange}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* ── 5b. Ad-hoc-only field ─────────────────────────────────────────── */}
          {!fields.is_subscriber && (
            <div>
              <label htmlFor="ctf-quantity" className={labelClass}>
                {t('form.label_quantity')}
              </label>
              <input
                id="ctf-quantity"
                name="quantity"
                type="number"
                inputMode="decimal"
                required
                min="0.01"
                step="0.01"
                placeholder={t('form.placeholder_qty')}
                value={fields.quantity}
                onChange={handleFieldChange}
                className={inputClass}
              />
            </div>
          )}

          {/* ── Submit row ────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-1">
            <button
              id="ctf-submit-btn"
              type="submit"
              disabled={submitting || productsLoading}
              className={[
                'flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all',
                'shadow-lg shadow-green-900/20 active:scale-[0.98]',
                mode === 'reactivation'
                  ? 'bg-amber-600 hover:bg-amber-500 disabled:opacity-50'
                  : 'bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-500)] disabled:opacity-50',
                'disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {submitting
                ? t('form.btn_saving')
                : mode === 'reactivation'
                ? t('form.btn_reactivate')
                : t('form.btn_register')}
            </button>

            <button
              type="button"
              onClick={resetForm}
              title={t('form.btn_clear')}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-[var(--color-muted)] bg-[var(--color-surface-3)] hover:text-[var(--color-text)] transition-all"
            >
              {t('form.btn_clear')}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
