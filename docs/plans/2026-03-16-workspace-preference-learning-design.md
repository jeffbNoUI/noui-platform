# Workspace Preference Learning — Design Document

**Date:** 2026-03-16
**Status:** Approved
**Approach:** Progressive Hybrid (structured rules V1, AI aggregation V2)

---

## Problem Statement

The workspace composition engine (`composeStages()`) produces the same layout for every user given the same case flags. But different users have different preferences — one analyst wants the DRO panel prominent, another hides it until needed. Currently there is no mechanism for users to customize their workspace layout or for the system to learn from usage patterns.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Learning scope | Per-user with aggregate intelligence | Individual preferences + role-based suggestions from peer patterns |
| Feedback type | Explicit only | Clean intentional signals; no implicit telemetry or dwell-time tracking |
| Aggregate action | Suggest to individual user | System proposes, user decides. No admin gate, no silent auto-updates |
| Context sensitivity | Case-flag-scoped | Preferences vary by case type (DRO, early retirement, tier). Maps to existing `CaseFlags` |
| Architecture | Progressive Hybrid | Structured preference store V1; AI aggregation layer V2 when data volume justifies it |

---

## 1. Data Model

### Context Key

Derived from coarsened `CaseFlags` to keep the context space manageable:

```
context_key = hash(caseType, hasDRO, isEarlyRetirement, tier)
```

Excludes `hasPurchasedService`, `hasLeavePayout`, `maritalStatus` — those affect panel existence (composition), not layout preference. Yields ~12 context buckets.

### Tables

```sql
-- Append-only event log. Source of truth + future AI training data.
CREATE TABLE preference_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  tenant_id     UUID NOT NULL,
  context_key   TEXT NOT NULL,
  context_flags JSONB NOT NULL,        -- full CaseFlags snapshot for V2 AI layer
  action_type   TEXT NOT NULL,         -- 'reorder' | 'pin' | 'hide' | 'expand' | 'collapse'
  target_panel  TEXT NOT NULL,
  payload       JSONB NOT NULL,        -- e.g. {position: 2} or {default_state: 'expanded'}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materialized current state. Fast read model for composition.
CREATE TABLE user_preferences (
  user_id       UUID NOT NULL REFERENCES users(id),
  tenant_id     UUID NOT NULL,
  context_key   TEXT NOT NULL,
  panel_id      TEXT NOT NULL,
  visibility    TEXT NOT NULL DEFAULT 'visible',  -- 'visible' | 'hidden' | 'pinned'
  position      INT,
  default_state TEXT NOT NULL DEFAULT 'collapsed',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, context_key, panel_id)
);

-- Role-level aggregate suggestions, computed by daily batch job.
CREATE TABLE role_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  role          TEXT NOT NULL,
  context_key   TEXT NOT NULL,
  panel_id      TEXT NOT NULL,
  suggestion    JSONB NOT NULL,         -- {action, position, confidence}
  sample_size   INT NOT NULL,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role, context_key, panel_id)
);

-- Tracks user responses to suggestions.
CREATE TABLE suggestion_responses (
  user_id       UUID NOT NULL REFERENCES users(id),
  suggestion_id UUID NOT NULL REFERENCES role_suggestions(id),
  response      TEXT NOT NULL,          -- 'accepted' | 'dismissed' | 'snoozed'
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, suggestion_id)
);
```

All tables get tenant-scoped RLS. `preference_events` and `user_preferences` also filter on `user_id`.

---

## 2. Feedback UI

### Panel Controls (visible in customize mode)

| Control | Action | Constraint |
|---------|--------|------------|
| Drag handle | Reorder panel position | Visual only — doesn't change backend stage sequence |
| Visibility toggle | Visible / Pinned / Hidden | Tier 1 mandatory stages cannot be hidden |
| Expansion toggle | Default expanded / collapsed | Available on all panels |

### Constraints

- Users cannot hide mandatory stages (Intake, Benefit Calculation, Election, Submit)
- Users cannot add panels that composition excluded
- Reorder is visual only — backend `stageIdx` progression is unchanged
- "Reset to defaults" clears all preferences for the current context

### Layout Integration

