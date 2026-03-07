# CLAUDE_CODE_PROTOCOL.md — Session Discipline for Claude Code

**This document governs how Claude Code operates in the NoUI DERP POC repository.**
**Read this BEFORE writing any code. Violations of these protocols require immediate correction.**

---

## Session Initialization (Every Session, No Exceptions)

Before writing any code, read these files in this order:

1. `BUILD_HISTORY.md` — Understand current state, last decisions made, backtrack points
2. `BUILD_PLAN.md` — Understand what comes next and verification criteria
3. `SESSION_BRIEF.md` — Corrections, YAML specs, and guidance from analysis session
4. `CLAUDE.md` — Governing principles, critical rules, controlled terminology
5. Relevant `rules/definitions/*.yaml` files for the current task
6. Relevant `demo-cases/case*` files if working on calculations

**Do not shortcut this.** Context from prior sessions does not persist. Read fresh every time.

---

## Test-First Enforcement

**For every function that produces a number, determination, or dollar amount:**

1. Write the test FIRST, using expected values from test fixtures or the business rules inventory
2. Run the test — confirm it FAILS (proving the test actually checks something)
3. Write the implementation
4. Run the test — confirm it PASSES
5. If it doesn't pass, the implementation is wrong. Not the test.

**The hand calculations in `demo-cases/` are the test oracle.** If your code disagrees with the hand calculation, your code is wrong until proven otherwise. Never adjust expected values to match code output.

**Exception:** If you believe a hand calculation contains an error, STOP. Document the discrepancy in BUILD_HISTORY.md with full details and flag for human review. Do not resolve it yourself.

---

## Commit Discipline

### Message Format

```
Day X Step Y.Z: [Brief description]

[Optional: Decisions made, issues encountered, references]
```

Examples:
```
Day 1 Step 1.1: Legacy database schema — all 12 tables
Day 2 Step 2.3: Eligibility rules YAML — 10 rules with inline test cases
Day 3: Rules engine — eligibility evaluation with boundary tests
```

### Commit Frequency

Commit after each completed BUILD_PLAN step, not at end of session. Small, traceable commits > large monolithic ones.

### Pre-Commit Checklist

Before every commit:
- [ ] All existing tests still pass
- [ ] New code has corresponding tests
- [ ] No test fixture expected values were modified
- [ ] BUILD_HISTORY.md updated with this step's work
- [ ] No TODO/FIXME items left unaddressed without documentation

---

## BUILD_HISTORY.md Updates

Update BUILD_HISTORY.md after **every commit**, not just "significant" steps. In this project, every commit is significant.

### Entry Format

Follow the existing structure exactly:

```markdown
### Session N: [Description]

**Decision Log:**

XX. **DECISION: [Title]**
    [Description of what was decided and why]

### Files Created:

| File | Purpose | Status |
|------|---------|--------|
| [path] | [what it does] | Active |

### Files Updated:

| File | Changes | Status |
|------|---------|--------|
| [path] | [what changed] | Active |

### Issues Encountered:

| Issue | Resolution | Impact |
|-------|-----------|--------|
| [description] | [how resolved] | [what it affected] |

### Backtrack Points:
- **BT-XXX:** [Description of clean state to return to]
```

---

## Red Flag Patterns

**Claude Code must NEVER do any of the following without explicit human confirmation:**

### Calculation Integrity
- ❌ Modify test fixture expected values to match code output
- ❌ Round intermediate calculations (carry full precision, round only final result)
- ❌ Use floating-point where decimal precision is required for money
- ❌ Implement a business rule not found in `derp-business-rules-inventory.docx`
- ❌ Derive a rule from legacy data behavior instead of governing documents

### Architecture Violations
- ❌ Put any AI/LLM call in a calculation path
- ❌ Have any service access the database directly (all access through Data Connector)
- ❌ Add external dependencies not in the technology stack (CLAUDE.md §Technology Stack)
- ❌ Skip a BUILD_PLAN verification step ("we'll verify later")

