# D3-C: Zero-Contribution Member Handling — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow migration engagements to declare an employer-paid contribution model so that zero/NULL employee contributions don't trigger false validation errors or data quality flags.

**Architecture:** Single `contribution_model` field on `migration.engagement` (values: `standard`, `employer_paid`). Propagated through `TransformContext` to `ValidateConstraintsHandler`. Surfaced in frontend MappingPanel as an info badge. New false cognate vocabulary entry warns analysts about zero-balance expectations.

**Tech Stack:** Go (migration service), PostgreSQL (migration 032), TypeScript/React (frontend), YAML (vocabulary)

---

### Task 1: Database Migration — Add `contribution_model` Column

**Files:**
- Create: `db/migrations/032_contribution_model.sql`

**Step 1: Write the migration**

```sql
-- 032_contribution_model.sql
-- Adds contribution model to engagement for employer-paid systems (Nevada PERS EPC, Utah RS Tier 1)

ALTER TABLE migration.engagement
    ADD COLUMN contribution_model VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (contribution_model IN ('standard', 'employer_paid'));
```

**Step 2: Commit**

```bash
git add db/migrations/032_contribution_model.sql
git commit -m "[migration] Add contribution_model column to engagement"
```

---

### Task 2: Go Models — Add `ContributionModel` to Engagement

**Files:**
- Modify: `platform/migration/models/types.go:63-74` (Engagement struct)
- Modify: `platform/migration/models/types.go:76-80` (CreateEngagementRequest)
- Modify: `platform/migration/models/types.go:83-86` (UpdateEngagementRequest)

**Step 1: Add `ContributionModel` field to Engagement struct**

In `models/types.go`, add to the `Engagement` struct (after `SourcePlatformType`, line 69):

```go
ContributionModel         string            `json:"contribution_model"`
```

**Step 2: Add to CreateEngagementRequest**

After `SourcePlatformType` (line 79):

```go
ContributionModel  string  `json:"contribution_model,omitempty"`
```

**Step 3: Add to UpdateEngagementRequest**

After `SourcePlatformType` (line 85):

```go
ContributionModel  *string `json:"contribution_model,omitempty"`
```

**Step 4: Verify build**

Run: `cd platform/migration && go build ./...`
Expected: build succeeds (tests will fail until DB layer is updated)

---

### Task 3: DB Layer — Wire `contribution_model` Through Queries

**Files:**
- Modify: `platform/migration/db/engagement.go:12-31` (scanEngagement)
- Modify: `platform/migration/db/engagement.go:34-35` (engagementColumns)
- Modify: `platform/migration/db/engagement.go:38-49` (CreateEngagement)

**Step 1: Update `engagementColumns` constant (line 34)**

Add `contribution_model` to the column list:

```go
const engagementColumns = `engagement_id, tenant_id, source_system_name, canonical_schema_version,
		status, source_platform_type, quality_baseline_approved_at, source_connection,
		contribution_model, created_at, updated_at`
```

**Step 2: Update `scanEngagement` to scan the new column**

After scanning `connJSON` (line 17), add `&e.ContributionModel` to the Scan call. The scan order must match `engagementColumns`:

```go
err := scanner.Scan(
    &e.EngagementID, &e.TenantID, &e.SourceSystemName, &e.CanonicalSchemaVersion,
    &e.Status, &e.SourcePlatformType, &e.QualityBaselineApprovedAt, &connJSON,
    &e.ContributionModel, &e.CreatedAt, &e.UpdatedAt,
)
```

**Step 3: Update `CreateEngagement` to accept contribution model**

Change signature and INSERT to include `contribution_model`:

```go
func CreateEngagement(db *sql.DB, tenantID, sourceSystemName string, platformType *string, contributionModel string) (*models.Engagement, error) {
    if contributionModel == "" {
        contributionModel = "standard"
    }
    row := db.QueryRow(
        `INSERT INTO migration.engagement (tenant_id, source_system_name, source_platform_type, contribution_model)
         VALUES ($1, $2, $3, $4)
         RETURNING `+engagementColumns,
        tenantID, sourceSystemName, platformType, contributionModel,
    )
```

**Step 4: Add `UpdateContributionModel` function**

After `UpdateEngagementStatus` (line 87), add:

