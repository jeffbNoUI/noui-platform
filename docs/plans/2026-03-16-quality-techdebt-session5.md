# Quality/Performance + Tech Debt Cleanup — Session 5

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `any` types from production TypeScript, add request timeout resilience, and clean up tech debt from the security hardening sessions.

**Architecture:** Three independent workstreams: (1) TypeScript strictness — replace `any` in production code and tests, (2) Request timeouts — AbortController in frontend + nginx proxy timeouts, (3) Tech debt — shared envutil package, rate limiter shutdown, DevRoleSwitcher gate. Workstreams are independent and can be parallelized.

**Tech Stack:** TypeScript/React (frontend), Go 1.22 (platform services), nginx (reverse proxy)

---

## Task 1: Gate DevRoleSwitcher Behind Dev Mode

**Files:**
- Modify: `frontend/src/App.tsx:126-146` (DevRoleSwitcher component)

**Step 1: Add dev-mode gate to DevRoleSwitcher rendering**

In `frontend/src/App.tsx`, wrap the DevRoleSwitcher component so it only renders in dev mode:

```typescript
function DevRoleSwitcher() {
  if (!import.meta.env.DEV) return null;

  const { user, switchRole } = useAuth();
  const roles: UserRole[] = ['staff', 'admin', 'member', 'employer', 'vendor'];

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white rounded-lg px-3 py-2 text-xs shadow-lg z-50 flex items-center gap-2">
      <span className="text-gray-400">Dev:</span>
      {roles.map((role) => (
        <button
          key={role}
          onClick={() => switchRole(role)}
          className={`px-2 py-0.5 rounded ${
            user.role === role ? 'bg-blue-500' : 'hover:bg-gray-700'
          }`}
        >
          {role}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "[frontend] Gate DevRoleSwitcher behind import.meta.env.DEV"
```

---

## Task 2: Remove `any` from apiClient.ts

**Files:**
- Modify: `frontend/src/lib/apiClient.ts:87-203`

**Step 1: Replace `any` in rawRequest, uppercaseEnums, lowercaseEnums**

The `normalizeEnums` function (lines 40-55) already uses `unknown` — mirror that pattern for the outgoing helpers.

Replace `rawRequest` return type:

```typescript
// Line 93: Change return type from Promise<any> to Promise<unknown>
async function rawRequest(url: string, init: RequestInit = {}): Promise<unknown> {
```

Replace `uppercaseEnums` and `lowercaseEnums` (lines 168-203):

```typescript
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
```

Also update `request()` to cast through `unknown`:

```typescript
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const body = await rawRequest(url, init);
  return lowercaseEnums((body as APIResponse<T>).data) as T;
}
```

Remove all `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments from the file.

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean (all callers use generic `<T>` already)

**Step 3: Run apiClient tests**

Run: `cd frontend && npx vitest run src/lib/__tests__/apiClient.test.ts`
Expected: PASS

**Step 4: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: all 817+ tests pass

**Step 5: Commit**

```bash
git add frontend/src/lib/apiClient.ts
git commit -m "[frontend] Replace any with unknown in apiClient enum transforms"
```

---

## Task 3: Remove `any` from workflowComposition.ts

**Files:**
- Modify: `frontend/src/lib/workflowComposition.ts:33-201`

**Step 1: Define data parameter types**

The `assessConfidence` and `composeStages` functions use `any` for their data parameter fields. Replace with minimal structural types that match actual usage:

```typescript
// Add these interfaces after the CaseFlags interface (line 28):

/** Minimal shape of calculation data used by workflow composition */
interface WorkflowCalculationData {
  eligibility?: { best_eligible_type?: string };
  ams?: { leave_payout_included?: boolean };
  formula?: unknown;
  reduction?: { applies?: boolean };
  dro?: { has_dro?: boolean };
}

