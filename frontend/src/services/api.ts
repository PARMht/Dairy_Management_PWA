import axios, { type AxiosResponse } from 'axios';
import type {
  Customer,
  RouteEntry,
  BulkLogItem,
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
 * Sends an array of BulkLogItem objects; backend calculates total_charge.
 */
export const bulkSubmitLogs = (
  logs: BulkLogItem[],
): Promise<AxiosResponse<{ inserted: number }>> =>
  api.post<{ inserted: number }>('/logs/bulk', logs);

// ─── Payment endpoints ────────────────────────────────────────────────────────

/**
 * Log a payment received from a customer to clear arrears.
 */
export const createPayment = (
  payload: CreatePaymentPayload,
): Promise<AxiosResponse<{ payment_id: number }>> =>
  api.post<{ payment_id: number }>('/payments', payload);

export default api;
