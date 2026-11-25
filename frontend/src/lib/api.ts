import type { HealthResponse, OacToken, Receipt, RelayResult } from '../types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';
const RELAY_KEY = (import.meta.env.VITE_RELAY_API_KEY as string | undefined) || '';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = 'API_ERROR', status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function url(path: string): string {
  return `${BASE}/api/v1${path}`;
}

function headers(bearer?: string): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-RIFT-Client-Version': '1.0.0',
  };
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  return h;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url(path), { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const envelope = body as { error?: { code?: string; message?: string } } | null;
      throw new ApiError(
        envelope?.error?.message || `Request failed (${res.status})`,
        envelope?.error?.code || 'API_ERROR',
        res.status,
      );
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') throw new ApiError('Core timed out', 'TIMEOUT');
    throw new ApiError((err as Error).message || 'Network unavailable', 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { method: 'GET' }, 2500);
}

export interface RegisterResponse {
  user_id: string;
  user_type: 'CUSTOMER' | 'MERCHANT';
  display_name: string;
  phone_number: string;
  public_key_hex: string;
  mock_account_number: string;
  mock_balance_kobo: number;
  created_at: string;
}

export async function register(input: {
  user_type: 'CUSTOMER' | 'MERCHANT';
  display_name: string;
  phone_number: string;
  public_key_hex: string;
  business_name?: string;
  merchant_code?: string;
}): Promise<RegisterResponse> {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
}

export interface IssueResponse extends OacToken {
  available_balance_kobo: number;
  reserved_balance_kobo: number;
}

export async function issueAllocation(
  customerId: string,
  amountKobo: number,
  durationHours = 6,
): Promise<IssueResponse> {
  return request<IssueResponse>('/allocations/issue', {
    method: 'POST',
    headers: headers(customerId),
    body: JSON.stringify({
      amount_kobo: amountKobo,
      duration_hours: durationHours,
      customer_id: customerId,
    }),
  });
}

export interface AllocationStatusResponse {
  oac_id: string;
  customer_id: string;
  allocated_amount_kobo: number;
  spent_amount_kobo: number;
  remaining_amount_kobo: number;
  currency: string;
  status: string;
  issued_at: string;
  expires_at: string;
  issuer_key_version: string;
  available_balance_kobo: number;
  reserved_balance_kobo: number;
}

export async function getAllocation(customerId: string, oacId: string): Promise<AllocationStatusResponse> {
  return request<AllocationStatusResponse>(`/allocations/${encodeURIComponent(oacId)}`, {
    method: 'GET',
    headers: headers(customerId),
  });
}

export async function relayTransactions(receipts: Receipt[], relayNodeId: string): Promise<RelayResult[]> {
  const body = {
    relay_node_id: relayNodeId,
    relayed_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    transactions: receipts.map((r) => ({
      transaction_id: r.transaction_id,
      oac_id: r.oac_id,
      seq_no: r.seq_no,
      merchant_id: r.merchant_id,
      amount_kobo: r.amount_kobo,
      currency: r.currency,
      invoice_nonce: r.invoice_nonce,
      customer_timestamp: r.customer_timestamp,
      customer_pubkey_hex: r.customer_pubkey_hex,
      customer_signature_hex: r.customer_signature_hex,
      oac_token: r.oac_token,
    })),
  };
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (RELAY_KEY) h['X-Relay-Api-Key'] = RELAY_KEY;
  const res = await request<{ results: RelayResult[] }>('/transactions/relay', {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
  return res.results ?? [];
}

export async function resetSim(adminSecret: string): Promise<void> {
  await request('/sim/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
  });
}
