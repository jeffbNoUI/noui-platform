# Member Portal Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the member portal as a plan-agnostic, persona-adaptive self-service experience for defined benefit pension plan members, covering active members, inactive members, retirees, and beneficiaries.

**Architecture:** The portal is a React frontend consuming existing platform REST APIs. All plan-specific behavior is driven by a configuration file (plan profile). All benefit calculations go through the deterministic Go rules engine — the frontend never computes monetary values. New backend endpoints are minimal — mostly extending existing services.

**Tech Stack:** React + TypeScript, Zustand (state), React Query (data), Tailwind + Institutional Warmth design system, Go platform services, PostgreSQL.

**Design doc:** `docs/plans/2026-03-17-member-portal-redesign-design.md`

---

## Phase Overview

| Phase | Name | What It Delivers | Tasks |
|-------|------|-------------------|-------|
| **1** | Foundation | Plan profile config, types, auth linking, DB migrations, demo accounts | 1–7 |
| **2** | Adaptive Dashboard | Portal shell, sidebar nav, persona-adaptive dashboard, guided tour framework | 8–15 |
| **3** | Profile & Data Correction | My Profile (all sub-tabs), flag-an-issue flow, staff work queue | 16–24 |
| **4** | What-If Calculator | Guided wizard, open calculator, saved scenarios, staleness detection | 25–33 |
| **5** | Retirement Application | Collaborative 5-stage member flow, staff handoff, concurrent change handling | 34–42 |
| **6** | Retiree & Beneficiary | My Benefit (payments, 1099-R, manage), death notification, survivor claim | 43–50 |
| **7** | Inactive Member | Deferred benefit explorer, refund application, refund estimate endpoint | 51–55 |
| **8** | Messages & Activity | Activity tracker, secure messaging, interaction history, notification bell | 56–62 |
| **9** | Documents | Checklist-driven uploads, ECM integration interface, document archive | 63–68 |
| **10** | Notifications & Preferences | Communication preferences, accessibility settings, email/SMS provider interface, guided tour content | 69–75 |
| **11** | Polish & Testing | E2E tests, accessibility audit, cross-persona integration tests | 76–80 |

Each phase produces a working, testable increment. Phases 1–4 deliver the core experience for active members. Phases 5–7 add the remaining personas. Phases 8–10 add communication and document management. Phase 11 hardens everything.

---

## Phase 1: Foundation

### Task 1: Plan Profile Types & Configuration Loader

**Files:**
- Create: `frontend/src/types/PlanProfile.ts`
- Create: `frontend/src/lib/planProfile.ts`
- Create: `frontend/src/config/plan-profile.yaml`
- Test: `frontend/src/lib/__tests__/planProfile.test.ts`

**Step 1: Write the types**

```typescript
// frontend/src/types/PlanProfile.ts
export interface PlanIdentity {
  plan_name: string;
  plan_short_name: string;
  administrator_name: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
}

export interface TierConfig {
  id: string;
  label: string;
  description: string;
  multiplier_display: string;
  ams_window_months: number;
  ams_window_label: string;
}

export interface EligibilityRuleConfig {
  id: string;
  label: string;
  description: string;
  applies_to_tiers?: string[];
}

export interface PaymentOptionConfig {
  id: string;
  label: string;
  description: string;
  has_survivor: boolean;
  survivor_pct?: number;
}

export interface ServiceCreditTypeConfig {
  id: string;
  label: string;
  counts_for_eligibility: boolean;
  counts_for_benefit: boolean;
}

export interface BenefitStructure {
  type: 'defined_benefit' | 'hybrid';
  formula_display: string;
  has_tiers: boolean;
  tiers: TierConfig[];
  eligibility_rules: EligibilityRuleConfig[];
  payment_options: PaymentOptionConfig[];
  early_retirement_reduction: {
    label: string;
    description_template: string;
  };
  service_credit: {
    types_available: ServiceCreditTypeConfig[];
    purchase_allowed: boolean;
    purchase_allowed_inactive: boolean;
  };
}

export interface MemberStatusConfig {
  id: string;
  label: string;
  persona: 'active' | 'inactive' | 'retiree' | 'beneficiary';
  show_refund_option?: boolean;
  show_deferred_option?: boolean;
}

export interface DocumentChecklistRule {
  document_type: string;
  label: string;
  required_when: string;
  contexts: string[];
  accepted_formats: string[];
  max_size_mb: number;
}

export interface FieldPermissions {
  immediate_edit: string[];
  staff_review: string[];
}

export interface DataChangeImpact {
  trigger: string;
  resets_stages: string[];
  reason: string;
  notify_staff: boolean;
}

export interface NotificationConfig {
  channels_available: string[];
  always_on: string[];
  default_email: boolean;
  default_sms: boolean;
  legally_required: string[];
}

export interface NotificationTemplate {
  email_subject: string;
  email_body: string;
  sms_body: string;
  in_portal_title: string;
  in_portal_body: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  applies_to_tiers?: string[];
}

export interface RefundConfig {
  available: boolean;
  includes_employee_contributions: boolean;
  includes_interest: boolean;
  includes_employer_contributions: boolean;
  mandatory_withholding_pct: number;
  rollover_allowed: boolean;
  early_withdrawal_penalty_age: number;
  early_withdrawal_penalty_pct: number;
}

export interface PlanProfile {
  identity: PlanIdentity;
  benefit_structure: BenefitStructure;
  member_statuses: MemberStatusConfig[];
  documents: { checklist_rules: DocumentChecklistRule[] };
  field_permissions: FieldPermissions;
  data_change_impacts: DataChangeImpact[];
  notifications: NotificationConfig;
  notification_templates: Record<string, NotificationTemplate>;
  help_content: {
    glossary_source: string;
    tour_version: number;
    plan_specific_terms: GlossaryTerm[];
  };
  refund: RefundConfig;
  death_benefits: {
    lump_sum_available: boolean;
    survivor_pension_available: boolean;
  };
}
```

**Step 2: Write the plan profile YAML**

Create `frontend/src/config/plan-profile.yaml` with the DERP configuration as the first implementation. This file drives all plan-specific behavior.

Reference the design doc Section 17 for the full structure. Populate with DERP values (3 tiers, Rule of 75/85, 4 payment options, document checklist rules, field permissions, data change impacts).

**Step 3: Write the configuration loader**

```typescript
// frontend/src/lib/planProfile.ts
import type { PlanProfile } from '@/types/PlanProfile';
import profileData from '@/config/plan-profile.yaml';

let cachedProfile: PlanProfile | null = null;

export function getPlanProfile(): PlanProfile {
  if (!cachedProfile) {
    cachedProfile = profileData as PlanProfile;
  }
  return cachedProfile;
}

export function getFieldPermission(field: string): 'immediate' | 'staff_review' {
  const profile = getPlanProfile();
  if (profile.field_permissions.immediate_edit.includes(field)) return 'immediate';
  return 'staff_review';
}

export function getDocumentChecklist(context: string, memberData: Record<string, unknown>): DocumentChecklistRule[] {
  const profile = getPlanProfile();
  return profile.documents.checklist_rules.filter(rule => {
    if (!rule.contexts.includes(context)) return false;
    if (rule.required_when === 'always') return true;
    // Evaluate simple conditions like "member.marital_status == 'married'"
    return evaluateCondition(rule.required_when, memberData);
  });
}

export function getDataChangeImpacts(trigger: string): DataChangeImpact[] {
  const profile = getPlanProfile();
  return profile.data_change_impacts.filter(i => i.trigger === trigger);
}

export function getGlossaryTerm(term: string, tierId?: string): GlossaryTerm | undefined {
  const profile = getPlanProfile();
  return profile.help_content.plan_specific_terms.find(t =>
    t.term === term && (!t.applies_to_tiers || !tierId || t.applies_to_tiers.includes(tierId))
  );
}

function evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
  // Simple expression evaluator for "member.field == 'value'" patterns
  const match = condition.match(/^(\w+)\.(\w+)\s*==\s*'?([^']+)'?$/);
  if (!match) return true;
  const [, , field, value] = match;
  return String(data[field]) === value;
}
```

**Step 4: Add YAML loader support to Vite**

Install `@rollup/plugin-yaml` (or use raw import with custom parser). Add to `vite.config.ts` plugins.

**Step 5: Write failing tests**

