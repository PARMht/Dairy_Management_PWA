import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import localforage from 'localforage';
import { getRoute, bulkSubmitLogs } from '../services/api';
import type { AxiosError } from 'axios';
import type { Shift, RouteEntryWithQty, BulkLogItem, BulkSubmitPayload } from '../types';

// ─── Offline queue store ──────────────────────────────────────────────────────
// Each entry is keyed by sync_id (UUID) and holds a BulkSubmitPayload.
// The store is named so its IndexedDB object store can be identified clearly
// in DevTools and stays isolated from any other localforage usage in the app.
const offlineQueue = localforage.createInstance({ name: 'offline_logs_queue' });

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: Shift[] = ['Morning', 'Afternoon', 'Evening'];

// ─── Helper: detect a network-level failure ───────────────────────────────────
// ERR_NETWORK from Axios has no response object AND code === 'ERR_NETWORK'.
// Falling back to !navigator.onLine catches the edge case where Axios does
// produce a response wrapper but the browser is already reporting offline.
function isNetworkError(err: unknown): boolean {
  const axiosErr = err as AxiosError;
  return (
    axiosErr.code === 'ERR_NETWORK' ||
    axiosErr.message === 'Network Error' ||
    !navigator.onLine
  );
}

// ─── Prop interfaces ──────────────────────────────────────────────────────────

interface ShiftTabsProps {
  activeShift: Shift;
  onSelect: (shift: Shift) => void;
}

interface RouteRowProps {
  entry: RouteEntryWithQty;
  onQuantityChange: (customerId: number, newQty: number) => void;
}

interface StatusBannerProps {
  message: string;
  variant: 'success' | 'offline' | 'error';
  onDismiss: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Shift selector tab bar */
function ShiftTabs({ activeShift, onSelect }: ShiftTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface-2)] w-fit mb-6">
      {SHIFTS.map((shift) => (
        <button
          key={shift}
          onClick={() => onSelect(shift)}
          className={[
            'px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            activeShift === shift
              ? 'bg-[var(--color-brand-600)] text-white shadow-lg shadow-green-900/40'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]',
          ].join(' ')}
        >
          {shift}
        </button>
      ))}
    </div>
  );
}

