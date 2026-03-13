# Bug Fix: DRO Case-Scoping + Rule Sum Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix inflated payment amounts for non-DRO cases (Bug 3) and clean up dead EligibilityResult fields (Bug 1).

**Architecture:** Add optional `dro_id` to PaymentOptionsRequest and ScenarioRequest in the Go intelligence service, making DRO fetch conditional (matching existing CalculateBenefit pattern). Clean up dead TypeScript type fields and fallback code in the frontend.

**Tech Stack:** Go 1.22 (intelligence service), TypeScript/React (frontend)

---

### Task 1: Add DROID to PaymentOptionsRequest and ScenarioRequest

**Files:**
- Modify: `platform/intelligence/models/types.go:71-81`

**Step 1: Add DROID field to both request types**

In `types.go`, add `DROID *int` field to `PaymentOptionsRequest` and `ScenarioRequest`:

```go
// PaymentOptionsRequest is the input for payment options calculation.
type PaymentOptionsRequest struct {
	MemberID       int    `json:"member_id"`
	RetirementDate string `json:"retirement_date"` // YYYY-MM-DD
	BeneficiaryDOB string `json:"beneficiary_dob,omitempty"`
	DROID          *int   `json:"dro_id,omitempty"` // Links to specific DRO; nil = no DRO for this case
}

// ScenarioRequest is the input for scenario comparison.
type ScenarioRequest struct {
	MemberID        int      `json:"member_id"`
	RetirementDates []string `json:"retirement_dates"` // Array of YYYY-MM-DD
	DROID           *int     `json:"dro_id,omitempty"` // Links to specific DRO; nil = no DRO for this case
}
```

**Step 2: Verify build**

Run: `cd platform/intelligence && go build ./...`
Expected: SUCCESS (no compilation errors)

**Step 3: Commit**

```bash
git add platform/intelligence/models/types.go
git commit -m "[platform/intelligence] Add dro_id to PaymentOptionsRequest and ScenarioRequest"
```

---

### Task 2: Make DRO Fetch Conditional in Handlers

**Files:**
- Modify: `platform/intelligence/api/handlers.go:164-168,200-204`

**Step 1: Fix CalculatePaymentOptions handler**

Replace the unconditional DRO fetch at lines 164-168:

```go
// BEFORE (BUG — unconditional):
var dro *models.DROData
droData, err := h.fetchDRO(req.MemberID)
if err == nil && droData != nil {
    dro = droData
}

// AFTER (conditional — matches CalculateBenefit pattern):
var dro *models.DROData
if req.DROID != nil {
    droData, err := h.fetchDRO(req.MemberID)
    if err == nil && droData != nil {
        dro = droData
    }
}
```

**Step 2: Fix CalculateScenario handler**

Same fix at lines 200-204:

```go
// BEFORE (BUG — unconditional):
var dro *models.DROData
droData, err := h.fetchDRO(req.MemberID)
if err == nil && droData != nil {
    dro = droData
}

// AFTER:
var dro *models.DROData
if req.DROID != nil {
    droData, err := h.fetchDRO(req.MemberID)
    if err == nil && droData != nil {
        dro = droData
    }
}
```

**Step 3: Verify build**

Run: `cd platform/intelligence && go build ./...`
Expected: SUCCESS

**Step 4: Run existing tests**

Run: `cd platform/intelligence && go test ./... -v -count=1`
Expected: All existing tests pass (DRO fetch is mocked/not exercised in unit tests)

**Step 5: Commit**

```bash
git add platform/intelligence/api/handlers.go
git commit -m "[platform/intelligence] Make DRO fetch conditional in PaymentOptions and Scenario handlers"
```

---

### Task 3: Thread droId Through Frontend API and Hooks

**Files:**
- Modify: `frontend/src/lib/api.ts:31-41`
- Modify: `frontend/src/hooks/useBenefitCalculation.ts:31-37`

**Step 1: Add droId to calculateOptions and calculateScenario in api.ts**