```typescript
// frontend/src/lib/__tests__/planProfile.test.ts
import { describe, it, expect } from 'vitest';
import { getPlanProfile, getFieldPermission, getDocumentChecklist, getDataChangeImpacts, getGlossaryTerm } from '../planProfile';

describe('planProfile', () => {
  it('loads plan profile with identity', () => {
    const profile = getPlanProfile();
    expect(profile.identity.plan_name).toBeTruthy();
    expect(profile.identity.phone).toBeTruthy();
  });

  it('has benefit structure with tiers', () => {
    const profile = getPlanProfile();
    expect(profile.benefit_structure.tiers.length).toBeGreaterThan(0);
    expect(profile.benefit_structure.type).toBe('defined_benefit');
  });

  it('returns immediate for phone field', () => {
    expect(getFieldPermission('phone')).toBe('immediate');
  });

  it('returns staff_review for legal_name field', () => {
    expect(getFieldPermission('legal_name')).toBe('staff_review');
  });

  it('returns retirement_application checklist for married member', () => {
    const checklist = getDocumentChecklist('retirement_application', { marital_status: 'married' });
    const types = checklist.map(c => c.document_type);
    expect(types).toContain('proof_of_age');
    expect(types).toContain('marriage_certificate');
  });

  it('excludes marriage_certificate for single member', () => {
    const checklist = getDocumentChecklist('retirement_application', { marital_status: 'single' });
    const types = checklist.map(c => c.document_type);
    expect(types).not.toContain('marriage_certificate');
  });

  it('returns data change impacts for beneficiary_change', () => {
    const impacts = getDataChangeImpacts('beneficiary_change');
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0].resets_stages).toContain('payment_option');
  });

  it('returns glossary term for tier-specific rule', () => {
    const term = getGlossaryTerm('Rule of 75', 'tier_1');
    expect(term).toBeDefined();
    expect(term!.definition).toContain('75');
  });
});
```

**Step 6: Run tests, verify they fail, implement, verify they pass**

Run: `cd frontend && npm test -- --run src/lib/__tests__/planProfile.test.ts`

**Step 7: Commit**

```bash
git add frontend/src/types/PlanProfile.ts frontend/src/lib/planProfile.ts frontend/src/config/plan-profile.yaml frontend/src/lib/__tests__/planProfile.test.ts frontend/vite.config.ts
git commit -m "[frontend] Add plan profile types and configuration loader"
```

---

### Task 2: Member Portal Types

**Files:**
- Modify: `frontend/src/types/Member.ts` (extend existing)
- Create: `frontend/src/types/MemberPortal.ts`
- Test: `frontend/src/types/__tests__/MemberPortal.test.ts`

**Step 1: Define new portal-specific types**

```typescript
// frontend/src/types/MemberPortal.ts
export type MemberPersona = 'active' | 'inactive' | 'retiree' | 'beneficiary';

export interface MemberAccountLink {
  clerk_user_id: string;
  member_id: number;
  linked_at: string;
  linked_by: 'auto_match' | string;
  status: 'active' | 'suspended' | 'revoked';
}

export interface MemberPreferences {
  communication: Record<string, { email: boolean; sms: boolean }>;
  sms_number?: string;
  accessibility: {
    text_size: 'standard' | 'larger' | 'largest';
    high_contrast: boolean;
    reduce_motion: boolean;
  };
  tour_completed: boolean;
  tour_version: number;
}

export interface SavedScenario {
  id: string;
  member_id: number;
  label: string;
  inputs: ScenarioInputs;
  results: ScenarioResults;
  data_version: string;
  is_stale: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScenarioInputs {
  retirement_date: string;
  service_purchase_years: number;
  salary_growth_pct: number;
  payment_option: string;
  beneficiary_dob?: string;
}

export interface ScenarioResults {
  monthly_benefit: number;
  eligibility_type: 'EARLY' | 'NORMAL' | 'INELIGIBLE';
  reduction_pct: number;
  ams: number;
  base_benefit: number;
  service_years: number;
  payment_options: PaymentOptionResult[];
}

export interface PaymentOptionResult {
  option_id: string;
  member_amount: number;
  survivor_amount: number;
}

export interface Notification {
  id: string;
  member_id: number;
  type: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  type: 'change_request' | 'application' | 'document_review' | 'data_correction' | 'beneficiary_change' | 'identity_verification';
  status: 'action_needed' | 'in_progress' | 'completed' | 'rejected';
  title: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
  updated_at: string;
  resolution_note?: string;
}

export interface ChangeRequest {
  id: string;
  member_id: number;
  field_name: string;
  current_value: string;
  proposed_value: string;
  reason: string;
  evidence_document_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  staff_note?: string;
  created_at: string;
  resolved_at?: string;
}

export interface PaymentRecord {
  id: string;
  payment_date: string;
  gross_amount: number;
  federal_tax: number;
  state_tax: number;
  other_deductions: number;
  net_amount: number;
  bank_last_four: string;
}

export interface TaxDocument {
  id: string;
  tax_year: number;
  document_type: '1099-R';
  available: boolean;
  download_url?: string;
}

export interface DocumentUpload {
  id: string;
  document_type: string;
  filename: string;
  status: 'processing' | 'received' | 'rejected';
  ecm_ref?: string;
  uploaded_at: string;
  context?: string;
  linked_issue_id?: string;
}

export interface IdentityVerificationRequest {
  last_name: string;
  date_of_birth: string;
  ssn_last_four: string;
  is_beneficiary: boolean;
  member_last_name?: string;
  member_ssn_last_four?: string;
}

export interface IdentityVerificationResult {
  status: 'matched' | 'ambiguous' | 'not_found';
  member_id?: number;
  message: string;
}

// Persona resolver
export function resolveMemberPersona(member: { status_code: string; member_id: number }, beneficiaryOf?: number[]): MemberPersona[] {
  const personas: MemberPersona[] = [];
  const status = member.status_code.toLowerCase();

  if (status === 'active') personas.push('active');
  else if (status === 'inactive' || status === 'deferred') personas.push('inactive');
  else if (status === 'retired') personas.push('retiree');

  if (beneficiaryOf && beneficiaryOf.length > 0) personas.push('beneficiary');

  return personas.length > 0 ? personas : ['active']; // fallback
}
```

**Step 2: Write tests for persona resolution**

```typescript
// frontend/src/types/__tests__/MemberPortal.test.ts
import { describe, it, expect } from 'vitest';
import { resolveMemberPersona } from '../MemberPortal';

describe('resolveMemberPersona', () => {
  it('returns active for active member', () => {
    expect(resolveMemberPersona({ status_code: 'ACTIVE', member_id: 1 })).toEqual(['active']);
  });

  it('returns inactive for inactive member', () => {
    expect(resolveMemberPersona({ status_code: 'INACTIVE', member_id: 1 })).toEqual(['inactive']);
  });

  it('returns retiree for retired member', () => {
    expect(resolveMemberPersona({ status_code: 'RETIRED', member_id: 1 })).toEqual(['retiree']);
  });

  it('returns dual role for active member who is also beneficiary', () => {
    expect(resolveMemberPersona({ status_code: 'ACTIVE', member_id: 1 }, [2])).toEqual(['active', 'beneficiary']);
  });

  it('returns beneficiary only for pure beneficiary', () => {
    expect(resolveMemberPersona({ status_code: 'INACTIVE', member_id: 1 }, [2])).toEqual(['inactive', 'beneficiary']);
  });
});
```

**Step 3: Run tests, implement, commit**

Run: `cd frontend && npm test -- --run src/types/__tests__/MemberPortal.test.ts`

```bash
git add frontend/src/types/MemberPortal.ts frontend/src/types/__tests__/MemberPortal.test.ts
git commit -m "[frontend] Add member portal types and persona resolver"
```

---

### Task 3: Member Auth Linking — Database Migration

**Files:**
- Create: `domains/pension/schema/016_member_portal.sql`

**Step 1: Write the migration**

```sql
-- 016_member_portal.sql
-- Member Portal: account linking, preferences, scenarios, notifications, documents

-- Clerk user <-> pension member linking
CREATE TABLE IF NOT EXISTS member_account_links (
  clerk_user_id   TEXT PRIMARY KEY,
  member_id       INTEGER NOT NULL,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by       TEXT NOT NULL,  -- 'auto_match' or staff user ID
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked'))
);
CREATE INDEX IF NOT EXISTS idx_member_account_links_member
  ON member_account_links(member_id);

-- Member preferences (communication, accessibility, tour state)
CREATE TABLE IF NOT EXISTS member_preferences (
  member_id       INTEGER PRIMARY KEY,
  preferences     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved what-if scenarios
CREATE TABLE IF NOT EXISTS saved_scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  label           TEXT NOT NULL,
  inputs          JSONB NOT NULL,
  results         JSONB NOT NULL,
  data_version    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_member
  ON saved_scenarios(member_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  channels        JSONB NOT NULL DEFAULT '["in_portal"]'::jsonb,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  delivered       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_member_unread
  ON notifications(member_id, read) WHERE read = FALSE;

-- Document metadata (ECM references)
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  document_type   TEXT NOT NULL,
  filename        TEXT NOT NULL,
  ecm_ref         TEXT,
  status          TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'received', 'rejected')),
  context         TEXT,
  linked_issue_id UUID,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_member
  ON documents(member_id);

-- Payment history (for retirees)
CREATE TABLE IF NOT EXISTS payment_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  payment_date    DATE NOT NULL,
  gross_amount    NUMERIC(12,2) NOT NULL,
  federal_tax     NUMERIC(12,2) NOT NULL DEFAULT 0,
  state_tax       NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(12,2) NOT NULL,
  bank_last_four  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_history_member
  ON payment_history(member_id);

-- Tax documents (1099-R records)
CREATE TABLE IF NOT EXISTS tax_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  tax_year        INTEGER NOT NULL,
  document_type   TEXT NOT NULL DEFAULT '1099-R',
  ecm_ref         TEXT,
  available       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, tax_year, document_type)
);
CREATE INDEX IF NOT EXISTS idx_tax_documents_member
  ON tax_documents(member_id);

-- Extend issues table with new types
-- (issues table already exists from migration 016/017 in the issues service)
-- New issue types are handled by the application layer, not schema constraints.

-- Extend cases table for member-initiated applications
ALTER TABLE cases ADD COLUMN IF NOT EXISTS initiated_by TEXT DEFAULT 'staff'
  CHECK (initiated_by IN ('staff', 'member'));
ALTER TABLE cases ADD COLUMN IF NOT EXISTS bounce_message TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS bounce_stage TEXT;
```

