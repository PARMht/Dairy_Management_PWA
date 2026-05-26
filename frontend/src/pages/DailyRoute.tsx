import { useState, useEffect, useCallback } from 'react';
import { getRoute, bulkSubmitLogs } from '../services/api';
import type { Shift, RouteEntryWithQty, BulkLogItem } from '../types';
import type { AxiosError } from 'axios';

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: Shift[] = ['Morning', 'Afternoon', 'Evening'];

// ─── Prop interfaces ──────────────────────────────────────────────────────────

interface ShiftTabsProps {
  activeShift: Shift;
  onSelect: (shift: Shift) => void;
}

interface RouteRowProps {
  entry: RouteEntryWithQty;
  onQuantityChange: (customerId: number, newQty: number) => void;
}

interface SuccessBannerProps {
  message: string;
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
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] transition-all hover:border-[var(--color-brand-700)]">
      {/* Customer info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--color-text)] truncate">{entry.name}</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{entry.product_name}</p>
      </div>

      {/* Price */}
      <div className="text-right hidden sm:block">
        <p className="text-xs text-[var(--color-muted)]">Price / unit</p>
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
        <p className="text-xs text-[var(--color-muted)]">Total</p>
        <p className="font-bold text-[var(--color-text)]">
          ₹{(entry.quantity * entry.current_price).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

/** Status banner shown after a successful submit */
function SuccessBanner({ message, onDismiss }: SuccessBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-[var(--color-brand-700)]/30 border border-[var(--color-brand-600)] text-[var(--color-brand-100)] mb-4 animate-fade-in">
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="text-[var(--color-brand-400)] hover:text-white transition-colors font-bold"
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
 * Displays the Morning / Afternoon / Evening shift tabs, loads the route from
 * the backend, lets the user adjust per-customer quantities, then submits the
 * whole shift as a single bulk log POST.
 *
 * State shape:
 *   routeEntries: RouteEntryWithQty[]  — RouteEntry + live `quantity` field
 */
export default function DailyRoute() {
  const [activeShift, setActiveShift] = useState<Shift>('Morning');
  const [routeEntries, setRouteEntries] = useState<RouteEntryWithQty[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Fetch route whenever the active shift changes ──────────────────────────
  const fetchRoute = useCallback(async (shift: Shift): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { data } = await getRoute(shift);
      // Seed `quantity` from `default_qty` so the user starts from the default
      setRouteEntries(
        data.map((entry) => ({ ...entry, quantity: entry.default_qty })),
      );
    } catch (err) {
      console.error('Failed to fetch route:', err);
      setError('Could not load route. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoute(activeShift);
  }, [activeShift, fetchRoute]);

  // ── Per-row quantity mutation (immutable update) ───────────────────────────
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

  // ── Bulk submit ───────────────────────────────────────────────────────────
  const handleConfirmShift = async (): Promise<void> => {
    if (routeEntries.length === 0) return;

    setSubmitting(true);
    setError(null);

    // Build the payload expected by POST /api/logs/bulk
    const payload: BulkLogItem[] = routeEntries.map((e) => ({
      customer_id:    e.customer_id,
      product_id:     e.product_id,
      quantity:       e.quantity,
      shift:          activeShift,
      recorded_price: e.current_price,
    }));

    try {
      await bulkSubmitLogs(payload);
      setSuccessMsg(
        `${activeShift} shift logged successfully for ${routeEntries.length} customer(s)!`,
      );
    } catch (err) {
      console.error('Bulk log failed:', err);
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(
        axiosErr.response?.data?.message ?? 'Submission failed. Please try again.',
      );
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
          Daily Route
        </h1>
        <p className="text-[var(--color-muted)] mt-1 text-sm">
          Adjust quantities then confirm to log the shift.
        </p>
      </div>

      {/* Shift tabs */}
      <ShiftTabs activeShift={activeShift} onSelect={setActiveShift} />

      {/* Success / error banners */}
      {successMsg && (
        <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}
      {error && (
        <div className="px-5 py-3 rounded-xl bg-red-900/30 border border-red-700 text-red-200 text-sm mb-4">
          {error}
        </div>
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
          <p className="font-semibold">No customers on the {activeShift} route.</p>
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
              Shift Total
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
            {submitting ? 'Logging…' : `Confirm ${activeShift} Shift`}
          </button>
        </div>
      )}
    </section>
  );
}
