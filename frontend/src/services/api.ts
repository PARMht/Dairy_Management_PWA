import axios, { type AxiosResponse } from 'axios';
import type {
  Customer,
  InactiveCustomerSearchResult,
  ProductListItem,
  RouteEntry,
  BulkSubmitPayload,
  CreateCustomerPayload,
  CreatePaymentPayload,
  CustomerBalance,
  PaymentRecord,
  CreateProductPayload,
  UpdateProductPayload,
  ToggleSubscriberPayload,
  UpdateSubscriptionPayload,
  LogHistoryResponse,
  LogHistoryEntry,
  MonthlyBillResponse,
} from '../types';

// ─── Base Axios instance ──────────────────────────────────────────────────────
// Points to the Express backend. Change the base URL here once deployed.
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',   // bypass ngrok free-tier interstitial
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

// ─── Payment endpoints (new) ──────────────────────────────────────────────────
export const getCustomerBalance = (
  customerId: number,
): Promise<AxiosResponse<CustomerBalance>> =>
  api.get<CustomerBalance>(`/payments/balance/${customerId}`);

export const getPaymentsByCustomer = (
  customerId: number,
): Promise<AxiosResponse<PaymentRecord[]>> =>
  api.get<PaymentRecord[]>(`/payments/${customerId}`);

// ─── Product endpoints (new) ──────────────────────────────────────────────────
export const createProduct = (
  payload: CreateProductPayload,
): Promise<AxiosResponse<{ product_id: number }>> =>
  api.post<{ product_id: number }>('/products', payload);

export const updateProduct = (
  id: number,
  payload: UpdateProductPayload,
): Promise<AxiosResponse<{ message: string }>> =>
  api.put<{ message: string }>(`/products/${id}`, payload);

export const deactivateProduct = (
  id: number,
): Promise<AxiosResponse<{ message: string }>> =>
  api.delete<{ message: string }>(`/products/${id}`);

// ─── Customer management endpoints (new) ──────────────────────────────────────
export const deactivateCustomer = (
  id: number,
): Promise<AxiosResponse<{ message: string }>> =>
  api.delete<{ message: string }>(`/customers/${id}`);

export const toggleSubscriberStatus = (
  id: number,
  payload: ToggleSubscriberPayload,
): Promise<AxiosResponse<{ message: string }>> =>
  api.patch<{ message: string }>(`/customers/${id}/toggle`, payload);

export const updateSubscription = (
  customerId: number,
  payload: UpdateSubscriptionPayload,
): Promise<AxiosResponse<{ message: string }>> =>
  api.patch<{ message: string }>(`/customers/${customerId}/subscription`, payload);

// ─── Log history endpoints (new) ──────────────────────────────────────────────
export const getLogHistory = (
  params: { page?: number; limit?: number; customer_id?: number; from?: string; to?: string },
): Promise<AxiosResponse<LogHistoryResponse>> =>
  api.get<LogHistoryResponse>('/logs', { params });

export const updateLog = (
  id: number,
  payload: { quantity?: number; recorded_price?: number },
): Promise<AxiosResponse<{ message: string; total_charge: number }>> =>
  api.patch<{ message: string; total_charge: number }>(`/logs/${id}`, payload);

// ─── Billing endpoints (new) ──────────────────────────────────────────────────
export const getMonthlyBill = (
  month: string,
): Promise<AxiosResponse<MonthlyBillResponse>> =>
  api.get<MonthlyBillResponse>(`/billing/${month}`);

export const getCustomerLedger = (
  customerId: number,
): Promise<AxiosResponse<{ balance: CustomerBalance; logs: LogHistoryEntry[]; payments: PaymentRecord[] }>> =>
  api.get(`/billing/customer/${customerId}`);

export default api;