**Step 2: Commit**

```bash
git add domains/pension/schema/016_member_portal.sql
git commit -m "[db] Add migration 016: member portal tables"
```

---

### Task 4: Demo Member Accounts — Seed Data

**Files:**
- Create: `domains/pension/seed/016_member_portal_seed.sql`

**Step 1: Write seed data for 8 demo personas**

Create seed data including:
- Member 10004 (inactive, not vested — 3 years service)
- Member 10005 (retiree — retired 2023, payment history, 1099-Rs)
- Member 10006 (survivor beneficiary — spouse of deceased retiree)
- Member 10007 (lump sum beneficiary — child, $5K death benefit)
- Member 10008 (dual role — active member + survivor beneficiary)
- `member_account_links` for all 8 demo accounts
- `member_preferences` with defaults for each
- `payment_history` for retirees (10005, 10006) — 12 months
- `tax_documents` for retirees (10005, 10006) — 2023, 2024, 2025
- `saved_scenarios` for active members (10001, 10002) — 2 each
- `notifications` — a few sample notifications per member

Reference existing seed patterns in `domains/pension/seed/002_legacy_seed.sql` for member record format.

**Step 2: Commit**

```bash
git add domains/pension/seed/016_member_portal_seed.sql
git commit -m "[db] Add seed data for 8 member portal demo accounts"
```

---

### Task 5: Dev Auth Extension — Persona Switcher

**Files:**
- Modify: `frontend/src/lib/devAuth.ts`
- Modify: `frontend/src/types/auth.ts`
- Test: `frontend/src/lib/__tests__/devAuth.test.ts`

**Step 1: Extend DEV_USERS with member persona accounts**

Add to `devAuth.ts`:
```typescript
export const DEV_MEMBER_ACCOUNTS = [
  { id: 'dev-member-active-near', role: 'member' as UserRole, label: 'Active (near retirement)', memberId: 10001 },
  { id: 'dev-member-active-early', role: 'member' as UserRole, label: 'Active (early career)', memberId: 10002 },
  { id: 'dev-member-inactive-vested', role: 'member' as UserRole, label: 'Inactive (vested)', memberId: 10003 },
  { id: 'dev-member-inactive-novest', role: 'member' as UserRole, label: 'Inactive (not vested)', memberId: 10004 },
  { id: 'dev-member-retiree', role: 'member' as UserRole, label: 'Retiree', memberId: 10005 },
  { id: 'dev-member-survivor', role: 'member' as UserRole, label: 'Survivor beneficiary', memberId: 10006 },
  { id: 'dev-member-deathben', role: 'member' as UserRole, label: 'Death benefit recipient', memberId: 10007 },
  { id: 'dev-member-dual', role: 'member' as UserRole, label: 'Dual role (member + beneficiary)', memberId: 10008 },
] as const;
```

**Step 2: Update DevRoleSwitcher to show member persona selector**

When `role === 'member'`, show a dropdown of member personas instead of just one "member" option.

**Step 3: Test, commit**

```bash
git commit -m "[frontend] Extend dev auth with 8 member persona accounts"
```

---

### Task 6: Member Portal API Client

**Files:**
- Create: `frontend/src/lib/memberPortalApi.ts`
- Test: `frontend/src/lib/__tests__/memberPortalApi.test.ts`

**Step 1: Write the API client**

```typescript
// frontend/src/lib/memberPortalApi.ts
import { fetchAPI, postAPI, putAPI, deleteAPI, patchAPI } from './apiClient';
import type {
  MemberPreferences, SavedScenario, ScenarioInputs,
  Notification, IdentityVerificationRequest, IdentityVerificationResult,
  PaymentRecord, TaxDocument, DocumentUpload, ChangeRequest
} from '@/types/MemberPortal';

// Identity verification
export const memberAuthAPI = {
  verify: (req: IdentityVerificationRequest) =>
    postAPI<IdentityVerificationResult>('/api/v1/member-auth/verify', req),
};

// Preferences
export const memberPreferencesAPI = {
  get: (memberId: number) =>
    fetchAPI<MemberPreferences>(`/api/v1/members/${memberId}/preferences`),
  update: (memberId: number, prefs: MemberPreferences) =>
    putAPI<MemberPreferences>(`/api/v1/members/${memberId}/preferences`, prefs),
};

// Saved scenarios
export const scenarioAPI = {
  list: (memberId: number) =>
    fetchAPI<SavedScenario[]>(`/api/v1/scenarios?member_id=${memberId}`),
  get: (id: string) =>
    fetchAPI<SavedScenario>(`/api/v1/scenarios/${id}`),
  save: (memberId: number, label: string, inputs: ScenarioInputs, results: unknown, dataVersion: string) =>
    postAPI<SavedScenario>('/api/v1/scenarios', { member_id: memberId, label, inputs, results, data_version: dataVersion }),
  delete: (id: string) =>
    deleteAPI<void>(`/api/v1/scenarios/${id}`),
};

// Notifications
export const notificationAPI = {
  list: (memberId: number) =>
    fetchAPI<Notification[]>(`/api/v1/notifications?member_id=${memberId}`),
  markRead: (id: string) =>
    patchAPI<void>(`/api/v1/notifications/${id}/read`, {}),
};

// Payments (retirees)
export const paymentAPI = {
  list: (memberId: number) =>
    fetchAPI<PaymentRecord[]>(`/api/v1/members/${memberId}/payments`),
  taxDocuments: (memberId: number) =>
    fetchAPI<TaxDocument[]>(`/api/v1/members/${memberId}/tax-documents`),
};

// Documents
export const documentAPI = {
  list: (memberId: number) =>
    fetchAPI<DocumentUpload[]>(`/api/v1/members/${memberId}/documents`),
  upload: (issueId: string, file: File, documentType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    return postAPI<DocumentUpload>(`/api/v1/issues/${issueId}/documents`, formData);
  },
};

// Change requests (uses issues service)
export const changeRequestAPI = {
  list: (memberId: number) =>
    fetchAPI<ChangeRequest[]>(`/api/v1/issues?member_id=${memberId}&type=profile_change,beneficiary_change,data_correction,direct_deposit_change`),
  create: (req: Omit<ChangeRequest, 'id' | 'status' | 'staff_note' | 'created_at' | 'resolved_at'>) =>
    postAPI<ChangeRequest>('/api/v1/issues', { ...req, type: 'profile_change' }),
};

// Addresses
export const addressAPI = {
  list: (memberId: number) =>
    fetchAPI<Address[]>(`/api/v1/members/${memberId}/addresses`),
  update: (memberId: number, addressId: string, data: Partial<Address>) =>
    putAPI<Address>(`/api/v1/members/${memberId}/addresses/${addressId}`, data),
};

// Refund estimate (inactive members)
export const refundAPI = {
  estimate: (memberId: number) =>
    fetchAPI<{ employee_contributions: number; interest: number; total: number }>(`/api/v1/members/${memberId}/refund-estimate`),
};

interface Address {
  id: string;
  type: 'mailing' | 'residential';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}
```

**Step 2: Write tests (mock fetch), verify, commit**

```bash
git commit -m "[frontend] Add member portal API client"
```

---

### Task 7: Vite Proxy Routes for New Endpoints

**Files:**
- Modify: `frontend/vite.config.ts`

**Step 1: Add proxy entries**

Add to the Vite proxy config:
```typescript
'/api/v1/member-auth': { target: 'http://localhost:8081', changeOrigin: true },
'/api/v1/scenarios':   { target: 'http://localhost:8081', changeOrigin: true },
'/api/v1/notifications': { target: 'http://localhost:8081', changeOrigin: true },
'/api/v1/documents':   { target: 'http://localhost:8081', changeOrigin: true },
```

