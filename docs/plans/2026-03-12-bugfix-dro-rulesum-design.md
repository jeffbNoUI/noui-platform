# Bug Fix Design: DRO Case-Scoping + Rule Sum Cleanup

**Date:** 2026-03-12
**Bugs:** #1 (Rule sum display), #3 (Inflated payment amounts)
**Bug #2 (DRO stage on non-DRO case):** Already fixed in stageMapping.ts — no action needed.

---

## Bug 3: Payment Options/Scenario Unconditionally Apply DRO

### Root Cause

`CalculatePaymentOptions` and `CalculateScenario` handlers in `handlers.go` unconditionally
fetch DRO data per-member, ignoring whether the current case involves a DRO. The
`CalculateBenefit` handler correctly uses `req.DROID != nil` to gate DRO fetch.

When Robert Martinez (who has a DRO on file) files a standard retirement case (no DRO),
the payment options endpoint still applies DRO adjustments, producing $85K+ instead of ~$2,962.

### Fix

**Backend (`platform/intelligence/`):**

1. **`models/types.go`** — Add `DROID *int` to `PaymentOptionsRequest` and `ScenarioRequest`:
   ```go
   type PaymentOptionsRequest struct {
       MemberID       int    `json:"member_id"`
       RetirementDate string `json:"retirement_date"`
       BeneficiaryDOB string `json:"beneficiary_dob,omitempty"`
       DROID          *int   `json:"dro_id,omitempty"`          // NEW
   }

   type ScenarioRequest struct {
       MemberID        int      `json:"member_id"`
       RetirementDates []string `json:"retirement_dates"`
       DROID           *int     `json:"dro_id,omitempty"`       // NEW
   }
   ```

2. **`api/handlers.go`** — Make DRO fetch conditional in both handlers:
   ```go
   // CalculatePaymentOptions — lines 164-168
   var dro *models.DROData
   if req.DROID != nil {
       droData, err := h.fetchDRO(req.MemberID)
       if err == nil && droData != nil {
           dro = droData
       }
   }

   // CalculateScenario — lines 200-204 (same pattern)
   ```

**Frontend (`frontend/src/`):**

3. **`lib/api.ts`** — Add optional `droId` parameter to `calculateOptions` and `calculateScenario`:
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

4. **`hooks/useBenefitCalculation.ts`** — Thread `droId` through `useScenario`:
   ```typescript
   export function useScenario(memberID: number, dates: string[], droId?: number) {
       // pass droId to calculateScenario
   }
   ```

### Tests

- **Go unit test:** `CalculatePaymentOptions` with `DROID: nil` produces standard benefit
  (no DRO adjustment) even when member has DRO records on file.
- **Go unit test:** `CalculatePaymentOptions` with `DROID: &1` produces DRO-adjusted amounts.
- **Go unit test:** `CalculateScenario` with `DROID: nil` — same pattern.
- **Frontend:** Existing tests should continue passing (droId defaults to undefined).

---

## Bug 1: Rule Sum Display = 0.00

### Root Cause

The Go backend correctly populates `rule_of_n_sum` at `eligibility.go:94`. The bug
was observed during E2E testing but the backend fix (line 93-94, "always computed for
display") addresses it. The frontend at `EligibilityStage.tsx:22` has a fallback chain
that references non-existent Go fields (`rule_of_75_sum`, `rule_of_85_sum`), plus
legacy field aliases (`is_vested`, `eligible_normal`, `reduction_percentage`).

### Fix

**Frontend cleanup only** — remove dead optional fields from `EligibilityResult` type
and clean up the fallback code:

1. **`types/BenefitCalculation.ts`** — Remove `rule_of_75_sum`, `rule_of_85_sum`,
   `is_vested`, `eligible_normal`, `reduction_percentage` (none exist in Go type).

2. **`components/workflow/stages/EligibilityStage.tsx`** — Simplify:
   ```typescript
   // Before (dead fallback chain):
   const apiSum = elig?.rule_of_n_sum ?? elig?.rule_of_75_sum ?? elig?.rule_of_85_sum ?? 0;
   // After:
   const apiSum = elig?.rule_of_n_sum ?? 0;
   ```
   Also clean up `elig?.is_vested || elig?.vested` → `elig?.vested`,
   `elig?.reduction_pct || elig?.reduction_percentage` → `elig?.reduction_pct`.

### Tests

- Existing frontend tests should continue passing after type cleanup.
- If any tests reference removed fields, update them to use the canonical field names.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `platform/intelligence/models/types.go` | Add `DROID` to PaymentOptionsRequest, ScenarioRequest |
| `platform/intelligence/api/handlers.go` | Conditional DRO fetch in CalculatePaymentOptions, CalculateScenario |
| `frontend/src/lib/api.ts` | Add droId param to calculateOptions, calculateScenario |
| `frontend/src/hooks/useBenefitCalculation.ts` | Thread droId through useScenario |
| `frontend/src/types/BenefitCalculation.ts` | Remove dead optional fields |
| `frontend/src/components/workflow/stages/EligibilityStage.tsx` | Clean up dead fallback code |

## Scope Boundary

- No changes to `stageMapping.ts` (Bug 2 already fixed).
- No changes to `eligibility.go` (backend rule_of_n_sum already correct).
- No changes to `benefit_calculator.go` (CalculateBenefit function is correct).
- No new dependencies.