- **GuidedView / ExpertView:** Drag handles + toggles on panel headers
- **DeckView / OrbitView:** Reorder menu (drag doesn't suit these layouts)
- **Customize button** in workspace toolbar toggles customization mode on/off

---

## 3. Composition Integration

### Override Pipeline

```
CaseFlags → composeStages() → applyPreferences(stages, userPrefs) → ComposedStage[]
```

### Override Rules (Priority Order)

1. Composition is authoritative on panel existence
2. Preferences override presentation (order, expansion, visibility of non-mandatory panels)
3. Missing preferences fall through to composition defaults

### Types

```typescript
interface PanelPreference {
  panelId: string;
  visibility: 'visible' | 'hidden' | 'pinned';
  position: number | null;
  defaultState: 'expanded' | 'collapsed';
}

interface ComposedStage extends StageDescriptor {
  preferenceApplied: boolean;
  defaultPosition: number;
}
```

### Hook

```typescript
function useComposedWorkspace(flags: CaseFlags, data: CaseData): ComposedStage[] {
  const baseStages = useMemo(() => composeStages(flags, data), [flags, data]);
  const contextKey = useMemo(() => computeContextKey(flags), [flags]);
  const { preferences, loading } = useUserPreferences(contextKey);
  return useMemo(
    () => loading ? baseStages : applyPreferences(baseStages, preferences),
    [baseStages, preferences, loading]
  );
}
```

### New Files

- `frontend/src/lib/preferenceOverrides.ts` — Pure `applyPreferences()` function
- `frontend/src/hooks/useUserPreferences.ts` — Preference fetch + cache
- `frontend/src/hooks/useSuggestions.ts` — Suggestion fetch + respond mutation

### Modified Files

- `frontend/src/components/RetirementApplication.tsx` — Use `useComposedWorkspace()` instead of direct `composeStages()`

---

## 4. Aggregate Intelligence

### Batch Job

Runs daily at 02:00 UTC within the preferences service.

```
For each (tenant_id, role, context_key) with ≥5 users having preferences:
  1. Compute preference distribution per panel
  2. If ≥70% agree on a preference that differs from default → generate suggestion
  3. Delete stale suggestions where convergence dropped below threshold
```

Thresholds (70%, 5-user minimum) are configurable per tenant.

### Suggestion Delivery

- Max one suggestion per session
- Only shown after user has worked ≥3 cases in that context
- Uses peer count, not percentages: "7 of 10 analysts..."
- Three responses: **Try it** (accepted) / **Dismiss** (permanent) / **Not now** (snooze 7 days)

### Multi-Agency Future (V2)

The `context_key` is tenant-independent (derived from case flags, not tenant data). Pattern sharing across agencies requires:
1. Anonymization layer stripping tenant/user IDs
2. Sharing `(role, context_key, panel_id, preference_distribution)` tuples
3. No schema migration — current event schema supports this

---

## 5. Service Architecture

### New Service: `platform/preferences/` (Port 8089)

```
platform/preferences/
├── main.go
├── handler.go
├── store.go
├── context_key.go
├── suggestion_job.go
├── go.mod
└── go.sum
```

### API Endpoints

```
GET    /api/v1/preferences?context_key=...         → user's preferences for context
PUT    /api/v1/preferences                          → upsert preference + write event
DELETE /api/v1/preferences?context_key=...          → reset preferences for context
GET    /api/v1/suggestions?context_key=...          → active suggestion for user+context
POST   /api/v1/suggestions/:id/respond              → accept/dismiss/snooze
```

### Dependencies Added

None. Uses existing stack: Go + raw SQL + PostgreSQL.

---

## 6. Graceful Degradation

If the preferences service is unavailable:
- `useComposedWorkspace()` returns base `composeStages()` output unmodified
- Customize controls are disabled with tooltip
- No data loss — preferences persist in PostgreSQL
- System behavior is identical to today's (pre-feature) behavior

---

## 7. Event Schema — Designed for AI (V2)

The `preference_events` table captures full `context_flags` JSONB on every event, even though V1 only uses the coarsened `context_key`. This means:

- V2 AI layer can discover finer-grained patterns across the full flag space
- Event replay can reconstruct any user's preference history
- Cross-agency pattern models have rich feature vectors without schema migration

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Frontend                                                │
│                                                         │
│  CaseFlags ──► composeStages() ──► applyPreferences() ──► Render
│                                        ▲                │
│                    useUserPreferences() │                │
│                    useSuggestions()     │                │
│                         │              │                │
└─────────────────────────│──────────────│────────────────┘
                          │              │
                     REST API        Preference
                          │          Overrides
                          ▼
              ┌───────────────────────┐
              │ platform/preferences/ │
              │ (Port 8089)           │
              │                       │
              │  preference_events    │ ◄── append-only log
              │  user_preferences     │ ◄── materialized read model
              │  role_suggestions     │ ◄── batch job output
              │  suggestion_responses │ ◄── user feedback on suggestions
              │                       │
              │  [Daily Batch Job]    │ ──► compute role suggestions
              └───────────────────────┘
                          │
                     (V2 Future)
                          ▼
              ┌───────────────────────┐
              │ AI Aggregation Worker │
              │ (Python, Claude API)  │
              └───────────────────────┘
```