Note: New endpoints are served from the dataaccess service (8081) initially. They can be split out later if needed.

**Step 2: Commit**

```bash
git commit -m "[frontend] Add Vite proxy routes for member portal endpoints"
```

---

## Phase 2: Adaptive Dashboard

### Task 8: Portal Shell & Sidebar Navigation

**Files:**
- Create: `frontend/src/components/portal/MemberPortalShell.tsx`
- Create: `frontend/src/components/portal/MemberPortalSidebar.tsx`
- Test: `frontend/src/components/portal/__tests__/MemberPortalShell.test.tsx`
- Test: `frontend/src/components/portal/__tests__/MemberPortalSidebar.test.tsx`

**Step 1: Write the shell component**

The shell provides the persistent layout: sidebar + main content area + optional help panel. It reads the plan profile for navigation items and filters by persona.

Key props: `memberId`, `personas` (from persona resolver), `activeSection`, `onNavigate`.

Sidebar items filtered by persona visibility (design doc Section 3). Uses `iw-navy` sidebar background, `iw-sage` for active item highlight.

**Step 2: Write the sidebar component**

Navigation items with icons, labels, notification badge counts. Collapsible on tablet (hamburger toggle). Bottom-fixed help link.

ARIA: `role="navigation"`, `aria-current="page"` on active item.

**Step 3: Write tests — renders correct items per persona, highlights active, hides items not applicable**

**Step 4: Commit**

```bash
git commit -m "[frontend] Add MemberPortalShell and sidebar navigation"
```

---

### Task 9: Persona-Adaptive Dashboard — Active Member

**Files:**
- Create: `frontend/src/components/portal/dashboard/ActiveMemberDashboard.tsx`
- Create: `frontend/src/components/portal/dashboard/BenefitHero.tsx`
- Create: `frontend/src/components/portal/dashboard/MilestoneTimeline.tsx`
- Create: `frontend/src/components/portal/dashboard/ActionItems.tsx`
- Test: `frontend/src/components/portal/dashboard/__tests__/ActiveMemberDashboard.test.tsx`

**Step 1: Build BenefitHero**

Displays estimated monthly benefit (from intelligence service calculation), not account balance. Shows greeting with member name, years of service, key stat.

Uses: `useBenefitCalculation(memberId, estimatedRetirementDate)` — existing hook.

**Step 2: Build MilestoneTimeline**

Visual timeline showing: vesting status, years to eligibility rule (e.g., "Rule of 75 — 3 years away"), normal retirement date. Uses service credit and eligibility data.

Plan-profile-driven: reads `eligibility_rules` for labels, `plan_specific_terms` for descriptions.

**Step 3: Build ActionItems**

Shows pending items: incomplete profile fields, pending document requests, unread messages. Aggregates from multiple hooks (notifications, issues, case status).

**Step 4: Build ActiveMemberDashboard**

Composes BenefitHero + ActionItems + MilestoneTimeline + quick-link cards ("Explore retirement scenarios", "Update my profile").

**Step 5: Tests, commit**

```bash
git commit -m "[frontend] Add active member adaptive dashboard"
```

---

### Task 10: Persona-Adaptive Dashboard — Retiree

**Files:**
- Create: `frontend/src/components/portal/dashboard/RetireeDashboard.tsx`
- Create: `frontend/src/components/portal/dashboard/NextPaymentCard.tsx`
- Create: `frontend/src/components/portal/dashboard/RecentPayments.tsx`
- Create: `frontend/src/hooks/usePayments.ts`
- Test: `frontend/src/components/portal/dashboard/__tests__/RetireeDashboard.test.tsx`

**Step 1: Build usePayments hook**

```typescript
export function usePayments(memberId: number) {
  return useQuery({
    queryKey: ['payments', memberId],
    queryFn: () => paymentAPI.list(memberId),
    enabled: !!memberId,
  });
}
```

**Step 2: Build NextPaymentCard** — gross, deductions, net, bank, date.

**Step 3: Build RecentPayments** — last 3 months table.

**Step 4: Build RetireeDashboard** — NextPaymentCard + RecentPayments + quick links (1099-R, verification letter, manage).

**Step 5: Tests, commit**

```bash
git commit -m "[frontend] Add retiree adaptive dashboard"
```

---

### Task 11: Persona-Adaptive Dashboard — Inactive Member

**Files:**
- Create: `frontend/src/components/portal/dashboard/InactiveMemberDashboard.tsx`
- Create: `frontend/src/components/portal/dashboard/OptionsComparison.tsx`
- Create: `frontend/src/hooks/useRefundEstimate.ts`
- Test: `frontend/src/components/portal/dashboard/__tests__/InactiveMemberDashboard.test.tsx`

Vested variant shows deferred benefit vs. refund side-by-side. Not-vested variant shows refund only with vesting explanation.

**Commit:**
```bash
git commit -m "[frontend] Add inactive member adaptive dashboard"
```

---

### Task 12: Persona-Adaptive Dashboard — Beneficiary

**Files:**
- Create: `frontend/src/components/portal/dashboard/BeneficiaryDashboard.tsx`
- Test: `frontend/src/components/portal/dashboard/__tests__/BeneficiaryDashboard.test.tsx`

Survivor variant: monthly benefit, recent payments. Lump sum variant: claim status, payment confirmation.

**Commit:**
```bash
git commit -m "[frontend] Add beneficiary adaptive dashboard"
```

---

### Task 13: Dashboard Router — Persona Selection

**Files:**
- Create: `frontend/src/components/portal/dashboard/DashboardRouter.tsx`
- Test: `frontend/src/components/portal/dashboard/__tests__/DashboardRouter.test.tsx`

Routes to correct dashboard component based on `resolveMemberPersona()` output. Handles dual-role by showing both sections.

**Commit:**
```bash
git commit -m "[frontend] Add dashboard router for persona-based rendering"
```

---

### Task 14: Guided Tour Framework

**Files:**
- Create: `frontend/src/components/portal/tour/TourProvider.tsx`
- Create: `frontend/src/components/portal/tour/TourSpotlight.tsx`
- Create: `frontend/src/components/portal/tour/TourTooltip.tsx`
- Create: `frontend/src/components/portal/tour/tourSteps.ts`
- Create: `frontend/src/hooks/useTour.ts`
- Test: `frontend/src/components/portal/tour/__tests__/TourProvider.test.tsx`

Tour steps defined per persona in `tourSteps.ts` — reads from plan profile for labels. Spotlight uses `data-tour-id` attributes on target elements. Keyboard navigable (arrows, Tab, Escape).

State persisted to `member_preferences.tour_completed` and `tour_version`.

**Commit:**
```bash
git commit -m "[frontend] Add guided tour framework with spotlight pattern"
```

---

### Task 15: Wire Up — Replace Old MemberPortal with New Shell

**Files:**
- Modify: `frontend/src/components/portal/MemberPortal.tsx` (major rewrite)
- Modify: `frontend/src/App.tsx` (update portal props)
- Test: `frontend/src/components/portal/__tests__/MemberPortal.test.tsx`

Replace the existing 6-tab MemberPortal with the new MemberPortalShell + DashboardRouter. Preserve backward compatibility with existing props from App.tsx.

**Step 1: Update MemberPortal.tsx to use MemberPortalShell**

The new MemberPortal becomes a thin wrapper that:
1. Resolves member persona via `resolveMemberPersona()`
2. Renders MemberPortalShell with sidebar navigation
3. Routes to the active section (dashboard by default)
4. Wraps in TourProvider

**Step 2: Update existing tests, add new integration test**

**Step 3: Run full frontend test suite: `npm test -- --run`**

**Step 4: Commit**

```bash
git commit -m "[frontend] Wire new portal shell replacing old tab-based MemberPortal"
```

---

## Phase 3: Profile & Data Correction

### Task 16: Profile Shell with Sub-Tab Navigation

**Files:**
- Create: `frontend/src/components/portal/profile/ProfileSection.tsx`
- Create: `frontend/src/components/portal/profile/ProfileTabNav.tsx`
- Test: `frontend/src/components/portal/profile/__tests__/ProfileSection.test.tsx`

6 sub-tabs: Personal Info, Addresses, Beneficiaries, Employment, Contributions, Service Credit.

**Commit:**
```bash
git commit -m "[frontend] Add profile section shell with sub-tab navigation"
```

---

### Task 17: Personal Info Tab — View & Edit

**Files:**
- Create: `frontend/src/components/portal/profile/PersonalInfoTab.tsx`
- Create: `frontend/src/components/portal/profile/EditableField.tsx`
- Create: `frontend/src/components/portal/profile/ChangeRequestForm.tsx`
- Test: `frontend/src/components/portal/profile/__tests__/PersonalInfoTab.test.tsx`

EditableField reads `getFieldPermission(fieldName)` to determine if it's immediate-edit or staff-review. Staff-review fields show ChangeRequestForm (proposed value + reason + optional document).

