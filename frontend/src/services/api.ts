import axios, { type AxiosResponse } from 'axios';
import type {
  Customer,
  InactiveCustomerSearchResult,
  ProductListItem,
  RouteEntry,
  BulkSubmitPayload,
  CreateCustomerPayload,
  CreatePaymentPayload,
} from '../types';

// ─── Base Axios instance ──────────────────────────────────────────────────────
// Points to the Express backend. Change the base URL here once deployed.
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Customer endpoints ───────────────────────────────────────────────────────

/**
 * Fetch customers filtered by subscriber status.
 * @param isSubscriber  true → route subscribers, false → ad-hoc, null → all
 */
export const getCustomers = (
  isSubscriber: boolean | null = null,
): Promise<AxiosResponse<Customer[]>> => {
  const params = isSubscriber !== null ? { is_subscriber: isSubscriber } : {};
  return api.get<Customer[]>('/customers', { params });
};

/**
 * Create a new customer (subscriber or ad-hoc).
 * The backend handles inserting into Subscriptions or Daily_Logs accordingly.
 */
export const createCustomer = (
  payload: CreateCustomerPayload,
): Promise<AxiosResponse<Customer>> => api.post<Customer>('/customers', payload);

/**
 * Search for inactive (soft-deleted) customers by phone number fragment.
 *
 * Targets:  GET /api/customers/search?phone=<query>
 * Backend:  SELECTs { id, name, phone } WHERE is_active = FALSE AND phone LIKE '%query%' LIMIT 5
 *
 * @param phone  Partial or full phone number string to match against.
 *               The backend wraps it in SQL wildcards; pass the raw digits only.
 */
export const searchInactiveCustomers = (
  phone: string,
): Promise<AxiosResponse<InactiveCustomerSearchResult[]>> =>
  api.get<InactiveCustomerSearchResult[]>('/customers/search', {
    params: { phone },
  });

// ─── Product endpoints ───────────────────────────────────────────────────────

/**
 * Fetch all active products.
 * Returns a slim projection: { product_id, name, current_price }[]
 * Backend query: SELECT id AS product_id, name, current_price FROM Products WHERE is_active = TRUE
 */
export const getProducts = (): Promise<AxiosResponse<ProductListItem[]>> =>
  api.get<ProductListItem[]>('/products');

// ─── Daily Route endpoints ────────────────────────────────────────────────────

/**
 * Fetch the route list for a given shift.
 * Returns an array of RouteEntry objects joined from Subscriptions + Customers + Products.
 */
export const getRoute = (
  shift: string,
): Promise<AxiosResponse<RouteEntry[]>> =>
  api.get<RouteEntry[]>('/route', { params: { shift } });

/**
 * Bulk-submit the confirmed route for a shift.
 *
 * Accepts a BulkSubmitPayload envelope:
 *   { sync_id: string (UUID), logs: BulkLogItem[] }
 *
 * `sync_id` lets the backend treat replayed payloads idempotently —
 * a UUID collision means "already processed; skip".
 */
export const bulkSubmitLogs = (
  payload: BulkSubmitPayload,
): Promise<AxiosResponse<{ inserted: number }>> =>
  api.post<{ inserted: number }>('/logs/bulk', payload);

// ─── Payment endpoints ────────────────────────────────────────────────────────

/**
 * Log a payment received from a customer to clear arrears.
 */
export const createPayment = (
  payload: CreatePaymentPayload,
): Promise<AxiosResponse<{ payment_id: number }>> =>
  api.post<{ payment_id: number }>('/payments', payload);

export default api;