```typescript
calculateOptions: (memberID: number, retirementDate: string, beneficiaryDOB?: string, droId?: number) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/options`, {
      member_id: memberID,
      retirement_date: retirementDate,
      beneficiary_dob: beneficiaryDOB,
      ...(droId != null && { dro_id: droId }),
    }),
  calculateScenario: (memberID: number, retirementDates: string[], droId?: number) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/scenario`, {
      member_id: memberID,
      retirement_dates: retirementDates,
      ...(droId != null && { dro_id: droId }),
    }),
```

**Step 2: Thread droId through useScenario hook**

```typescript
export function useScenario(memberID: number, dates: string[], droId?: number) {
  return useQuery<ScenarioResult>({
    queryKey: ['scenario', memberID, dates, droId],
    queryFn: () => intelligenceAPI.calculateScenario(memberID, dates, droId) as Promise<ScenarioResult>,
    enabled: memberID > 0 && dates.length > 0,
  });
}
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useBenefitCalculation.ts
git commit -m "[frontend] Thread droId through calculateOptions, calculateScenario, and useScenario"
```

---

### Task 4: Clean Up Dead EligibilityResult Fields (Bug 1)

**Files:**
- Modify: `frontend/src/types/BenefitCalculation.ts:1-19`
- Modify: `frontend/src/components/workflow/stages/EligibilityStage.tsx`
- Modify: `frontend/src/components/workflow/stages/__tests__/fixtures.ts`
- Modify: `frontend/src/lib/mergeFieldResolver.ts:77`

**Step 1: Remove dead fields from EligibilityResult type**

In `BenefitCalculation.ts`, remove lines 8-9, 11-12, 17:

```typescript
export interface EligibilityResult {
  member_id: number;
  retirement_date: string;
  age_at_retirement: AgeAtRetirement;
  tier: number;
  tier_source: string;
  vested: boolean;
  rule_of_n_sum: number;
  service_credit: ServiceCreditData;
  evaluations: RuleEvaluation[];
  best_eligible_type: string;
  reduction_pct: number;
  reduction_factor: number;
}
```

**Step 2: Clean up EligibilityStage.tsx**

Replace dead fallback chains:

```typescript
// Line 22: Remove dead fallback fields
const apiSum = elig?.rule_of_n_sum ?? 0;

// Lines 49, 54: Remove is_vested alias
elig?.vested

// Line 59: Remove eligible_normal — derive from best_eligible_type instead
<Field label="Normal Retirement (65)" value={elig?.best_eligible_type === 'NORMAL' ? 'Yes' : 'Not yet'} />

// Line 80: Remove reduction_percentage alias
value={`${(elig?.reduction_pct || 0).toFixed(1)}%`}

// Line 98: Same cleanup
text={`${ruleLabel} threshold not met (${ruleSum.toFixed(2)} < ${ruleThreshold}). ${(elig.reduction_pct || 0).toFixed(1)}% reduction applied.`}
```

**Step 3: Clean up test fixtures**

In `fixtures.ts`, remove `is_vested`, `eligible_normal`, `reduction_percentage` from
both eligibility fixture objects (around lines 46, 49, 53, 152). These fields no longer
exist on the type.

**Step 4: Clean up mergeFieldResolver.ts**

Line 77: Remove `reduction_percentage` fallback:

```typescript
// Before:
const pct = ctx.calculation?.eligibility?.reduction_pct ??
    ctx.calculation?.eligibility?.reduction_percentage;
// After:
const pct = ctx.calculation?.eligibility?.reduction_pct;
```

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors (removing optional fields that are never set by the backend should not cause errors)

**Step 6: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add frontend/src/types/BenefitCalculation.ts \
       frontend/src/components/workflow/stages/EligibilityStage.tsx \
       frontend/src/components/workflow/stages/__tests__/fixtures.ts \
       frontend/src/lib/mergeFieldResolver.ts
git commit -m "[frontend] Remove dead EligibilityResult fields, clean up rule sum fallback"
```

---

### Task 5: Final Verification

**Step 1: Go build + test**

Run: `cd platform/intelligence && go build ./... && go test ./... -v -count=1`
Expected: All pass

**Step 2: Frontend typecheck + test**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run`
Expected: 0 TS errors, all tests pass

**Step 3: Verify git status**

Run: `git diff --stat`
Expected: ~6 files changed, small diff
