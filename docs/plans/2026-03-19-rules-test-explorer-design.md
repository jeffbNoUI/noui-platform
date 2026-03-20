# Rules & Test Explorer — Design Document

**Created:** 2026-03-19
**Status:** Approved
**Audience:** Implementation staff (Provaliant consultants) + client plan administrators (read-only)
**Purpose:** Configuration support tool — not a daily-driver production screen

---

## Goal

Build a UI that provides full visibility into the business rules pipeline: rule definitions (from YAML), test execution results (from CI), and demo case walkthroughs — all cross-linked. Replace the existing read-only `ConfigRulesPanel` with a comprehensive Rules Explorer that shows rule logic, governance status, and inline test pass/fail for every rule.

---

## Decisions Made

| # | Decision | Choice |
|---|----------|--------|
| 1 | Data delivery | **Backend endpoints** — extend KB service (Approach B) |
| 2 | Rules Explorer + Test Dashboard | **Combined** — each rule shows its test results inline |
| 3 | Demo Cases | **Separate top-level view** with cross-links to rules |
| 4 | Rule logic rendering | **Structured rendering** — four type-specific renderers (conditional, formula, lookup_table, procedural) |
| 5 | Test results source | **CI-generated report** — `go test -json` parsed by KB service (no on-demand execution) |
| 6 | Test-to-rule mapping | **Explicit mapping file** — `test-results/test-rule-mapping.json` |

---

## Architecture

### Backend — KB Service Extension (port 8087)

#### New Endpoints

```
# Full rule definitions (parsed from YAML)
GET /api/v1/kb/rules/definitions                    → all rules, all domains
GET /api/v1/kb/rules/definitions?domain=eligibility  → filtered by domain
GET /api/v1/kb/rules/definitions/{ruleId}            → single rule with full detail

# Test report (parsed from go test -json output)
GET /api/v1/kb/test-report                           → full test summary
GET /api/v1/kb/test-report?domain=eligibility        → filtered by domain
GET /api/v1/kb/test-report/{ruleId}                  → tests linked to a specific rule

# Demo cases (parsed from JSON fixtures)
GET /api/v1/kb/demo-cases                            → all case summaries
GET /api/v1/kb/demo-cases/{caseId}                   → full case detail
```

#### Data Sources (filesystem, read-only)

The KB service reads three file-based data sources:

| Source | Path (in container) | Format | Change Frequency |
|--------|-------------------|--------|-----------------|
| Rule definitions | `/data/rules/*.yaml` | YAML | Quarterly (governance reviews) |
| Test report | `/data/test-results/intelligence-report.json` | go test -json | Every CI run |
| Test-rule mapping | `/data/test-results/test-rule-mapping.json` | JSON | When tests are added/renamed |
| Demo cases | `/data/demo-cases/*.json` | JSON | Rarely |

Docker volume mounts:
```yaml
knowledgebase:
  volumes:
    - ./domains/pension/rules/definitions:/data/rules:ro
    - ./domains/pension/demo-cases:/data/demo-cases:ro
    - ./test-results:/data/test-results:ro
```

#### Caching Strategy

- Parse files on first request, cache in memory
- Default TTL: 5 minutes (configurable via `RULES_CACHE_TTL` env var)
- No database tables needed — purely file-backed

#### Response Shapes

**Rule definition:**
```json
{
  "data": {
    "id": "RULE-RULE-OF-75",
    "name": "Rule of 75",
    "domain": "eligibility",
    "description": "Unreduced retirement for Tier 1/2 when age + earned service >= 75",
    "source_reference": { "document": "RMC", "section": "§4.3", "last_verified": "2026-03-02" },
    "applies_to": { "tiers": ["tier_1", "tier_2"], "member_types": ["active"] },
    "inputs": [
      { "name": "age_at_retirement", "type": "number", "description": "Age in years at retirement date" },
      { "name": "earned_service_years", "type": "number", "description": "EARNED service only, excludes purchased" }
    ],
    "logic": {
      "type": "conditional",
      "conditions": [
        {
          "condition": "age_at_retirement >= 55 AND (age_at_retirement + earned_service_years) >= 75",
          "result": { "eligible_for_rule_of_75": true, "reduction_factor": 1.00 }
        }
      ]
    },
    "output": [
      { "field": "eligible_for_rule_of_75", "type": "boolean" },
      { "field": "reduction_factor", "type": "number" }
    ],
    "dependencies": ["RULE-VESTING"],
    "tags": ["eligibility", "unreduced"],
    "governance": {
      "status": "approved",
      "last_reviewed": "2026-03-02",
      "reviewed_by": "Rules Committee",
      "effective_date": "2026-03-02"
    },
    "test_cases": [
      {
        "name": "Happy path - Robert Martinez Rule of 75",
        "demo_case_ref": "Case 1: Robert Martinez - Tier 1",
        "inputs": { "tier": "tier_1", "age_at_retirement": 62, "earned_service_years": 27.5 },
        "expected": { "eligible_for_rule_of_75": true, "reduction_factor": 1.00 }
      }
    ],
    "test_status": {
      "total": 4,
      "passing": 4,
      "failing": 0,
      "skipped": 0,
      "last_run": "2026-03-19T14:30:00Z"
    }
  },
  "meta": { "request_id": "...", "timestamp": "...", "service": "knowledgebase", "version": "1.0.0" }
}
```

