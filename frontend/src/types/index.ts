// ─────────────────────────────────────────────────────────────────────────────
// Domain types derived directly from the backend SQL schema and API spec.
// Every field name mirrors the snake_case column / JSON key returned by Express.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enumerations ─────────────────────────────────────────────────────────────

/** The three delivery windows recognised by the backend. */
export type Shift = 'Morning' | 'Afternoon' | 'Evening';

/** Payment methods supported by the Payments table. */
export type PaymentMethod = 'Cash' | 'UPI' | 'Other';

// ─── Customer ─────────────────────────────────────────────────────────────────

/**
 * A row from the `Customers` table as returned by GET /api/customers.
 * `is_subscriber` drives which extra fields are present on the related records.
 * `is_active` reflects the v2.0 soft-delete flag (schema: DEFAULT TRUE).
 */
export interface Customer {
  customer_id: number;
  name: string;
  phone: string;
  is_subscriber: boolean;
  is_active: boolean;   // soft-delete flag — FALSE means the customer is deactivated
  created_at: string;  // ISO-8601 datetime string from MySQL
}

/**
 * Slim projection returned by GET /api/customers/search?phone=<query>.
 * The backend SELECTs only { id, name, phone } from inactive rows (is_active = FALSE).
 * Note: the column is `id` in this response, not `customer_id`, mirroring the raw SQL.
 */
export interface InactiveCustomerSearchResult {
  id: number;
  name: string;
  phone: string;
}

// ─── Product ──────────────────────────────────────────────────────────────────

/**
 * Minimal product data embedded inside other responses.
 * `is_active` reflects the v2.0 soft-delete flag (schema: DEFAULT TRUE).
 */
export interface Product {
  product_id: number;
  name: string;
  price_per_unit: number;
  is_active: boolean;  // soft-delete flag — FALSE means the product is retired
}

/**
 * Slim projection returned by GET /api/products.
 * Backend query: SELECT id AS product_id, name, current_price FROM Products WHERE is_active = TRUE
 */
export interface ProductListItem {
  product_id: number;
  name: string;
  current_price: number;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

/** A row from the `Subscriptions` table. */
export interface Subscription {
  subscription_id: number;
  customer_id: number;
  product_id: number;
  shift: Shift;
  default_qty: number;
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * One entry in the array returned by GET /api/route?shift=<Shift>.
 * Produced by a JOIN of Subscriptions + Customers + Products.
 */
export interface RouteEntry {
  customer_id: number;
  name: string;          // Customers.name
  product_id: number;
  product_name: string;  // Products.name
  default_qty: number;   // Subscriptions.default_qty
  current_price: number; // Products.price_per_unit at query time
}

/**
 * RouteEntry augmented with the user's live quantity adjustment.
 * The `quantity` field starts equal to `default_qty` and is mutated in the UI.
 */
export interface RouteEntryWithQty extends RouteEntry {
  quantity: number;
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

/** One item in the POST /api/logs/bulk request body array. */
export interface BulkLogItem {
  customer_id: number;
  product_id: number;
  quantity: number;
  shift: Shift;
  recorded_price: number;
}

/**
 * Full payload sent to POST /api/logs/bulk (online) or persisted to
 * IndexedDB via localforage (offline).
 *
 * `sync_id` is a client-generated UUID (crypto.randomUUID()) used by the
 * backend as an idempotency key — if the PWA replays the same payload after
 * reconnecting, the server can detect and safely skip the duplicate insert.
 */
export interface BulkSubmitPayload {
  sync_id: string;
  logs: BulkLogItem[];
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/** POST /api/payments request body. */
export interface CreatePaymentPayload {
  customer_id: number;
  amount: number;
  method: PaymentMethod;
  notes: string;
}

// ─── Request bodies for POST /api/customers ───────────────────────────────────

interface CustomerBase {
  name: string;
  phone: string;
}

export interface CreateSubscriberPayload extends CustomerBase {
  is_subscriber: true;
  product_id: number;
  shift: Shift;
  default_qty: number;
}

export interface CreateAdHocPayload extends CustomerBase {
  is_subscriber: false;
  product_id: number;
  quantity: number;
}

/** Union that narrows based on the `is_subscriber` discriminant. */
export type CreateCustomerPayload = CreateSubscriberPayload | CreateAdHocPayload;

// ─── Generic API response wrappers ────────────────────────────────────────────

/** Standard success envelope from the backend. */
export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

/** Shape of an Axios error response body from our Express backend. */
export interface ApiErrorBody {
  message: string;
  error?: string;
}