/** A single customer row with quantity controls */
function RouteRow({ entry, onQuantityChange }: RouteRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] transition-all hover:border-[var(--color-brand-700)]">
      {/* Customer info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--color-text)] truncate">{entry.name}</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{entry.product_name}</p>
      </div>

      {/* Price */}
      <div className="text-right hidden sm:block">
        <p className="text-xs text-[var(--color-muted)]">{t('route.label_price_unit')}</p>
        <p className="font-semibold text-[var(--color-brand-400)]">₹{entry.current_price}</p>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          aria-label={`Decrease quantity for ${entry.name}`}
          onClick={() => onQuantityChange(entry.customer_id, entry.quantity - 1)}
          disabled={entry.quantity <= 0}
          className="w-8 h-8 rounded-lg bg-[var(--color-surface-3)] text-[var(--color-text)] font-bold text-lg flex items-center justify-center disabled:opacity-30 hover:bg-[var(--color-brand-700)] transition-colors"
        >
          −
        </button>

        <span className="w-10 text-center font-bold text-lg tabular-nums">
          {entry.quantity}
        </span>

        <button
          aria-label={`Increase quantity for ${entry.name}`}
          onClick={() => onQuantityChange(entry.customer_id, entry.quantity + 1)}
          className="w-8 h-8 rounded-lg bg-[var(--color-surface-3)] text-[var(--color-text)] font-bold text-lg flex items-center justify-center hover:bg-[var(--color-brand-600)] transition-colors"
        >
          +
        </button>

        {/* Reset to default */}
        <button
          aria-label={`Reset quantity for ${entry.name} to default`}
          onClick={() => onQuantityChange(entry.customer_id, entry.default_qty)}
          title="Reset to default"
          className="w-8 h-8 rounded-lg bg-[var(--color-surface-3)] text-[var(--color-muted)] text-xs flex items-center justify-center hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
        >
          ↺
        </button>
      </div>

      {/* Row total */}
      <div className="text-right w-20 shrink-0">
        <p className="text-xs text-[var(--color-muted)]">{t('route.label_total')}</p>
        <p className="font-bold text-[var(--color-text)]">
          ₹{(entry.quantity * entry.current_price).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

/**
 * Unified status banner.
 * variant='offline' renders in amber to clearly distinguish queued state from
 * a true success (green) or error (red).
 */
function StatusBanner({ message, variant, onDismiss }: StatusBannerProps) {
  const colours = {
    success: 'bg-[var(--color-brand-700)]/30 border-[var(--color-brand-600)] text-[var(--color-brand-100)]',
    offline: 'bg-amber-900/30 border-amber-600 text-amber-200',
    error:   'bg-red-900/30 border-red-700 text-red-200',
  } as const;

  const icons = { success: '✅', offline: '📶', error: '❌' } as const;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-3 rounded-xl border text-sm mb-4 ${colours[variant]}`}
    >
      <span className="font-medium">{icons[variant]} {message}</span>
      <button
        onClick={onDismiss}
        className="hover:text-white transition-colors font-bold shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * DailyRoute
 *
 * Offline-first flow:
 *   1. User confirms a shift → `handleConfirmShift` generates a UUID via
 *      `crypto.randomUUID()` and attempts `bulkSubmitLogs({ sync_id, logs })`.
 *   2. If the request fails with a network error (or navigator.onLine is false),
 *      the payload is persisted to IndexedDB keyed by sync_id.
 *      An amber banner informs the user the data is queued.
 *   3. A `window.online` listener fires `flushQueue` whenever the device
 *      reconnects. `flushQueue` iterates all queued keys, attempts to POST each
 *      payload, and removes it on 200 OK. Partial failures are left for the
 *      next reconnect and surfaced via the partial-sync banner.
 */
export default function DailyRoute() {
  const { t } = useTranslation();

  const [activeShift, setActiveShift]   = useState<Shift>('Morning');
  const [routeEntries, setRouteEntries] = useState<RouteEntryWithQty[]>([]);
  const [loading, setLoading]           = useState<boolean>(false);
  const [submitting, setSubmitting]     = useState<boolean>(false);
  const [error, setError]               = useState<string | null>(null);
  const [statusMsg, setStatusMsg]       = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<'success' | 'offline' | 'error'>('success');

  // useRef so flushQueue always has the freshest t() without being in dep arrays
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // ── Fetch route whenever active shift changes ──────────────────────────────
  const fetchRoute = useCallback(async (shift: Shift): Promise<void> => {
    setLoading(true);
    setError(null);
    setStatusMsg(null);

    try {
      const { data } = await getRoute(shift);
      setRouteEntries(
        data.map((entry) => ({ ...entry, quantity: entry.default_qty })),
      );
    } catch (err) {
      console.error('Failed to fetch route:', err);
      setError(t('route.fetch_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchRoute(activeShift);
  }, [activeShift, fetchRoute]);

  // ── Per-row quantity mutation ──────────────────────────────────────────────
  const handleQuantityChange = useCallback(
    (customerId: number, newQty: number): void => {
      setRouteEntries((prev) =>
        prev.map((e) =>
          e.customer_id === customerId
            ? { ...e, quantity: Math.max(0, newQty) }
            : e,
        ),
      );
    },
    [],
  );

  // ── Offline queue flush ────────────────────────────────────────────────────
  /**
   * flushQueue — called automatically when `window` emits an 'online' event.
   *
   * Algorithm:
   *   1. Read all pending sync_ids from localforage.
   *   2. For each, fetch the stored BulkSubmitPayload and POST it.
   *   3. On 2xx → removeItem (idempotency: if the server already inserted it,
   *      it should ignore the duplicate via sync_id; either way we clear it).
   *   4. On failure → leave it; will retry on next 'online' event.
   *   5. Surface a localised success / partial-sync banner.
   */
  const flushQueue = useCallback(async (): Promise<void> => {
    const translate = tRef.current;
    let keys: string[];

    try {
      keys = await offlineQueue.keys();
    } catch {
      return; // Can't read keys — silent fail
    }

    if (keys.length === 0) return;

    let synced = 0;

    await Promise.allSettled(
      keys.map(async (syncId) => {
        try {
          const payload = await offlineQueue.getItem<BulkSubmitPayload>(syncId);
          if (!payload) {
            // Stale or corrupt entry — remove it
            await offlineQueue.removeItem(syncId);
            return;
          }
          await bulkSubmitLogs(payload);
          await offlineQueue.removeItem(syncId);
          synced++;
        } catch {
          // Leave in queue — will retry on next 'online' event
        }
      }),
    );

    const remaining = keys.length - synced;

    if (remaining === 0) {
      setStatusVariant('success');
      setStatusMsg(translate('route.flush_success', { count: synced }));
    } else {
      setStatusVariant('offline');
      setStatusMsg(
        translate('route.flush_partial', { synced, total: keys.length }),
      );
    }
  }, []);

  // ── Register online event listener for queue flush ─────────────────────────
  useEffect(() => {
    const handleOnline = () => { void flushQueue(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  // ── Bulk submit with offline fallback ─────────────────────────────────────
  const handleConfirmShift = async (): Promise<void> => {
    if (routeEntries.length === 0) return;

    setSubmitting(true);
    setError(null);
    setStatusMsg(null);

    // Generate a deterministic UUID for this submission attempt.
    // This is the idempotency key sent to the backend and used as the
    // localforage key if the request must be queued.
    const sync_id = crypto.randomUUID();

    const logs: BulkLogItem[] = routeEntries.map((e) => ({
      customer_id:    e.customer_id,
      product_id:     e.product_id,
      quantity:       e.quantity,
      shift:          activeShift,
      recorded_price: e.current_price,
    }));

    const payload: BulkSubmitPayload = { sync_id, logs };

    try {
      await bulkSubmitLogs(payload);
      setStatusVariant('success');
      setStatusMsg(
        t('route.success_online', {
          shift: activeShift,
          count: routeEntries.length,
        }),
      );
    } catch (err) {
      if (isNetworkError(err)) {
        // ── Offline path: persist to IndexedDB and show amber banner ─────────
        try {
          await offlineQueue.setItem(sync_id, payload);
          setStatusVariant('offline');
          setStatusMsg(
            t('route.success_queued', {
              shift: activeShift,
              count: routeEntries.length,
            }),
          );
        } catch (storageErr) {
          console.error('localforage write failed:', storageErr);
          setStatusVariant('error');
          setStatusMsg(t('route.submit_error'));
        }
      } else {
        // ── Server-side error (4xx / 5xx) — not a queue candidate ────────────
        console.error('Bulk log failed:', err);
        const axiosErr = err as AxiosError<{ message?: string }>;
        setStatusVariant('error');
        setStatusMsg(
          axiosErr.response?.data?.message ?? t('route.submit_error'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const shiftTotal: number = routeEntries.reduce(
    (sum, e) => sum + e.quantity * e.current_price,
    0,
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="max-w-3xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
          {t('route.page_title')}
        </h1>
        <p className="text-[var(--color-muted)] mt-1 text-sm">
          {t('route.page_subtitle')}
        </p>
      </div>

      {/* Shift tabs */}
      <ShiftTabs activeShift={activeShift} onSelect={setActiveShift} />

      {/* Status banners */}
      {statusMsg && (
        <StatusBanner
          message={statusMsg}
          variant={statusVariant}
          onDismiss={() => setStatusMsg(null)}
        />
      )}
      {error && (
        <StatusBanner
          message={error}
          variant="error"
          onDismiss={() => setError(null)}
        />
      )}

      {/* Route list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-[var(--color-surface-2)] animate-pulse"
            />
          ))}
        </div>
      ) : routeEntries.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted)]">
          <p className="text-4xl mb-3">🥛</p>
          <p className="font-semibold">{t('route.empty_route', { shift: activeShift })}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {routeEntries.map((entry) => (
            <RouteRow
              key={entry.customer_id}
              entry={entry}
              onQuantityChange={handleQuantityChange}
            />
          ))}
        </div>
      )}

      {/* Footer: shift total + confirm button */}
      {routeEntries.length > 0 && !loading && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
          <div>
            <p className="text-xs text-[var(--color-muted)] uppercase tracking-widest">
              {t('route.label_shift_total')}
            </p>
            <p className="text-3xl font-extrabold text-[var(--color-brand-400)]">
              ₹{shiftTotal.toFixed(2)}
            </p>
          </div>

          <button
            id="confirm-shift-btn"
            onClick={() => void handleConfirmShift()}
            disabled={submitting}
            className="px-8 py-3 rounded-xl font-bold text-white bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-500)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-900/30 active:scale-95"
          >
            {submitting
              ? t('route.btn_logging')
              : t('route.btn_confirm', { shift: activeShift })}
          </button>
        </div>
      )}
    </section>
  );
}