**Commit:**
```bash
git commit -m "[frontend] Add personal info tab with editable fields and change requests"
```

---

### Task 18: Addresses Tab

**Files:**
- Create: `frontend/src/components/portal/profile/AddressesTab.tsx`
- Create: `frontend/src/hooks/useAddresses.ts`
- Test: `frontend/src/components/portal/profile/__tests__/AddressesTab.test.tsx`

Multiple address types (mailing, residential). Immediate edit with validation.

**Commit:**
```bash
git commit -m "[frontend] Add addresses tab with inline editing"
```

---

### Task 19: Beneficiaries Tab

**Files:**
- Create: `frontend/src/components/portal/profile/BeneficiariesTab.tsx`
- Create: `frontend/src/components/portal/profile/BeneficiaryForm.tsx`
- Test: `frontend/src/components/portal/profile/__tests__/BeneficiariesTab.test.tsx`

Add/edit/remove beneficiaries. All changes go through staff review. Allocation percentage validation (must sum to 100%). Pending changes shown with status. Active application warning (design doc Gap 6).

**Commit:**
```bash
git commit -m "[frontend] Add beneficiaries tab with allocation validation and staff review"
```

---

### Task 20: Employment History Tab

**Files:**
- Create: `frontend/src/components/portal/profile/EmploymentHistoryTab.tsx`
- Test: `frontend/src/components/portal/profile/__tests__/EmploymentHistoryTab.test.tsx`

Read-only timeline using existing `useEmployment(memberId)` hook. "Flag Issue" button on each entry.

**Commit:**
```bash
git commit -m "[frontend] Add employment history timeline with flag-an-issue"
```

---

### Task 21: Contributions Tab

**Files:**
- Create: `frontend/src/components/portal/profile/ContributionsTab.tsx`
- Test: `frontend/src/components/portal/profile/__tests__/ContributionsTab.test.tsx`

Summary cards (employee, employer, total) + annual history table. Uses existing contribution hooks.

**Commit:**
```bash
git commit -m "[frontend] Add contributions tab with summary cards and history"
```

---

### Task 22: Service Credit Tab

**Files:**
- Create: `frontend/src/components/portal/profile/ServiceCreditTab.tsx`
- Test: `frontend/src/components/portal/profile/__tests__/ServiceCreditTab.test.tsx`

Breakdown by type with eligibility vs. benefit totals. Contextual help explaining the distinction. Link to calculator for service purchase. Plan-profile-driven labels.

**Commit:**
```bash
git commit -m "[frontend] Add service credit tab with plan-profile-driven labels"
```

---

### Task 23: Flag-an-Issue Shared Component

**Files:**
- Create: `frontend/src/components/portal/shared/FlagIssueModal.tsx`
- Test: `frontend/src/components/portal/shared/__tests__/FlagIssueModal.test.tsx`

Reusable modal: shows current value, proposed correction input, description textarea, optional file upload. Creates issue via Issues service API.

**Commit:**
```bash
git commit -m "[frontend] Add reusable flag-an-issue modal component"
```

---

### Task 24: Staff Work Queue — Member Requests Tab

**Files:**
- Create: `frontend/src/components/services/MemberRequestsPanel.tsx`
- Create: `frontend/src/components/services/RequestDetailPanel.tsx`
- Create: `frontend/src/hooks/useMemberRequests.ts`
- Test: `frontend/src/components/services/__tests__/MemberRequestsPanel.test.tsx`

New tab in Services Hub (or Staff Portal sidebar). Shows prioritized work queue. Resolution flow with approve/reject/escalate and mandatory notes.

Impact assessment display for salary/service corrections (calls intelligence service to show benefit delta).

**Commit:**
```bash
git commit -m "[frontend] Add staff work queue for member-initiated requests"
```

---

## Phase 4: What-If Calculator

### Task 25: Calculator Types & Hooks

**Files:**
- Create: `frontend/src/hooks/useWhatIfCalculator.ts`
- Create: `frontend/src/hooks/useSavedScenarios.ts`
- Test: `frontend/src/hooks/__tests__/useWhatIfCalculator.test.ts`
- Test: `frontend/src/hooks/__tests__/useSavedScenarios.test.ts`

`useWhatIfCalculator` wraps the intelligence service calls (benefit/calculate, eligibility/evaluate, benefit/options) with scenario inputs as parameters. Debounces at 500ms for open calculator mode.

`useSavedScenarios` provides CRUD for saved scenarios with staleness checking.

**Commit:**
```bash
git commit -m "[frontend] Add what-if calculator and saved scenarios hooks"
```

---

### Task 26: Guided Wizard — Step Components

**Files:**
- Create: `frontend/src/components/portal/calculator/GuidedWizard.tsx`
- Create: `frontend/src/components/portal/calculator/WizardStep.tsx`
- Create: `frontend/src/components/portal/calculator/steps/RetirementDateStep.tsx`
- Create: `frontend/src/components/portal/calculator/steps/ServicePurchaseStep.tsx`
- Create: `frontend/src/components/portal/calculator/steps/SalaryGrowthStep.tsx`
- Create: `frontend/src/components/portal/calculator/steps/PaymentOptionStep.tsx`
- Create: `frontend/src/components/portal/calculator/steps/ResultsStep.tsx`
- Test: `frontend/src/components/portal/calculator/__tests__/GuidedWizard.test.tsx`

Each step is a standalone component with clear question, options (radio/dropdown), contextual data panel showing member's current info. Next/Back navigation with validation.

**Commit:**
```bash
git commit -m "[frontend] Add guided retirement calculator wizard with 5 steps"
```

---

### Task 27: Results Display — Formula Breakdown

**Files:**
- Create: `frontend/src/components/portal/calculator/BenefitResult.tsx`
- Create: `frontend/src/components/portal/calculator/FormulaBreakdown.tsx`
- Create: `frontend/src/components/portal/calculator/WaitComparison.tsx`
- Create: `frontend/src/components/portal/calculator/PaymentOptionTable.tsx`
- Test: `frontend/src/components/portal/calculator/__tests__/BenefitResult.test.tsx`

Shows monthly benefit prominently, formula chain (AMS x multiplier x years = base, reduction, J&S), "What if you wait?" comparison at 3-4 dates, payment option comparison table.

Plan-profile-driven: reads `formula_display`, `payment_options`, `early_retirement_reduction` for labels.

**Commit:**
```bash
git commit -m "[frontend] Add benefit result display with formula transparency"
```

---

### Task 28: Open Calculator Mode

**Files:**
- Create: `frontend/src/components/portal/calculator/OpenCalculator.tsx`
- Create: `frontend/src/components/portal/calculator/CalculatorInputPanel.tsx`
- Create: `frontend/src/components/portal/calculator/CalculatorResultPanel.tsx`
- Test: `frontend/src/components/portal/calculator/__tests__/OpenCalculator.test.tsx`

Side-by-side layout: inputs (left) with sliders/dropdowns, results (right) updating in real time. Eligibility warnings when parameters don't meet requirements. Pre-populated with member's actual data.

Inputs: retirement date, age slider, service purchase slider, salary growth, payment option, beneficiary DOB. Results: monthly benefit, eligibility type, reduction, AMS, formula breakdown.

**Commit:**
```bash
git commit -m "[frontend] Add open calculator mode with real-time updates"
```

---

### Task 29: Calculator Section Router

**Files:**
- Create: `frontend/src/components/portal/calculator/CalculatorSection.tsx`
- Test: `frontend/src/components/portal/calculator/__tests__/CalculatorSection.test.tsx`

Mode toggle (Guided / Open Calculator). Renders the active mode. "Save Scenario" and "Compare Saved" buttons available from both modes.

**Commit:**
```bash
git commit -m "[frontend] Add calculator section with guided/open mode toggle"
```

---

### Task 30: Saved Scenarios — List & Compare

**Files:**
- Create: `frontend/src/components/portal/calculator/SavedScenariosList.tsx`
- Create: `frontend/src/components/portal/calculator/ScenarioCompare.tsx`
- Create: `frontend/src/components/portal/calculator/SaveScenarioDialog.tsx`
- Test: `frontend/src/components/portal/calculator/__tests__/SavedScenariosList.test.tsx`

List with labels, key metrics, save date. Stale indicator with "Recalculate" button. Side-by-side comparison table (2-3 scenarios). "Use for Application" button.

**Commit:**
```bash
git commit -m "[frontend] Add saved scenarios list, compare view, and save dialog"
```

---

### Task 31: Staleness Detection

**Files:**
- Create: `frontend/src/lib/scenarioStaleness.ts`
- Test: `frontend/src/lib/__tests__/scenarioStaleness.test.ts`

`computeDataVersion(member, serviceCredit, beneficiaries, planConfigVersion)` → hash string. Compare against saved scenario's `data_version`. Pure function, no side effects.