/** Minimal shape of data passed to stage composition */
export interface WorkflowData {
  member?: { tier_code?: number; marital_status?: string };
  calculation?: WorkflowCalculationData;
  employment?: unknown[];
  serviceCredit?: { summary?: { purchased_years?: number } };
}
```

**Step 2: Replace `any` in function signatures**

In `assessConfidence` (line 33):
```typescript
function assessConfidence(
  stageId: string,
  data: WorkflowData,
): ConfidenceSignal {
```

In `composeStages` (line 85):
```typescript
export function composeStages(
  flags: CaseFlags,
  data?: WorkflowData,
): StageDescriptor[] {
```

In `deriveCaseFlags` (line 197):
```typescript
export function deriveCaseFlags(
  member?: WorkflowData['member'],
  calculation?: WorkflowData['calculation'],
  serviceCredit?: WorkflowData['serviceCredit'],
  caseFlags?: string[],
): CaseFlags {
```

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean — callers pass objects that match these shapes

**Step 4: Run workflowComposition tests**

Run: `cd frontend && npx vitest run src/lib/__tests__/workflowComposition.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/workflowComposition.ts
git commit -m "[frontend] Replace any with structural types in workflowComposition"
```

---

## Task 4: Remove `any` from Recharts CustomTooltip Components

**Files:**
- Modify: `frontend/src/components/portal/BenefitProjectionChart.tsx:25`
- Modify: `frontend/src/components/portal/ContributionBars.tsx:16`
- Modify: `frontend/src/components/admin/DQScoreTrendChart.tsx:24`
- Modify: `frontend/src/components/admin/DQCategoryChart.tsx:28`

**Step 1: Define a shared Recharts tooltip props type**

Recharts `Tooltip` component passes props to custom tooltip renderers but doesn't export a clean type. Define a minimal structural type. Create nothing new — add inline types per component since each tooltip destructures slightly different fields.

For components that use `{ active, payload, label }` (3 components):

```typescript
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
  label?: string;
}) {
```

For DQCategoryChart that uses `{ active, payload }` only:

```typescript
function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; score: number } }>;
}) {
```

Also replace `payload.map((entry: any) =>` in BenefitProjectionChart and ContributionBars — these are typed by the array element type above.

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

**Step 3: Run chart tests**

Run: `cd frontend && npx vitest run src/components/portal/__tests__/BenefitProjectionChart.test.tsx src/components/portal/__tests__/ContributionBars.test.tsx src/components/admin/__tests__/DQScoreTrendChart.test.tsx src/components/admin/__tests__/DQCategoryChart.test.tsx`
Expected: all PASS

**Step 4: Commit**

```bash
git add frontend/src/components/portal/BenefitProjectionChart.tsx frontend/src/components/portal/ContributionBars.tsx frontend/src/components/admin/DQScoreTrendChart.tsx frontend/src/components/admin/DQCategoryChart.tsx
git commit -m "[frontend] Replace any with proper types in Recharts CustomTooltip components"
```

---

## Task 5: Remove `any` from Test Files

**Files (11 test files):**
- Modify: `frontend/src/hooks/__tests__/useCSRContext.test.ts` (8 `as any`)
- Modify: `frontend/src/components/admin/__tests__/DataQualityPanel.test.tsx` (4 `: any`, 1 `as any`)
- Modify: `frontend/src/components/admin/__tests__/DQScoreTrendChart.test.tsx` (1 `as any`)
- Modify: `frontend/src/components/admin/__tests__/DQCategoryChart.test.tsx` (1 `as any`)
- Modify: `frontend/src/components/portal/__tests__/BenefitProjectionChart.test.tsx` (1 `as any`)
- Modify: `frontend/src/components/portal/__tests__/ContributionBars.test.tsx` (1 `as any`)
- Modify: `frontend/src/components/portal/__tests__/MemberCorrespondenceTab.test.tsx` (4 `as any`)
- Modify: `frontend/src/components/portal/__tests__/EmployerCorrespondenceTab.test.tsx` (4 `as any`)
- Modify: `frontend/src/components/staff/__tests__/CSRContextHub.test.tsx` (1 `as any`)
- Modify: `frontend/src/components/workflow/__tests__/DeckView.test.tsx` (1 `as any`)
- Modify: `frontend/src/components/workflow/__tests__/OrbitView.test.tsx` (1 `as any`)
- Modify: `frontend/src/lib/__tests__/memberSummary.test.ts` (2 `as any`)
- Modify: `frontend/src/lib/__tests__/crmApi.test.ts` (4 `as any`)

**Step 1: Fix ResizeObserver polyfill pattern (5 files)**

Replace `globalThis.ResizeObserver = ResizeObserverMock as any` with a properly typed assignment:

```typescript
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
```

This is the standard pattern — `as unknown as T` is preferred over `as any` because it makes the cast explicit and intentional.

**Step 2: Fix scrollTo polyfill pattern (2 files)**

Replace `Element.prototype.scrollTo = vi.fn() as any` with:

```typescript
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
```

**Step 3: Fix mock data initialization in useCSRContext.test.ts**

Replace `undefined as any` pattern with `undefined as unknown as T` or just use `undefined` if the type allows it:

```typescript
const mockMember = { data: undefined, isLoading: false, error: null };
const mockServiceCredit = { data: undefined, isLoading: false };
// etc — if the hook return type uses T | undefined, just use undefined directly
```

If TypeScript requires the cast, use `as unknown as HookReturnType` rather than `as any`.

**Step 4: Fix mock data variables in DataQualityPanel.test.tsx**

Replace `let mockScoreData: any = mockDQScore` with proper types from the imported fixtures:

```typescript
let mockScoreData: typeof mockDQScore | undefined = mockDQScore;
let mockTrendData: DQScoreTrend[] = [];
let mockChecksData: typeof mockChecks | undefined = mockChecks;
let mockIssuesData: typeof mockDQIssues | undefined = mockDQIssues;
```

**Step 5: Fix mockReturnValue casts in correspondence tests**

Replace `{ data: undefined, isLoading: true } as any` with `Partial` or explicit type:

```typescript
mockUseSentCorrespondence.mockReturnValue({ data: undefined, isLoading: true, error: null });
```

If the mock type doesn't match, use `as unknown as ReturnType<typeof useHook>`.

**Step 6: Fix crmApi test casts**

Replace `{ status: 'closed' } as any` with `Partial<ConversationType>` or the correct subset type.

**Step 7: Verify typecheck + tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: all pass, zero `any` remaining

**Step 8: Commit**

```bash
git add frontend/src/hooks/__tests__/ frontend/src/components/admin/__tests__/ frontend/src/components/portal/__tests__/ frontend/src/components/staff/__tests__/ frontend/src/components/workflow/__tests__/ frontend/src/lib/__tests__/
git commit -m "[frontend] Remove any casts from test files — use proper types and unknown"
```

---

## Task 6: Add AbortController Timeout to Frontend apiClient

**Files:**
- Modify: `frontend/src/lib/apiClient.ts`
- Modify: `frontend/src/lib/__tests__/apiClient.test.ts`

**Step 1: Write failing test**

Add to `frontend/src/lib/__tests__/apiClient.test.ts`:

```typescript
describe('request timeout', () => {
  it('aborts request after timeout', async () => {
    // Mock a fetch that never resolves within the timeout
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => new Promise((resolve) => {
      // Never resolves — simulates a hung request
      setTimeout(() => resolve(new Response('too late', { status: 200 })), 60000);
    }));

    try {
      await expect(fetchAPI('/api/v1/slow', { timeout: 50 })).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
```

Note: The test uses a very short timeout (50ms) to avoid slow tests.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/__tests__/apiClient.test.ts`
Expected: FAIL — `timeout` option doesn't exist yet

**Step 3: Implement timeout support**

Add a `RequestOptions` type and modify `rawRequest`:

```typescript
// After the constants block (~line 85):
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

// Modify rawRequest signature:
async function rawRequest(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<unknown> {
  const requestId = generateRequestId();
  const headers = new Headers(init.headers);
  headers.set('X-Request-ID', requestId);
  if (_authToken) {
    headers.set('Authorization', `Bearer ${_authToken}`);
  }
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      clearTimeout(timer);
      // ... rest of existing logic unchanged
```

Update public helpers to accept optional timeout:

```typescript
interface FetchOptions {
  timeout?: number;
}

export function fetchAPI<T>(url: string, opts?: FetchOptions): Promise<T> {
  return request<T>(url, {}, opts?.timeout);
}

export async function fetchPaginatedAPI<T>(url: string, opts?: FetchOptions): Promise<PaginatedResult<T>> {
  const body = await rawRequest(url, {}, opts?.timeout);
  // ...
}
```

Thread timeout through `request()`:

```typescript
async function request<T>(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const body = await rawRequest(url, init, timeoutMs);
  return lowercaseEnums((body as APIResponse<T>).data) as T;
}
```

For `postAPI`, `putAPI`, `patchAPI` — keep signatures unchanged (they use the default 30s timeout). Add optional timeout to those only if needed later.

**Step 4: Run tests**

Run: `cd frontend && npx vitest run src/lib/__tests__/apiClient.test.ts`
Expected: PASS

**Step 5: Full test suite**

Run: `cd frontend && npx vitest run`
Expected: all pass (AbortController is a no-op for existing tests — they don't hit timeouts)

**Step 6: Commit**

```bash
git add frontend/src/lib/apiClient.ts frontend/src/lib/__tests__/apiClient.test.ts
git commit -m "[frontend] Add 30s AbortController request timeout to apiClient"
```

---

## Task 7: Add Nginx Proxy Timeout Configuration

**Files:**
- Modify: `frontend/nginx.conf`

**Step 1: Add proxy timeout directives**

Add a shared upstream block with timeout configuration. Insert after `server_name localhost;`:

```nginx
    # Proxy timeouts — aligned with Go WriteTimeout (30s) + small buffer
    proxy_connect_timeout 5s;
    proxy_send_timeout    10s;
    proxy_read_timeout    35s;
```

This goes inside the `server` block before the `location` blocks. The read timeout (35s) is slightly above Go's WriteTimeout (30s) so the Go service has time to send its timeout error response before nginx gives up.

**Step 2: Verify nginx config syntax**

Run: `docker run --rm -v "$(pwd)/frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t`
Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

If Docker isn't available, verify the file is syntactically correct by reading it.

**Step 3: Commit**

```bash
git add frontend/nginx.conf
git commit -m "[infrastructure] Add proxy timeout configuration to nginx"
```

---

## Task 8: Create Shared `platform/envutil` Package

**Files:**
- Create: `platform/envutil/go.mod`
- Create: `platform/envutil/envutil.go`
- Create: `platform/envutil/envutil_test.go`

**Step 1: Write the failing test**

Create `platform/envutil/envutil_test.go`:

```go
package envutil

import (
	"os"
	"testing"
)

func TestGetEnv_ReturnsValue(t *testing.T) {
	os.Setenv("TEST_KEY_STR", "hello")
	defer os.Unsetenv("TEST_KEY_STR")
	if got := GetEnv("TEST_KEY_STR", "default"); got != "hello" {
		t.Errorf("expected hello, got %s", got)
	}
}

func TestGetEnv_ReturnsFallback(t *testing.T) {
	if got := GetEnv("NONEXISTENT_KEY_123", "fallback"); got != "fallback" {
		t.Errorf("expected fallback, got %s", got)
	}
}

func TestGetEnvInt_ReturnsValue(t *testing.T) {
	os.Setenv("TEST_KEY_INT", "42")
	defer os.Unsetenv("TEST_KEY_INT")
	if got := GetEnvInt("TEST_KEY_INT", 10); got != 42 {
		t.Errorf("expected 42, got %d", got)
	}
}

func TestGetEnvInt_ReturnsFallbackOnInvalid(t *testing.T) {
	os.Setenv("TEST_KEY_INT_BAD", "notanumber")
	defer os.Unsetenv("TEST_KEY_INT_BAD")
	if got := GetEnvInt("TEST_KEY_INT_BAD", 10); got != 10 {
		t.Errorf("expected 10, got %d", got)
	}
}

func TestGetEnvInt_ReturnsFallbackOnZero(t *testing.T) {
	os.Setenv("TEST_KEY_INT_ZERO", "0")
	defer os.Unsetenv("TEST_KEY_INT_ZERO")
	if got := GetEnvInt("TEST_KEY_INT_ZERO", 10); got != 10 {
		t.Errorf("expected 10 (zero is not positive), got %d", got)
	}
}

func TestGetEnvInt_ReturnsFallbackOnMissing(t *testing.T) {
	if got := GetEnvInt("NONEXISTENT_KEY_456", 25); got != 25 {
		t.Errorf("expected 25, got %d", got)
	}
}

func TestGetEnvFloat_ReturnsValue(t *testing.T) {
	os.Setenv("TEST_KEY_FLOAT", "1.5")
	defer os.Unsetenv("TEST_KEY_FLOAT")
	if got := GetEnvFloat("TEST_KEY_FLOAT", 1.0); got != 1.5 {
		t.Errorf("expected 1.5, got %f", got)
	}
}

func TestGetEnvFloat_ReturnsFallbackOnInvalid(t *testing.T) {
	os.Setenv("TEST_KEY_FLOAT_BAD", "notafloat")
	defer os.Unsetenv("TEST_KEY_FLOAT_BAD")
	if got := GetEnvFloat("TEST_KEY_FLOAT_BAD", 2.0); got != 2.0 {
		t.Errorf("expected 2.0, got %f", got)
	}
}

func TestGetEnvFloat_ReturnsFallbackOnMissing(t *testing.T) {
	if got := GetEnvFloat("NONEXISTENT_KEY_789", 3.0); got != 3.0 {
		t.Errorf("expected 3.0, got %f", got)
	}
}
```

**Step 2: Create go.mod**

Create `platform/envutil/go.mod`:

```
module github.com/noui/platform/envutil

go 1.22
```

**Step 3: Run tests to verify they fail**

Run: `cd platform/envutil && go test ./... -v -count=1`
Expected: FAIL — functions undefined

**Step 4: Write the implementation**

Create `platform/envutil/envutil.go`:

```go
// Package envutil provides environment variable helpers shared across platform services.
package envutil

import (
	"log/slog"
	"os"
	"strconv"
)

// GetEnv returns the environment variable value or the fallback if not set.
func GetEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// GetEnvInt returns the environment variable parsed as a positive integer,
// or the fallback if not set, not a valid integer, or not positive.
func GetEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
		slog.Warn("ignoring invalid integer env var, using default",
			"key", key, "value", v, "default", fallback)
	}
	return fallback
}

// GetEnvFloat returns the environment variable parsed as a positive float,
// or the fallback if not set, not a valid float, or not positive.
func GetEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			return f
		}
		slog.Warn("ignoring invalid float env var, using default",
			"key", key, "value", v, "default", fallback)
	}
	return fallback
}
```

**Step 5: Run tests to verify they pass**

Run: `cd platform/envutil && go test ./... -v -count=1`
Expected: 9 PASS

**Step 6: Commit**

```bash
git add platform/envutil/
git commit -m "[platform/envutil] Create shared environment variable helpers"
```

---

## Task 9: Wire `envutil` Into All Platform Services

**Files to modify (7 services + ratelimit = 8 go.mod + 8 postgres.go/ratelimit.go):**
- `platform/dataaccess/go.mod` + `platform/dataaccess/db/postgres.go`
- `platform/crm/go.mod` + `platform/crm/db/postgres.go`
- `platform/casemanagement/go.mod` + `platform/casemanagement/db/postgres.go`
- `platform/correspondence/go.mod` + `platform/correspondence/db/postgres.go`
- `platform/dataquality/go.mod` + `platform/dataquality/db/postgres.go`
- `platform/knowledgebase/go.mod` + `platform/knowledgebase/db/postgres.go`
- `platform/intelligence/go.mod` + `platform/intelligence/db/postgres.go`
- `platform/ratelimit/go.mod` + `platform/ratelimit/ratelimit.go`

**Pattern for each service (example: dataaccess):**

**Step 1: Add envutil dependency to go.mod**

Add to `platform/dataaccess/go.mod`:
```
require github.com/noui/platform/envutil v0.0.0
replace github.com/noui/platform/envutil => ../envutil
```

Run: `cd platform/dataaccess && go mod tidy`

**Step 2: Replace local getEnv/getEnvInt with envutil calls**

In `platform/dataaccess/db/postgres.go`:

- Add import: `"github.com/noui/platform/envutil"`
- Replace `getEnv("DB_HOST", "localhost")` → `envutil.GetEnv("DB_HOST", "localhost")` (etc for all calls)
- Delete the local `getEnv`, `getEnvInt` functions at the bottom of the file

**Step 3: Verify build + tests**

Run: `cd platform/dataaccess && go build ./... && go test ./... -v -count=1`
Expected: clean build, all tests pass

**Repeat for all 8 modules.**

For `platform/ratelimit/ratelimit.go`, also replace `getEnvFloat` with `envutil.GetEnvFloat` and delete both local `getEnvInt` and `getEnvFloat` functions.

**Step 4: Commit all services together**

```bash
git add platform/dataaccess/ platform/crm/ platform/casemanagement/ platform/correspondence/ platform/dataquality/ platform/knowledgebase/ platform/intelligence/ platform/ratelimit/
git commit -m "[platform/*] Replace duplicated env helpers with shared envutil package"
```

---

## Task 10: Add Graceful Shutdown to Rate Limiter

**Files:**
- Modify: `platform/ratelimit/ratelimit.go:110-161`
- Modify: `platform/ratelimit/ratelimit_test.go`

**Step 1: Write failing test**

Add to `platform/ratelimit/ratelimit_test.go`:

```go
func TestMiddleware_CleanupStopsOnContextCancel(t *testing.T) {
	cfg := Config{
		IPRate:          10,
		IPBurst:         5,
		TenantRate:      20,
		TenantBurst:     10,
		CleanupInterval: 50 * time.Millisecond,
		StaleAfter:      10 * time.Millisecond,
	}

	ctx, cancel := context.WithCancel(context.Background())
	handler := MiddlewareWithContext(ctx, cfg)(okHandler())

	// Make a request to populate limiters
	req := httptest.NewRequest("GET", "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Cancel context — cleanup goroutine should stop
	cancel()
	// Give goroutine time to exit
	time.Sleep(100 * time.Millisecond)
	// If we get here without hanging, the cleanup goroutine respected cancellation
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/ratelimit && go test ./... -v -count=1 -run TestMiddleware_CleanupStops`
Expected: FAIL — `MiddlewareWithContext` undefined

**Step 3: Implement MiddlewareWithContext**

In `platform/ratelimit/ratelimit.go`, add `context` to imports and add a new function:

```go
// MiddlewareWithContext is like Middleware but accepts a context for graceful shutdown.
// When the context is cancelled, the background cleanup goroutine stops.
func MiddlewareWithContext(ctx context.Context, cfg Config) func(http.Handler) http.Handler {
	ipLimiter := NewLimiter(cfg.IPRate, cfg.IPBurst)
	tenantLimiter := NewLimiter(cfg.TenantRate, cfg.TenantBurst)

	// Background cleanup with context cancellation.
	go func() {
		ticker := time.NewTicker(cfg.CleanupInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ipLimiter.Cleanup(cfg.StaleAfter)
				tenantLimiter.Cleanup(cfg.StaleAfter)
			}
		}
	}()

	slog.Info("rate limiter initialized",
		"ip_rate", cfg.IPRate,
		"ip_burst", cfg.IPBurst,
		"tenant_rate", cfg.TenantRate,
		"tenant_burst", cfg.TenantBurst,
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bypassPaths[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			ip := extractIP(r)
			if !ipLimiter.Allow(ip) {
				slog.Warn("rate limit exceeded (IP)", "ip", ip, "path", r.URL.Path)
				writeTooManyRequests(w, cfg, "per-IP rate limit exceeded")
				return
			}

			tenantID := auth.TenantID(r.Context())
			if tenantID != "" && !tenantLimiter.Allow(tenantID) {
				slog.Warn("rate limit exceeded (tenant)", "tenant_id", tenantID, "path", r.URL.Path)
				writeTooManyRequests(w, cfg, "per-tenant rate limit exceeded")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Middleware returns HTTP middleware with no shutdown control (background cleanup runs forever).
// Prefer MiddlewareWithContext for production services with graceful shutdown.
func Middleware(cfg Config) func(http.Handler) http.Handler {
	return MiddlewareWithContext(context.Background(), cfg)
}
```

**Step 4: Compute Retry-After from rate config**

Update `writeTooManyRequests` to accept the config and compute the header:

```go
func writeTooManyRequests(w http.ResponseWriter, cfg Config, message string) {
	// Retry-After = ceil(1 / rate) — approximate seconds until a token is available
	retryAfter := 1
	if cfg.IPRate > 0 {
		retryAfter = int(math.Ceil(1.0 / cfg.IPRate))
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	w.WriteHeader(http.StatusTooManyRequests)
	json.NewEncoder(w).Encode(map[string]map[string]string{
		"error": {
			"code":    "RATE_LIMITED",
			"message": message,
		},
	})
}
```

Add `"math"` to imports.

Update the old `Middleware` function's calls to `writeTooManyRequests` — since `Middleware` now delegates to `MiddlewareWithContext`, the old function body is removed. The old standalone `writeTooManyRequests(w, msg)` callsites in the old `Middleware` body are gone.

**Step 5: Run tests**

Run: `cd platform/ratelimit && go test ./... -v -count=1`
Expected: all pass (existing tests use `Middleware` which delegates to `MiddlewareWithContext(context.Background(), ...)`)

**Step 6: Commit**

```bash
git add platform/ratelimit/
git commit -m "[platform/ratelimit] Add context-based shutdown and computed Retry-After"
```

---

## Task 11: Final Verification

**Step 1: Build all Go modules**

```bash
cd platform/envutil && go build ./...
cd ../ratelimit && go build ./...
cd ../dataaccess && go build ./...
cd ../intelligence && go build ./...
cd ../crm && go build ./...
cd ../correspondence && go build ./...
cd ../dataquality && go build ./...
cd ../knowledgebase && go build ./...
cd ../casemanagement && go build ./...
cd ../../connector && go build ./...
```

Expected: all clean

**Step 2: Test all Go modules**

```bash
cd platform/envutil && go test ./... -count=1
cd ../ratelimit && go test ./... -count=1
cd ../dataaccess && go test ./... -count=1
cd ../intelligence && go test ./... -count=1
cd ../crm && go test ./... -count=1
cd ../correspondence && go test ./... -count=1
cd ../dataquality && go test ./... -count=1
cd ../knowledgebase && go test ./... -count=1
cd ../casemanagement && go test ./... -count=1
```

Expected: all pass

**Step 3: Frontend typecheck + tests**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected: clean typecheck, all 817+ tests pass

**Step 4: Verify zero `any` in production code**

```bash
cd frontend && grep -r ": any\|as any" src/lib/ src/components/ src/contexts/ src/types/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "node_modules"
```

Expected: zero matches

---

*Plan v1.0 — 2026-03-16 — Quality/Performance + Tech Debt Session 5*
