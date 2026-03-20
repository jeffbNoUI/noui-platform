// Shared API client — single source for fetch helpers, retry, request tracing.
// All per-service API modules (api.ts, crmApi.ts, etc.) delegate to this.

import { reportError } from './errorReporter';

// Auth token for API requests — set by AuthContext
let _authToken = '';
export function setAuthToken(token: string) {
  _authToken = token;
}

// ─── Enum normalization ──────────────────────────────────────────────────────
// Go services return PostgreSQL enum values in UPPERCASE (e.g. 'OPEN', 'PUBLIC').
// TypeScript types use lowercase (e.g. 'open', 'public'). This transform bridges
// the gap by lowercasing known enum fields in API responses.

const ENUM_FIELDS = new Set([
  'contactType',
  'status',
  'channel',
  'interactionType',
  'outcome',
  'direction',
  'visibility',
  'preferredChannel',
  'addressType',
  'preferenceType',
  'orgType',
  'anchorType',
  'employerStatus',
  'securityFlag',
  'priority',
  'sentiment',
  'linkType',
  'primaryPhoneType',
  'gender',
  'slaStatus',
  'category',
  'subcategory',
]);

function normalizeEnums(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeEnums);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (ENUM_FIELDS.has(key) && typeof value === 'string') {
        result[key] = value.toLowerCase();
      } else {
        result[key] = normalizeEnums(value);
      }
    }
    return result;
  }
  return obj;
}

export interface APIResponse<T> {
  data: T;
  meta: { requestId: string; timestamp: string };
}

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

function generateRequestId(): string {
  // crypto.randomUUID is available in all modern browsers
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRYABLE_STATUSES = new Set([503, 502, 504]);
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// rawRequest performs the HTTP request with retry logic and returns the full parsed JSON body.
async function rawRequest(
  url: string,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<unknown> {
  const requestId = generateRequestId();
  const headers = new Headers(init.headers);
  headers.set('X-Request-ID', requestId);
  if (_authToken) {
    headers.set('Authorization', `Bearer ${_authToken}`);
  }
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[api] Retry ${attempt}/${MAX_RETRIES} for ${init.method ?? 'GET'} ${url} after ${delay}ms`,
      );
      await sleep(delay);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        // Retry on transient server errors (only for idempotent requests or first POST attempt)
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = new APIError(`Server returned ${res.status}`, res.status, requestId, url);
          continue;
        }

        const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
        const message = errBody.error?.message || `API error: ${res.status}`;
        const errorCode = errBody.error?.code || `HTTP_${res.status}`;
        const apiError = new APIError(message, res.status, requestId, url);
        console.error(`[api] ${init.method ?? 'GET'} ${url} → ${res.status}`, {
          requestId,
          status: res.status,
          message,
        });
        reportError({
          requestId,
          url,
          httpStatus: res.status,
          errorCode,
          errorMessage: message,
          portal: detectPortal(),
          route: typeof window !== 'undefined' ? window.location.pathname : '',
        });
        throw apiError;
      }

      return normalizeEnums(await res.json());
    } catch (err) {
      clearTimeout(timer);
      // Abort errors (timeout) are not retryable
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new APIError('Request timed out', 0, requestId, url);
      }
      // Network errors (offline, DNS failure, etc.) — retry
      if (err instanceof TypeError && attempt < MAX_RETRIES) {
        lastError = err;
        continue;
      }
      // APIError already logged above
      if (err instanceof APIError) throw err;
      // Unexpected error
      console.error(`[api] ${init.method ?? 'GET'} ${url} → network error`, {
        requestId,
        error: err,
      });
      throw err;
    }
  }

  // All retries exhausted
  throw lastError ?? new Error(`Request failed after ${MAX_RETRIES + 1} attempts`);
}

// request unwraps body.data — used for non-paginated endpoints.
async function request<T>(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const body = await rawRequest(url, init, timeoutMs);
  return lowercaseEnums((body as APIResponse<T>).data) as T;
}

// ─── Enum case helpers (outgoing requests) ──────────────────────────────────
// Reuses the ENUM_FIELDS set declared at the top of this file.

function uppercaseEnums(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(uppercaseEnums);
  if (typeof obj !== 'object') return obj;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (ENUM_FIELDS.has(key) && typeof value === 'string') {
      out[key] = value.toUpperCase();
    } else if (typeof value === 'object' && value !== null) {
      out[key] = uppercaseEnums(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function lowercaseEnums(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(lowercaseEnums);
  if (typeof obj !== 'object') return obj;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (ENUM_FIELDS.has(key) && typeof value === 'string') {
      out[key] = value.toLowerCase();
    } else if (typeof value === 'object' && value !== null) {
      out[key] = lowercaseEnums(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ─── Public helpers ─────────────────────────────────────────────────────────

export function fetchAPI<T>(url: string, opts?: FetchOptions): Promise<T> {
  return request<T>(url, {}, opts?.timeout);
}

// fetchPaginatedAPI preserves both data and pagination from the response.
// Go services return { data: T[], pagination: {...}, meta: {...} }.
// fetchAPI only returns data — this variant also returns pagination.
export interface PaginatedResult<T> {
  items: T[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

interface FetchOptions {
  timeout?: number;
}

export async function fetchPaginatedAPI<T>(
  url: string,
  opts?: FetchOptions,
): Promise<PaginatedResult<T>> {
  const body = (await rawRequest(url, {}, opts?.timeout)) as {
    data?: T[];
    pagination?: PaginatedResult<T>['pagination'];
  };
  return {
    items: lowercaseEnums(body.data ?? []) as T[],
    pagination: body.pagination ?? { total: 0, limit: 25, offset: 0, hasMore: false },
  };
}

export function postAPI<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(uppercaseEnums(payload)) });
}

export function putAPI<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, { method: 'PUT', body: JSON.stringify(uppercaseEnums(payload)) });
}

export function patchAPI<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, { method: 'PATCH', body: JSON.stringify(uppercaseEnums(payload)) });
}

export function deleteAPI<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'DELETE' });
}

export function toQueryString(params: object): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function detectPortal(): string {
  if (typeof window === 'undefined') return 'unknown';
  const path = window.location.pathname;
  if (path.startsWith('/employer')) return 'employer';
  if (path.startsWith('/member')) return 'member';
  if (path.startsWith('/retirement')) return 'retirement';
  return 'staff';
}