### Governance Violations
- ❌ Change a rule definition without citing the RMC section
- ❌ Use terminology on the banned list (CLAUDE.md §Controlled Terminology)
- ❌ Auto-resolve a data quality finding (Phase 1 = all findings presented for human review)
- ❌ Create a rule without `source_reference` in the YAML

**If you encounter a situation where one of these seems necessary, STOP and document why in BUILD_HISTORY.md. The human will decide.**

---

## Assumption Marking

Every code location that implements a rule marked as ASSUMED in the business rules inventory must include a searchable comment:

```go
// ASSUMPTION: [Q-CALC-01] Using banker's rounding. DERP's actual method unconfirmed.
// See derp-business-rules-inventory.docx, RULE-ROUNDING
func roundFinalBenefit(amount float64) float64 {
    // ...
}
```

```go
// ASSUMPTION: [Q-CALC-02] Using year-month method (months/12) for partial service years.
// DERP may use exact-day method. See RULE-SVC-EARNED.
func calculateServiceYears(hireDate, retireDate time.Time) float64 {
    // ...
}
```

This makes all assumptions `grep`-able across the codebase:
```bash
grep -rn "ASSUMPTION:" services/
```

---

## Statutory Lookup Tables Over Formulas

For early retirement reductions and death benefits, use the RMC statutory tables directly. Do NOT implement as `years_under_65 * rate` formulas, even though they produce the same result. Reasons:

1. The statute defines tables, not formulas. If the legislature changes one age's percentage without changing others, a formula breaks silently. A table stays correct.
2. The table IS the governing document. The formula is our interpretation.
3. Tables are self-documenting and directly auditable against the RMC.

```go
// CORRECT: Statutory table from RMC §18-409(b)
var earlyRetReductionT12 = map[int]float64{
    55: 0.70, 56: 0.73, 57: 0.76, 58: 0.79, 59: 0.82,
    60: 0.85, 61: 0.88, 62: 0.91, 63: 0.94, 64: 0.97,
    65: 1.00,
}

// WRONG: Formula that happens to produce the same values
func reductionFactor(age int) float64 {
    return 1.0 - (float64(65-age) * 0.03)
}
```

---

## Service Credit Separation Enforcement

Every function that uses service credit must explicitly declare which type it uses:

```go
// Functions that use EARNED service only (purchased excluded):
// - Rule of 75/85 evaluation
// - IPR calculation  
// - Vesting check
func earnedServiceOnly(member Member) float64 { ... }

// Functions that use TOTAL service (earned + purchased):
// - Benefit formula calculation
// - AMS window determination (service length check)
func totalServiceForCalculation(member Member) float64 { ... }
```

If a new function uses service credit and you're unsure which type, check the business rules inventory. If the inventory doesn't specify, STOP and flag for human review. Getting this wrong invalidates the entire demo (Case 2 depends on it).

---

## Session Handoff State

When ending a Claude Code session, the repository must be in this state:

- [ ] All tests passing (zero failures)
- [ ] BUILD_HISTORY.md current (includes all work from this session)
- [ ] No uncommitted changes
- [ ] No `TODO` items without corresponding BUILD_HISTORY documentation
- [ ] If mid-step: document exactly where you stopped and what remains

**The next session must be able to pick up cleanly from BUILD_HISTORY.md alone.**

---

## Quick Reference: Where Things Live

| Need | Location |
|------|----------|
| What to build next | `BUILD_PLAN.md` |
| Current state and decisions | `BUILD_HISTORY.md` |
| Corrections and Day 1-2 specifics | `SESSION_BRIEF.md` |
| All 52 business rules with sources | `derp-business-rules-inventory.docx` |
| Governing principles | `CLAUDE.md` → `noui-architecture-decisions.docx` |
| Demo case expected values | `demo-cases/case*-test-fixture.json` |
| Hand calculations | `demo-cases/case*-calculation.md` |
| Rule definitions (once created) | `rules/definitions/*.yaml` |
| Document precedence hierarchy | `noui-knowledge-governance-framework.docx` |