**Commit:**
```bash
git commit -m "[frontend] Add scenario staleness detection via data version hashing"
```

---

### Task 32: Contextual Help Panel — Calculator

**Files:**
- Create: `frontend/src/components/portal/help/ContextualHelpPanel.tsx`
- Create: `frontend/src/components/portal/help/GlossaryItem.tsx`
- Test: `frontend/src/components/portal/help/__tests__/ContextualHelpPanel.test.tsx`

Collapsible right-side panel. Content driven by plan profile glossary terms. Adapts to member's tier (shows correct Rule of N). Reusable across all sections — pass `sectionId` to load relevant help content.

**Commit:**
```bash
git commit -m "[frontend] Add contextual help panel with plan-profile glossary"
```

---

### Task 33: Wire Calculator into Portal Shell

**Files:**
- Modify: `frontend/src/components/portal/MemberPortal.tsx`
- Test: run full test suite

Add "Plan My Retirement" route in the shell. Pass memberId, connect hooks.

**Commit:**
```bash
git commit -m "[frontend] Wire what-if calculator into portal shell navigation"
```

---

## Phase 5: Retirement Application

### Task 34: Application Types & State Machine

**Files:**
- Create: `frontend/src/types/RetirementApplication.ts`
- Create: `frontend/src/lib/applicationStateMachine.ts`
- Test: `frontend/src/lib/__tests__/applicationStateMachine.test.ts`

Define member-side application stages (verify_info, upload_docs, benefit_estimate, payment_option, review_submit) and staff-side stages (staff_review, complete). State transitions, bounce-back handling.

**Commit:**
```bash
git commit -m "[frontend] Add retirement application types and state machine"
```

---

### Task 35: Application Tracker (Progress Bar)

**Files:**
- Create: `frontend/src/components/portal/application/ApplicationTracker.tsx`
- Test: `frontend/src/components/portal/application/__tests__/ApplicationTracker.test.tsx`

Horizontal step tracker showing all stages. Color-coded: complete (green), current (sage), future (gray), bounced (amber). Shows "Your action needed" / "Waiting on staff" labels.

**Commit:**
```bash
git commit -m "[frontend] Add application progress tracker component"
```

---

### Task 36: Stage 1 — Verify Your Information

**Files:**
- Create: `frontend/src/components/portal/application/VerifyInfoStage.tsx`
- Test: `frontend/src/components/portal/application/__tests__/VerifyInfoStage.test.tsx`

Lists personal info, employment, beneficiaries. Each item has "Correct" or "Flag" toggle. All items must be addressed to proceed. Flagged items create issues via Issues service.

**Commit:**
```bash
git commit -m "[frontend] Add application Stage 1: verify information"
```

---

### Task 37: Stage 2 — Upload Required Documents

**Files:**
- Create: `frontend/src/components/portal/application/UploadDocsStage.tsx`
- Create: `frontend/src/components/portal/shared/DocumentUploader.tsx`
- Test: `frontend/src/components/portal/application/__tests__/UploadDocsStage.test.tsx`

Dynamic checklist from `getDocumentChecklist('retirement_application', memberData)`. File upload with progress indicator. Accepted format validation client-side.

**Commit:**
```bash
git commit -m "[frontend] Add application Stage 2: document upload with dynamic checklist"
```

---

### Task 38: Stage 3 — Review Benefit Estimate

**Files:**
- Create: `frontend/src/components/portal/application/BenefitEstimateStage.tsx`
- Test: `frontend/src/components/portal/application/__tests__/BenefitEstimateStage.test.tsx`

Calls intelligence service with verified data (or saved scenario inputs). Shows full formula breakdown (reuses FormulaBreakdown component from calculator). "Looks correct" or "Something seems wrong" buttons.

**Commit:**
```bash
git commit -m "[frontend] Add application Stage 3: benefit estimate review"
```

---

### Task 39: Stage 4 — Select Payment Option

**Files:**
- Create: `frontend/src/components/portal/application/PaymentOptionStage.tsx`
- Test: `frontend/src/components/portal/application/__tests__/PaymentOptionStage.test.tsx`

Radio selection with member amount and survivor amount for each option. Plan-profile-driven option list. Beneficiary name/age displayed. Contextual explanation of permanence.

**Commit:**
```bash
git commit -m "[frontend] Add application Stage 4: payment option selection"
```

---

### Task 40: Stage 5 — Review & Submit

**Files:**
- Create: `frontend/src/components/portal/application/ReviewSubmitStage.tsx`
- Test: `frontend/src/components/portal/application/__tests__/ReviewSubmitStage.test.tsx`

Summary of all selections. Two acknowledgment checkboxes (required). Submit creates case via case management service with `initiated_by: 'member'`.

**Commit:**
```bash
git commit -m "[frontend] Add application Stage 5: review and submit"
```

---

### Task 41: Staff Review Status View

**Files:**
- Create: `frontend/src/components/portal/application/StaffReviewView.tsx`
- Test: `frontend/src/components/portal/application/__tests__/StaffReviewView.test.tsx`

Read-only view showing staff progress. Activity log (verified employment, verified salary, etc.). Bounce-back handling: if staff bounces, shows message and requested action with upload/message options.

**Commit:**
```bash
git commit -m "[frontend] Add application staff review status view with bounce-back"
```

---

### Task 42: Application Section Router & Concurrent Change Handling

**Files:**
- Create: `frontend/src/components/portal/application/ApplicationSection.tsx`
- Create: `frontend/src/hooks/useRetirementApplication.ts`
- Test: `frontend/src/components/portal/application/__tests__/ApplicationSection.test.tsx`

Routes to correct stage based on case status. Handles "not started" (show eligibility info + start button), "in progress" (show current stage), "under review" (show staff status), "complete" (show benefit details).

Concurrent change handling: when a data change impact rule triggers, show which stages are reset and why (reads from `getDataChangeImpacts(trigger)`).

**Commit:**
```bash
git commit -m "[frontend] Add application section router with concurrent change handling"
```

---

## Phase 6: Retiree & Beneficiary

### Task 43: My Benefit Section Shell

**Files:**
- Create: `frontend/src/components/portal/benefit/BenefitSection.tsx`
- Create: `frontend/src/components/portal/benefit/BenefitTabNav.tsx`
- Test: `frontend/src/components/portal/benefit/__tests__/BenefitSection.test.tsx`

4 sub-tabs: Payments, Tax Documents, Benefit Details, Manage. Visible to retirees and beneficiaries only.

**Commit:**
```bash
git commit -m "[frontend] Add My Benefit section shell with sub-tabs"
```

---

### Task 44: Payments Tab

**Files:**
- Create: `frontend/src/components/portal/benefit/PaymentsTab.tsx`
- Test: `frontend/src/components/portal/benefit/__tests__/PaymentsTab.test.tsx`

Next payment card (gross, deductions breakdown, net, bank, date). Payment history table with all months. Uses `usePayments` hook from Task 10.

**Commit:**
```bash
git commit -m "[frontend] Add payments tab with next payment card and history"
```

---

### Task 45: Tax Documents Tab

**Files:**
- Create: `frontend/src/components/portal/benefit/TaxDocumentsTab.tsx`
- Create: `frontend/src/hooks/useTaxDocuments.ts`
- Test: `frontend/src/components/portal/benefit/__tests__/TaxDocumentsTab.test.tsx`

1099-R forms listed by year with download links. "Request paper copy" button (creates message to staff).

**Commit:**
```bash
git commit -m "[frontend] Add tax documents tab with 1099-R downloads"
```

---

### Task 46: Benefit Details Tab

**Files:**
- Create: `frontend/src/components/portal/benefit/BenefitDetailsTab.tsx`
- Test: `frontend/src/components/portal/benefit/__tests__/BenefitDetailsTab.test.tsx`

Permanent calculation record from finalized case snapshot. Full formula breakdown: AMS, multiplier, years, reduction, J&S factor. Reuses FormulaBreakdown component.

**Commit:**
```bash
git commit -m "[frontend] Add benefit details tab with calculation record"
```

---

### Task 47: Manage Tab — Direct Deposit, Withholding, Verification Letter

**Files:**
- Create: `frontend/src/components/portal/benefit/ManageTab.tsx`
- Create: `frontend/src/components/portal/benefit/DirectDepositForm.tsx`
- Create: `frontend/src/components/portal/benefit/TaxWithholdingForm.tsx`
- Test: `frontend/src/components/portal/benefit/__tests__/ManageTab.test.tsx`

Direct deposit: re-auth required, 48-hour hold, staff review, voided check upload. Tax withholding: immediate change. Benefit verification letter: generate via correspondence service. Address: immediate edit.

**Commit:**
```bash
git commit -m "[frontend] Add manage tab with direct deposit, withholding, and verification letter"
```

---

### Task 48: Death Notification Page

