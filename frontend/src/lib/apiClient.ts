// Shared API client — single source for fetch helpers, retry, request tracing.
// All per-service API modules (api.ts, crmApi.ts, etc.) delegate to this.

export interface APIResponse<T> {
  data: T;
  meta: { request_id: string; timestamp: string };
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const requestId = generateRequestId();
  const headers = new Headers(init.headers);
  headers.set('X-Request-ID', requestId);
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

    try {
      const res = await fetch(url, { ...init, headers });

      if (!res.ok) {
        // Retry on transient server errors (only for idempotent requests or first POST attempt)
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = new APIError(`Server returned ${res.status}`, res.status, requestId, url);
          continue;
        }

        const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
        const message = errBody.error?.message || `API error: ${res.status}`;
        const apiError = new APIError(message, res.status, requestId, url);
        console.error(`[api] ${init.method ?? 'GET'} ${url} → ${res.status}`, {
          requestId,
          status: res.status,
          message,
        });
        throw apiError;
      }

      const body: APIResponse<T> = await res.json();
      return body.data;
    } catch (err) {
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

// ─── Public helpers ─────────────────────────────────────────────────────────

export function fetchAPI<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function postAPI<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(payload) });
}

export function putAPI<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, { method: 'PUT', body: JSON.stringify(payload) });
}

export function patchAPI<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, { method: 'PATCH', body: JSON.stringify(payload) });
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