**Test report summary:**
```json
{
  "data": {
    "last_run": "2026-03-19T14:30:00Z",
    "total": 147,
    "passing": 147,
    "failing": 0,
    "skipped": 0,
    "duration_ms": 4230,
    "by_domain": {
      "eligibility": { "total": 32, "passing": 32, "failing": 0 },
      "benefit-calculation": { "total": 28, "passing": 28, "failing": 0 }
    },
    "by_rule": {
      "RULE-RULE-OF-75": { "total": 4, "passing": 4, "failing": 0, "tests": [
        { "name": "TestEvaluateEligibility/Rule_of_75_Robert_Martinez", "status": "pass", "duration_ms": 12 }
      ]}
    }
  }
}
```

**Demo case summary:**
```json
{
  "data": [
    {
      "case_id": "case1-robert-martinez",
      "description": "Tier 1, Rule of 75, leave payout inclusion",
      "member": { "first_name": "Robert", "last_name": "Martinez" },
      "tier": 1,
      "themes": ["Rule of 75", "Leave Payout", "Normal Retirement"],
      "test_count": 12,
      "test_status": { "passing": 12, "failing": 0 }
    }
  ]
}
```

#### Test Report Generation

Script to run locally or in CI:

```bash
#!/bin/bash
# generate-test-report.sh
mkdir -p test-results
cd platform/intelligence && go test -json ./... > ../../test-results/intelligence-report.json 2>&1
echo "Test report generated: test-results/intelligence-report.json"
```

#### Test-Rule Mapping File

```json
{
  "TestEvaluateEligibility/Rule_of_75_Robert_Martinez": "RULE-RULE-OF-75",
  "TestEvaluateEligibility/Rule_of_75_purchased_excluded": "RULE-RULE-OF-75",
  "TestCalculateBenefit/Case2_Jennifer_Kim_reduced": "RULE-BENEFIT-T2"
}
```

Maintained alongside Go test code. Updated when tests are added or renamed.

---

### Frontend — Routes

```
/rules                         → Rules Explorer (all domains)
/rules?domain=eligibility      → Filtered by domain
/rules/{ruleId}                → Rule detail view
/demo-cases                    → Demo Cases card grid
/demo-cases/{caseId}           → Case detail view
```

### Frontend — Component Tree

```
frontend/src/
├── pages/
│   ├── RulesExplorer.tsx
│   └── DemoCases.tsx
│
├── components/rules/
│   ├── RulesSummaryBar.tsx          ← "47/47 passing, last tested 3h ago"
│   ├── DomainFilter.tsx             ← Domain pill/tab selector
│   ├── RulesList.tsx                ← Grouped rule cards with status badges
│   ├── RuleCard.tsx                 ← Single rule row in the list
│   ├── RuleDetail.tsx               ← Full detail view with 4 tabs
│   ├── RuleLogicRenderer.tsx        ← Dispatcher → 4 type-specific renderers
│   │   ├── ConditionalRenderer.tsx  ← IF/THEN/ELSE blocks
│   │   ├── FormulaRenderer.tsx      ← Math expression display
│   │   ├── LookupTableRenderer.tsx  ← Data grid
│   │   └── ProceduralRenderer.tsx   ← Numbered step list
│   ├── RuleTestCases.tsx            ← Tests tab: expected vs actual table
│   ├── RuleInputsOutputs.tsx        ← Inputs/Outputs tab
│   └── RuleGovernance.tsx           ← Governance metadata tab
│
├── components/demo-cases/
│   ├── CaseCardGrid.tsx             ← Card layout for all cases
│   ├── CaseCard.tsx                 ← Summary card (name, tier, themes, pass/fail)
│   ├── CaseDetail.tsx               ← Detail view with 3 tabs
│   ├── MemberProfile.tsx            ← Member info + service credit breakdown
│   ├── CalculationTrace.tsx         ← Step-by-step rule execution with links
│   └── TestPoints.tsx               ← Pass/fail checklist from fixture
│
├── hooks/
│   ├── useRuleDefinitions.ts        ← React Query: GET /kb/rules/definitions
│   ├── useTestReport.ts             ← React Query: GET /kb/test-report
│   └── useDemoCases.ts              ← React Query: GET /kb/demo-cases
│
└── lib/
    └── rulesApi.ts                  ← API client for new KB endpoints
```