**Files:**
- Create: `frontend/src/components/portal/death/DeathNotificationPage.tsx`
- Create: `frontend/src/components/portal/death/DeathNotificationForm.tsx`
- Test: `frontend/src/components/portal/death/__tests__/DeathNotificationPage.test.tsx`

Phone-first design. Online form as secondary. 3 steps: about the retiree, about you, confirmation with reference number and next steps. Compassionate language per design doc Section 11.

Accessible without logging in (public page with rate limiting).

**Commit:**
```bash
git commit -m "[frontend] Add death notification page with compassionate UX"
```

---

### Task 49: Survivor Benefit Claim View

**Files:**
- Create: `frontend/src/components/portal/benefit/SurvivorClaimView.tsx`
- Test: `frontend/src/components/portal/benefit/__tests__/SurvivorClaimView.test.tsx`

Simplified tracker: Notify → Docs → Review → Staff Review → Payments Begin. Shows estimated survivor benefit. Document checklist for death-related documents.

**Commit:**
```bash
git commit -m "[frontend] Add survivor benefit claim tracker view"
```

---

### Task 50: Lump Sum Death Benefit View

**Files:**
- Create: `frontend/src/components/portal/benefit/DeathBenefitView.tsx`
- Test: `frontend/src/components/portal/benefit/__tests__/DeathBenefitView.test.tsx`

Benefit amount, allocation percentage, document requirements (photo ID, W-9), payment method selection, claim status.

**Commit:**
```bash
git commit -m "[frontend] Add lump sum death benefit claim view"
```

---

## Phase 7: Inactive Member

### Task 51: Deferred Benefit Explorer

**Files:**
- Create: `frontend/src/components/portal/inactive/DeferredBenefitExplorer.tsx`
- Test: `frontend/src/components/portal/inactive/__tests__/DeferredBenefitExplorer.test.tsx`

Adapts the guided wizard: retirement date step (when to start receiving), service purchase step, no salary growth step (frozen), payment option step, results. Uses same intelligence service APIs.

**Commit:**
```bash
git commit -m "[frontend] Add deferred benefit explorer for inactive members"
```

---

### Task 52: Refund Estimate Display

**Files:**
- Create: `frontend/src/components/portal/inactive/RefundEstimate.tsx`
- Test: `frontend/src/components/portal/inactive/__tests__/RefundEstimate.test.tsx`

Shows employee contributions + interest = total. Tax implications: 20% withholding vs. IRA rollover comparison. Uses `useRefundEstimate` hook.

**Commit:**
```bash
git commit -m "[frontend] Add refund estimate with tax implications display"
```

---

### Task 53: Refund Application Flow

**Files:**
- Create: `frontend/src/components/portal/inactive/RefundApplication.tsx`
- Create: `frontend/src/components/portal/inactive/RefundAcknowledgment.tsx`
- Test: `frontend/src/components/portal/inactive/__tests__/RefundApplication.test.tsx`

5-stage simplified flow: verify info, upload docs, review amount with tax/rollover choice, acknowledge (double confirmation), staff processing status.

**Commit:**
```bash
git commit -m "[frontend] Add refund application flow with double confirmation"
```

---

### Task 54: Backend — Refund Estimate Endpoint

**Files:**
- Modify: `platform/dataaccess/api/handlers.go` (add endpoint)
- Modify: `platform/dataaccess/db/queries.go` (add query)
- Modify: `platform/dataaccess/main.go` (add route)
- Test: `platform/dataaccess/api/handlers_test.go`

`GET /api/v1/members/{id}/refund-estimate` → returns `{ employee_contributions, interest, total }`.

Query sums from contribution records for the member.

**Commit:**
```bash
git commit -m "[platform/dataaccess] Add refund estimate endpoint"
```

---

### Task 55: Backend — Payment History & Tax Document Endpoints

**Files:**
- Modify: `platform/dataaccess/api/handlers.go`
- Modify: `platform/dataaccess/db/queries.go`
- Modify: `platform/dataaccess/main.go`
- Test: `platform/dataaccess/api/handlers_test.go`

`GET /api/v1/members/{id}/payments` → payment history from `payment_history` table.
`GET /api/v1/members/{id}/tax-documents` → tax document list from `tax_documents` table.
`GET /api/v1/members/{id}/addresses` → address records.
`PUT /api/v1/members/{id}/addresses/{aid}` → update address.

**Commit:**
```bash
git commit -m "[platform/dataaccess] Add payment history, tax documents, and address endpoints"
```

---

## Phase 8: Messages & Activity

### Task 56: Activity Tracker Component

**Files:**
- Create: `frontend/src/components/portal/activity/ActivityTracker.tsx`
- Create: `frontend/src/components/portal/activity/ActivityItem.tsx`
- Create: `frontend/src/hooks/useActivityTracker.ts`
- Test: `frontend/src/components/portal/activity/__tests__/ActivityTracker.test.tsx`

Aggregates from issues service + case management + notifications. Organized by: Action Needed, In Progress, Recently Completed. Each item shows type icon, title, description, date, action button.

**Commit:**
```bash
git commit -m "[frontend] Add activity tracker with aggregated status view"
```

---

### Task 57: Secure Messaging — Thread List

**Files:**
- Create: `frontend/src/components/portal/messages/MessageList.tsx`
- Create: `frontend/src/components/portal/messages/MessageThread.tsx`
- Create: `frontend/src/hooks/useSecureMessages.ts`
- Test: `frontend/src/components/portal/messages/__tests__/MessageList.test.tsx`

Threaded conversations. New message badge. Linked to activity items where relevant.

**Commit:**
```bash
git commit -m "[frontend] Add secure messaging with threaded conversations"
```

---

### Task 58: Compose Message

**Files:**
- Create: `frontend/src/components/portal/messages/ComposeMessage.tsx`
- Test: `frontend/src/components/portal/messages/__tests__/ComposeMessage.test.tsx`

New message form with subject, body, file attachment. Creates interaction via CRM service.

**Commit:**
```bash
git commit -m "[frontend] Add compose message with file attachment"
```

---

### Task 59: Interaction History Tab

**Files:**
- Create: `frontend/src/components/portal/messages/InteractionHistory.tsx`
- Test: `frontend/src/components/portal/messages/__tests__/InteractionHistory.test.tsx`

Full chronological record: calls, emails, visits, portal messages, letters. Read-only. Filterable by type and date. Uses existing CRM interactions API.

**Commit:**
```bash
git commit -m "[frontend] Add interaction history with type and date filters"
```

---

### Task 60: Messages & Activity Section Router

**Files:**
- Create: `frontend/src/components/portal/messages/MessagesSection.tsx`
- Test: `frontend/src/components/portal/messages/__tests__/MessagesSection.test.tsx`

3 sub-tabs: Activity Tracker, Messages, Interaction History.

**Commit:**
```bash
git commit -m "[frontend] Add messages section router with 3 sub-tabs"
```

---

### Task 61: Notification Bell Component

**Files:**
- Create: `frontend/src/components/portal/shared/NotificationBell.tsx`
- Create: `frontend/src/hooks/useNotifications.ts`
- Test: `frontend/src/components/portal/shared/__tests__/NotificationBell.test.tsx`

Badge count = unread notifications + action-needed items. Dropdown shows recent notifications. Click marks as read. Links to relevant activity item.

**Commit:**
```bash
git commit -m "[frontend] Add notification bell with badge count and dropdown"
```

---

### Task 62: Backend — Notification & Scenario Endpoints

**Files:**
- Modify: `platform/dataaccess/api/handlers.go`
- Modify: `platform/dataaccess/db/queries.go`
- Modify: `platform/dataaccess/main.go`
- Test: `platform/dataaccess/api/handlers_test.go`

Notifications: GET list (unread), PATCH mark read, POST create (internal).
Scenarios: POST save, GET list, GET detail, DELETE.
Preferences: GET, PUT.

**Commit:**
```bash
git commit -m "[platform/dataaccess] Add notification, scenario, and preferences endpoints"
```

---

## Phase 9: Documents

### Task 63: Document Section Shell

**Files:**
- Create: `frontend/src/components/portal/documents/DocumentSection.tsx`
- Test: `frontend/src/components/portal/documents/__tests__/DocumentSection.test.tsx`

2 views: My Checklist (action-oriented) and All Documents (archive). Tab toggle.

**Commit:**
```bash
git commit -m "[frontend] Add document section shell with checklist and archive views"
```

---

### Task 64: Document Checklist View

**Files:**
- Create: `frontend/src/components/portal/documents/DocumentChecklist.tsx`
- Create: `frontend/src/hooks/useDocumentChecklist.ts`
- Test: `frontend/src/components/portal/documents/__tests__/DocumentChecklist.test.tsx`

Dynamic from `getDocumentChecklist(context, memberData)`. Outstanding vs. received sections. Upload button per item. Accepted format display.

**Commit:**
```bash
git commit -m "[frontend] Add dynamic document checklist with upload per item"
```