```go
// UpdateContributionModel updates an engagement's contribution model.
func UpdateContributionModel(db *sql.DB, engagementID string, model string) (*models.Engagement, error) {
    row := db.QueryRow(
        `UPDATE migration.engagement
         SET contribution_model = $2, updated_at = now()
         WHERE engagement_id = $1
         RETURNING `+engagementColumns,
        engagementID, model,
    )
    e, err := scanEngagement(row)
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, fmt.Errorf("update contribution model: %w", err)
    }
    return e, nil
}
```

**Step 5: Update API handler call sites**

In `platform/migration/api/engagement_handlers.go:41`, update the `CreateEngagement` call to pass `req.ContributionModel`:

```go
engagement, err := migrationdb.CreateEngagement(h.DB, tid, req.SourceSystemName, req.SourcePlatformType, req.ContributionModel)
```

In `UpdateEngagement` handler (line 74), add contribution_model update support:
After the status transition logic (line 117), before the final response, add handling for `contribution_model` in the update request. If `req.ContributionModel` is set, call `UpdateContributionModel`.

**Step 6: Verify build**

Run: `cd platform/migration && go build ./...`

---

### Task 4: Fix Existing Tests for New Column

**Files:**
- Modify: `platform/migration/api/engagement_handlers_test.go`
- Modify: `platform/migration/db/engagement_test.go`

The sqlmock expectations need to include the new `contribution_model` column in their result sets. Every `NewRows` call that returns engagement columns must add `contribution_model` in the correct position (after `source_connection`, before `created_at`).

**Step 1: Update all sqlmock row definitions**

Find every `sqlmock.NewRows(...)` that uses engagement columns and add `"contribution_model"` to the column list and `"standard"` to the row values.

**Step 2: Update `CreateEngagement` test calls**

The `CreateEngagement` function now takes 5 args instead of 4. Update mock expectations.

**Step 3: Run tests to verify**

Run: `cd platform/migration && go test ./... -short -v -count=1`
Expected: all existing tests pass with the new column

**Step 4: Commit**

```bash
git add platform/migration/
git commit -m "[migration] Wire contribution_model through models, DB, and API"
```

---

### Task 5: Transformer — Context-Aware Validation Skip

**Files:**
- Modify: `platform/migration/transformer/pipeline.go:74-81` (TransformContext)
- Modify: `platform/migration/transformer/pipeline.go:157-166` (transformRow — copy field)
- Modify: `platform/migration/transformer/handlers.go:685-749` (ValidateConstraintsHandler)
- Test: `platform/migration/transformer/handlers_test.go`

**Step 1: Write the failing tests**

Add to `handlers_test.go`:

```go
// ===== ValidateConstraints — Employer-Paid Contribution Model =====

func TestValidateConstraints_EeAmountNil_Standard_RejectsAsRequired(t *testing.T) {
    h := ValidateConstraintsHandler()
    ctx := newTestCtx()
    ctx.ContributionModel = "standard"
    m := FieldMapping{CanonicalColumn: "ee_amount", CanonicalType: "DECIMAL", Required: true}
    _, err := h.Apply(nil, nil, m, ctx)
    if err == nil {
        t.Fatal("expected MISSING_REQUIRED error for ee_amount=nil with standard model")
    }
    if len(ctx.Exceptions) != 1 {
        t.Errorf("expected 1 exception, got %d", len(ctx.Exceptions))
    }
}

func TestValidateConstraints_EeAmountNil_EmployerPaid_Accepts(t *testing.T) {
    h := ValidateConstraintsHandler()
    ctx := newTestCtx()
    ctx.ContributionModel = "employer_paid"
    m := FieldMapping{CanonicalColumn: "ee_amount", CanonicalType: "DECIMAL", Required: true}
    v, err := h.Apply(nil, nil, m, ctx)
    if err != nil {
        t.Fatalf("employer_paid should accept nil ee_amount, got error: %v", err)
    }
    if v != nil {
        t.Errorf("expected nil return value, got %v", v)
    }
    if len(ctx.Exceptions) != 0 {
        t.Errorf("expected 0 exceptions, got %d", len(ctx.Exceptions))
    }
    if len(ctx.Lineage) != 1 {
        t.Fatalf("expected 1 lineage entry, got %d", len(ctx.Lineage))
    }
    if ctx.Lineage[0].HandlerName != "ValidateConstraints" {
        t.Errorf("lineage handler = %q, want ValidateConstraints", ctx.Lineage[0].HandlerName)
    }
}

func TestValidateConstraints_OtherRequired_EmployerPaid_StillRejects(t *testing.T) {
    h := ValidateConstraintsHandler()
    ctx := newTestCtx()
    ctx.ContributionModel = "employer_paid"
    m := FieldMapping{CanonicalColumn: "member_id", CanonicalType: "VARCHAR", Required: true}
    _, err := h.Apply(nil, nil, m, ctx)
    if err == nil {
        t.Fatal("employer_paid should NOT skip required check for non-ee_amount columns")
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `cd platform/migration && go test ./transformer/ -run "TestValidateConstraints_EeAmount|TestValidateConstraints_OtherRequired" -v`
Expected: FAIL — `ContributionModel` field doesn't exist yet

**Step 3: Add `ContributionModel` to TransformContext**

In `pipeline.go:74-81`, add after `CodeMappings`:

```go
type TransformContext struct {
    EngagementID      string
    MappingVersion    string
    ContributionModel string // "standard" or "employer_paid"
    CodeMappings      map[string]map[string]string
    Lineage           []LineageEntry
    Exceptions        []ExceptionEntry
}
```

**Step 4: Copy `ContributionModel` in `transformRow`**

In `pipeline.go:162-166`, add the copy:

```go
if sharedCtx != nil {
    ctx.EngagementID = sharedCtx.EngagementID
    ctx.MappingVersion = sharedCtx.MappingVersion
    ctx.ContributionModel = sharedCtx.ContributionModel
    ctx.CodeMappings = sharedCtx.CodeMappings
}
```

**Step 5: Add employer-paid skip in ValidateConstraintsHandler**

In `handlers.go`, replace lines 690-695 with:

```go
// NOT NULL check for required fields.
if value == nil && mapping.Required {
    // Employer-paid systems: ee_amount is legitimately NULL.
    if ctx.ContributionModel == "employer_paid" && mapping.CanonicalColumn == "ee_amount" {
        ctx.AddLineage("ValidateConstraints", mapping.CanonicalColumn, "<nil>", "<nil> accepted — employer_paid contribution model")
        return nil, nil
    }
    ctx.AddException("ValidateConstraints", mapping.CanonicalColumn, "<nil>", ExceptionMissingRequired,
        fmt.Sprintf("required column %q is NULL", mapping.CanonicalColumn))
    return nil, fmt.Errorf("required column %s is NULL", mapping.CanonicalColumn)
}
```

**Step 6: Run tests to verify they pass**

Run: `cd platform/migration && go test ./transformer/ -v -count=1`
Expected: all transformer tests pass including the 3 new ones

**Step 7: Commit**

```bash
git add platform/migration/transformer/
git commit -m "[migration/transformer] Context-aware ee_amount validation for employer-paid systems"
```

---

### Task 6: Vocabulary — False Cognate for Zero-Balance Contributions

**Files:**
- Modify: `platform/migration/mapper/vocabulary.yaml:310-331` (contribution-accounts section)
- Modify: `platform/migration/mapper/vocabulary_count_test.go:15` (update min count)
- Test: `platform/migration/mapper/false_cognate_test.go`

**Step 1: Write failing test**

Add to `false_cognate_test.go`:

```go
func TestAttachWarnings_AccumulatedContributions_ZeroBalance(t *testing.T) {
    // accumulated_contributions matched to accumulated_balance — MEDIUM risk
    // Employer-paid systems (Nevada PERS EPC, Utah RS Tier 1) have zero accumulated contributions by design
    matches := []ColumnMatch{
        {
            SourceColumn:    "accumulated_contributions",
            SourceType:      "decimal(12,2)",
            CanonicalColumn: "accumulated_balance",
            Confidence:      0.9,
            MatchMethod:     "pattern",
        },
    }

    vocab, _ := LoadVocabulary()
    idx := BuildFalseCognateIndex(vocab)
    AttachFalseCognateWarnings(matches, "contribution-accounts", idx)

    if len(matches[0].Warnings) == 0 {
        t.Fatal("expected warning for accumulated_contributions (zero-balance employer-paid ambiguity), got none")
    }
    if matches[0].Warnings[0].Risk != "MEDIUM" {
        t.Errorf("accumulated_contributions risk = %q, want MEDIUM", matches[0].Warnings[0].Risk)
    }
    if !strings.Contains(matches[0].Warnings[0].Warning, "employer-paid") {
        t.Error("warning should mention employer-paid systems")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/migration && go test ./mapper/ -run "TestAttachWarnings_AccumulatedContributions" -v`
Expected: FAIL — no false cognate entry for `accumulated_contributions` in `contribution-accounts`

**Step 3: Add false cognate entry to vocabulary.yaml**

In `vocabulary.yaml`, after the `accumulated_balance` terms list (after line 331), add:

```yaml
    false_cognates:
      - term: accumulated_contributions
        warning: "In employer-paid systems (Nevada PERS EPC, Utah RS Tier 1 noncontributory), accumulated contributions are zero by design — not a data quality issue"
        risk: MEDIUM
      - term: member_account_balance
        warning: "In employer-paid systems, member account balance may be zero or absent — contributions are employer-held, not refundable to member"
        risk: MEDIUM
```

**Step 4: Update vocabulary count test**

In `vocabulary_count_test.go:15`, update the minimum count from `440` to `442` (2 new false cognate entries don't add ExpectedNames, so check if this actually changes — it may stay at 440 if false cognates don't add to the count. Run the test first to see the logged total).

**Step 5: Run tests**

Run: `cd platform/migration && go test ./mapper/ -v -count=1`
Expected: all mapper tests pass

**Step 6: Commit**

```bash
git add platform/migration/mapper/
git commit -m "[migration/mapper] False cognate warnings for zero-balance employer-paid systems"
```

---

### Task 7: Frontend Types — Add `contribution_model` to MigrationEngagement

**Files:**
- Modify: `frontend/src/types/Migration.ts:61-72` (MigrationEngagement interface)

**Step 1: Add field to MigrationEngagement**

After `source_platform_type` (line 67), add:

```typescript
contribution_model: 'standard' | 'employer_paid';
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean (field has a default in DB, so existing data works)

---

### Task 8: Frontend — Info Badge in MappingPanel

**Files:**
- Modify: `frontend/src/components/migration/engagement/MappingPanel.tsx`
- Modify: `frontend/src/components/migration/engagement/__tests__/MappingPanel.test.tsx`

**Step 1: Write failing test**

Add to `MappingPanel.test.tsx`:

```typescript
test('shows employer-paid info badge on ee_amount when contribution_model is employer_paid', async () => {
  // Mock useEngagement to return employer_paid contribution_model
  // Mock useMappings to return a mapping with canonical_column = 'ee_amount'
  // Assert: info badge with text containing 'Employer-paid' is rendered
  // Assert: badge has blue/info styling (not warning coral/gold)
});

test('does not show employer-paid info badge when contribution_model is standard', async () => {
  // Mock useEngagement to return standard contribution_model
  // Mock useMappings to return a mapping with canonical_column = 'ee_amount'
  // Assert: no employer-paid info badge rendered
});
```

The exact mock setup depends on how `useEngagement` is used in MappingPanel. The component currently takes `engagementId` as a prop. We need to either:
- Add a `useEngagement(engagementId)` hook call inside MappingPanel, OR
- Pass `contributionModel` as a prop

**Recommended approach:** Add `useEngagement(engagementId)` call inside MappingPanel since the component already receives `engagementId`. Check if `useMigrationApi.ts` already exports a `useEngagement` hook — if not, add one.

**Step 2: Add info badge rendering**

In `MappingPanel.tsx`, after the WarningBadge rendering (around line 314-319), add a conditional info badge for `ee_amount` when `engagement?.contribution_model === 'employer_paid'`:

```tsx
{engagement?.contribution_model === 'employer_paid' && m.canonical_column === 'ee_amount' && (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      marginLeft: 8,
      padding: '2px 8px',
      borderRadius: 10,
      background: '#e3f2fd',
      color: '#1565c0',
      fontSize: 10,
      fontWeight: 600,
    }}
    data-testid="employer-paid-badge"
  >
    Employer-paid — zero contributions expected
  </span>
)}
```

**Step 3: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: all tests pass

**Step 4: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "[frontend] Employer-paid info badge on MappingPanel ee_amount"
```

---

### Task 9: Final Verification

**Step 1: Run all Go tests**

Run: `cd platform/migration && go test ./... -short -v -count=1`
Expected: all packages pass

**Step 2: Run all frontend tests**

Run: `cd frontend && npm test -- --run`
Expected: all test files pass

**Step 3: Frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

**Step 4: Git status review**

Run: `git diff --stat`
Verify ~10 files changed as designed.

---

### Task 10: Update BUILD_HISTORY.md and Final Commit

**Files:**
- Modify: `BUILD_HISTORY.md`

Add Session 38 entry documenting D3-C: zero-contribution member handling.

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Session 38 build history — D3-C zero-contribution handling"
```