### Frontend — Rules Explorer Layout

**List view** (default):
- Summary bar: total passing/failing, last run timestamp
- Domain filter pills (All, Eligibility, Benefit Calc, Service Credit, etc.)
- Search box (filters by rule name, ID, or description)
- Rules grouped by domain, each domain header shows pass/fail count
- Each rule card shows: status badge (✓/✗), rule ID, description, test count

**Detail view** (click a rule):
- Header: rule ID, name, tier applicability, source reference, pass/fail badge
- Four tabs:
  - **Logic** — Structured rendering by `logic.type` (conditional → IF/THEN, formula → math, lookup_table → grid, procedural → numbered steps)
  - **Inputs/Outputs** — Parameter table with types and descriptions
  - **Tests** — YAML inline test cases with expected values; CI actual results joined alongside; expected vs actual comparison table
  - **Governance** — Status, effective date, reviewer, authority, dependencies, change log

### Frontend — Demo Cases Layout

**Grid view** (default):
- Cards for each demo case (4 total)
- Each card: member name, tier, key themes, test pass/fail count

**Detail view** (click a case):
- Header: case name, tier, hire/retirement dates, key themes
- Three tabs:
  - **Member Profile** — Member info, service credit breakdown table (earned vs purchased, which calculations use which)
  - **Calculation Trace** — Step-by-step execution order, each step linked to its rule in Rules Explorer, critical notes and warnings inline
  - **Test Points** — Pass/fail checklist from the fixture's `test_points` array

### Cross-Linking

- Rules Explorer → Demo Cases: `demo_case_ref` in test cases renders as navigable links
- Demo Cases → Rules Explorer: Rule IDs in Calculation Trace render as navigable links
- Rules Explorer → Rules Explorer: `dependencies` array renders as navigable links between rules

---

## What Gets Replaced

The existing `ConfigRulesPanel.tsx` is replaced by the Rules Explorer. The existing `GET /api/v1/kb/rules` and `GET /api/v1/kb/rules/{ruleId}` endpoints remain (used by contextual help elsewhere in the app), but the Rules Explorer uses the new `/rules/definitions` endpoints for full detail.

---

## Scope Boundaries — What This Does NOT Include

- **Rule editing in the UI** — rules are authored in YAML, reviewed via PR
- **On-demand test execution** — tests run in CI or locally, results are served as reports
- **Real-time test status** — report is refreshed on KB service cache TTL (5 min default)
- **Rule versioning/diffing** — future enhancement (git history is the version store)
- **Non-pension domains** — designed for DERP pension rules; extensible to other domains later

---

## Estimated Scope

| Component | New Files | Effort |
|-----------|-----------|--------|
| KB service: YAML parser + endpoints | 3-4 Go files | Medium |
| KB service: test report parser + endpoints | 2 Go files | Small |
| KB service: demo case endpoints | 1-2 Go files | Small |
| Test report generation script | 1 shell script | Trivial |
| Test-rule mapping file | 1 JSON file | Trivial |
| Frontend: hooks + API client | 4 TS files | Small |
| Frontend: Rules Explorer page + components | 12-14 TSX files | Large |
| Frontend: Demo Cases page + components | 6-7 TSX files | Medium |
| Frontend: routing + navigation updates | 2-3 TSX files | Small |
| Go tests for new endpoints | 2-3 Go test files | Medium |
| Frontend tests | 8-10 test files | Medium |

**Total: ~45-50 new files across backend and frontend.**