---

### Task 65: Document Archive View

**Files:**
- Create: `frontend/src/components/portal/documents/DocumentArchive.tsx`
- Test: `frontend/src/components/portal/documents/__tests__/DocumentArchive.test.tsx`

Chronological: uploaded by member, received from plan, DRO court orders. Filterable by type and date. View/download links.

**Commit:**
```bash
git commit -m "[frontend] Add document archive with categorized views"
```

---

### Task 66: File Upload Component

**Files:**
- Create: `frontend/src/components/portal/shared/FileUpload.tsx`
- Test: `frontend/src/components/portal/shared/__tests__/FileUpload.test.tsx`

Drag-and-drop + click-to-browse. Client-side validation (file type, max size). Progress indicator. HEIC accepted. Status display (processing → received). Reused across document upload, flag-issue evidence, direct deposit voided check.

**Commit:**
```bash
git commit -m "[frontend] Add reusable file upload component with validation and progress"
```

---

### Task 67: ECM Integration Interface

**Files:**
- Create: `platform/dataaccess/ecm/interface.go`
- Create: `platform/dataaccess/ecm/local.go`
- Test: `platform/dataaccess/ecm/local_test.go`

Go interface: `Ingest(file, metadata) -> ECMRef`, `Retrieve(ref) -> SignedURL`, `Delete(ref)`.

`local.go` implements a local filesystem adapter for dev/testing. Production adapter for specific ECM (OnBase, Hyland, etc.) added later.

**Commit:**
```bash
git commit -m "[platform/dataaccess] Add ECM integration interface with local adapter"
```

---

### Task 68: Backend — Document Upload & Download Endpoints

**Files:**
- Modify: `platform/dataaccess/api/handlers.go`
- Modify: `platform/dataaccess/main.go`
- Test: `platform/dataaccess/api/handlers_test.go`

`POST /api/v1/issues/{id}/documents` — multipart upload, virus scan (stub in dev), ECM ingest.
`GET /api/v1/issues/{id}/documents` — list documents on issue.
`GET /api/v1/documents/{id}/download` — signed URL from ECM.
`GET /api/v1/members/{id}/documents` — all documents for member.

**Commit:**
```bash
git commit -m "[platform/dataaccess] Add document upload, download, and listing endpoints"
```

---

## Phase 10: Notifications & Preferences

### Task 69: Preferences Section Shell

**Files:**
- Create: `frontend/src/components/portal/preferences/PreferencesSection.tsx`
- Test: `frontend/src/components/portal/preferences/__tests__/PreferencesSection.test.tsx`

3 sub-tabs: Communication, Accessibility, Security.

**Commit:**
```bash
git commit -m "[frontend] Add preferences section shell"
```

---

### Task 70: Communication Preferences

**Files:**
- Create: `frontend/src/components/portal/preferences/CommunicationPrefs.tsx`
- Create: `frontend/src/hooks/useMemberPreferences.ts`
- Test: `frontend/src/components/portal/preferences/__tests__/CommunicationPrefs.test.tsx`

Matrix of notification types × channels. In-portal always on (non-toggleable). Legally required items shown as always-on per plan profile. SMS number input with opt-in confirmation.

**Commit:**
```bash
git commit -m "[frontend] Add communication preferences with channel matrix"
```

---

### Task 71: Accessibility Preferences

**Files:**
- Create: `frontend/src/components/portal/preferences/AccessibilityPrefs.tsx`
- Create: `frontend/src/lib/accessibilityTheme.ts`
- Test: `frontend/src/components/portal/preferences/__tests__/AccessibilityPrefs.test.tsx`

Text size (standard/larger/largest), high contrast toggle, reduce motion toggle. `accessibilityTheme.ts` applies CSS custom properties based on preferences. Preview text sample.

**Commit:**
```bash
git commit -m "[frontend] Add accessibility preferences with live CSS custom properties"
```

---

### Task 72: Security Preferences

**Files:**
- Create: `frontend/src/components/portal/preferences/SecurityPrefs.tsx`
- Test: `frontend/src/components/portal/preferences/__tests__/SecurityPrefs.test.tsx`

Password change, 2FA management (delegates to Clerk components), active sessions list, "Sign out all other sessions". Mostly thin wrappers around Clerk's built-in UI.

**Commit:**
```bash
git commit -m "[frontend] Add security preferences with Clerk integration"
```

---

### Task 73: Notification Provider Interface

**Files:**
- Create: `platform/dataaccess/notify/interface.go`
- Create: `platform/dataaccess/notify/console.go`
- Test: `platform/dataaccess/notify/console_test.go`

Go interface: `Send(recipient, template, data) -> DeliveryResult`, `CheckStatus(id) -> DeliveryStatus`.

`console.go` implements a dev adapter that logs to stdout and stores in `dev_notification_log` table. Production adapters (Resend, Twilio) added later.

**Commit:**
```bash
git commit -m "[platform/dataaccess] Add notification provider interface with console adapter"
```

---

### Task 74: Guided Tour Content

**Files:**
- Modify: `frontend/src/components/portal/tour/tourSteps.ts`
- Test: `frontend/src/components/portal/tour/__tests__/tourSteps.test.ts`

Define complete tour stops for each persona (active: 8 stops, retiree: 6 stops, inactive: 5 stops, beneficiary: 4 stops). Content reads from plan profile for plan-specific labels. `data-tour-id` attributes added to all target components.

**Commit:**
```bash
git commit -m "[frontend] Add complete guided tour content for all personas"
```

---

### Task 75: Wire All Remaining Sections into Portal Shell

**Files:**
- Modify: `frontend/src/components/portal/MemberPortal.tsx`
- Test: run full frontend test suite

Connect all sections (Profile, Calculator, Application, Benefit, Messages, Documents, Preferences, Help) to the sidebar navigation routing. Verify persona visibility filtering works correctly.

**Step 1: Run full test suite**: `cd frontend && npm test -- --run`
**Step 2: Run typecheck**: `cd frontend && npx tsc --noEmit`

**Commit:**
```bash
git commit -m "[frontend] Wire all portal sections into shell navigation"
```

---

## Phase 11: Polish & Testing

### Task 76: E2E — Active Member Journey

**Files:**
- Create: `tests/e2e/member_portal_active.sh` (or Playwright script)

Test: Login as 10001 → dashboard shows benefit → navigate to calculator → run guided wizard → save scenario → navigate to profile → verify employment history → flag an issue → check activity tracker shows flag.

**Commit:**
```bash
git commit -m "[tests] Add E2E test for active member portal journey"
```

---

### Task 77: E2E — Retirement Application Lifecycle

**Files:**
- Create: `tests/e2e/member_portal_application.sh`

Test: Login as 10001 → start application from saved scenario → complete 5 member stages → verify case created → switch to staff → verify work queue → bounce back → switch to member → respond → switch to staff → complete.

**Commit:**
```bash
git commit -m "[tests] Add E2E test for retirement application lifecycle"
```

---

### Task 78: E2E — Retiree Journey

**Files:**
- Create: `tests/e2e/member_portal_retiree.sh`

Test: Login as 10005 → dashboard shows payment → view payment history → download 1099-R → generate benefit verification letter → change tax withholding → attempt direct deposit change (verify re-auth + hold).

**Commit:**
```bash
git commit -m "[tests] Add E2E test for retiree portal journey"
```

---

### Task 79: Accessibility Audit

**Files:**
- Create: `tests/accessibility/portal_axe_audit.ts`

Run axe-core against every portal section with each persona. Verify: color contrast, keyboard navigation, ARIA labels, target sizes, focus indicators. Document any findings and fix.

**Commit:**
```bash
git commit -m "[tests] Add accessibility audit with axe-core across all portal sections"
```

---

### Task 80: Cross-Persona Integration Test

**Files:**
- Create: `tests/e2e/member_portal_personas.sh`

Test: Switch through all 8 demo accounts. For each: verify dashboard renders correctly for persona, verify correct sidebar items visible, verify restricted sections not accessible. Test dual-role (10008) shows both member and beneficiary sections.

**Commit:**
```bash
git commit -m "[tests] Add cross-persona integration test for all 8 demo accounts"
```

---

## Verification Checklist (Run After Each Phase)

```bash
# TypeScript
cd frontend && npx tsc --noEmit

# Frontend tests
cd frontend && npm test -- --run

# Go builds (if backend modified)
cd platform/dataaccess && go build ./... && go test ./...

# Lint
cd frontend && npx eslint src/

# Git status — no untracked cruft
git status --short
```

---

## Dependencies Added (Flag for Approval)

| Package | Purpose | Phase |
|---------|---------|-------|
| `@rollup/plugin-yaml` | Load plan profile YAML in Vite | 1 |
| `js-yaml` (types) | YAML parsing if needed | 1 |

No other new dependencies anticipated. All UI built with existing React + Tailwind + Recharts stack.
