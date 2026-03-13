# Member Dashboard Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Member Dashboard with a hybrid AI summary (context + action items), action-first layout, compact reference sidebar, and summary logging scaffold.

**Architecture:** The deterministic summary engine returns structured `MemberSummaryResult` (context string + prioritized attention items) instead of a flat paragraph. The dashboard layout shifts to 2/3 action zone + 1/3 reference sidebar. A fire-and-forget POST logs each summary to the intelligence service for future LLM training corpus.

**Tech Stack:** React + TypeScript, Tailwind CSS, Go (intelligence service), PostgreSQL (summary log table)

**Design doc:** `docs/plans/2026-03-13-member-dashboard-enhancement-design.md`

---

## Task 1: Restructure Summary Types and Engine

**Files:**
- Modify: `frontend/src/lib/memberSummary.ts`

**Step 1: Add new types at the top of memberSummary.ts**

Replace the current `MemberSummaryInput` interface and add the new structured output types. Keep the existing `ActiveCaseItem` interface unchanged.

```typescript
// After ActiveCaseItem interface (line 13), add:

export type AttentionSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface AttentionItem {
  severity: AttentionSeverity;
  label: string;
  detail: string;
}

export interface MemberSummaryResult {
  context: string;
  attentionItems: AttentionItem[];
}
```

**Step 2: Rewrite generateMemberSummary to return MemberSummaryResult**

Replace the function body. Keep the same input type (`MemberSummaryInput`). The new function builds:
- `context`: one sentence — tenure + eligibility + active case stage
- `attentionItems`: prioritized list sorted by severity

```typescript
export function generateMemberSummary(input: MemberSummaryInput): MemberSummaryResult {
  const { member, serviceCredit, eligibility, beneficiaries, activeCases, openCommitments, recentInteractionCount, lastInteractionDate, correspondenceCount, dataQualityIssueCount } = input;

  // ── Context line ──────────────────────────────────────────────────────
  const name = `${member.first_name} ${member.last_name}`;
  const parts: string[] = [];

  // Tenure
  if (serviceCredit) {
    parts.push(`${formatServiceYears(serviceCredit.total_years)} ${tierLabel(member.tier_code)} veteran`);
  } else {
    parts.push(`${tierLabel(member.tier_code)} member`);
  }

  // Eligibility
  if (eligibility) {
    if (eligibility.best_eligible_type === 'NONE') {
      parts.push(eligibility.vested ? 'vested but not yet eligible' : 'not yet vested');
    } else {
      const eligType = eligibilityLabel(eligibility.best_eligible_type);
      if (eligibility.reduction_pct > 0) {
        parts.push(`${eligType} eligible with ${eligibility.reduction_pct.toFixed(0)}% reduction`);
      } else {
        parts.push(`${eligType} eligible, no reduction`);
      }
    }
  }

  // Active case
  if (activeCases.length === 1) {
    const c = activeCases[0];
    parts.push(`case at ${c.stage}`);
  } else if (activeCases.length > 1) {
    parts.push(`${activeCases.length} active cases`);
  }

  const context = `${name} — ${parts.join(', ')}.`;

  // ── Attention items (sorted by severity) ─────────────────────────────
  const items: AttentionItem[] = [];

  // Critical: overdue commitments
  const overdue = openCommitments.filter((c) => c.status === 'overdue');
  for (const c of overdue) {
    const dueDate = new Date(c.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    items.push({
      severity: 'critical',
      label: 'Overdue commitment',
      detail: `${c.description} — due ${dueDate}${c.ownerAgent ? ` (${c.ownerAgent})` : ''}`,
    });
  }

  // High: urgent cases
  const urgentCases = activeCases.filter((c) => c.priority === 'urgent');
  for (const c of urgentCases) {
    items.push({
      severity: 'high',
      label: 'Urgent case',
      detail: `${c.caseId} at ${c.stage} — ${c.daysOpen}d open`,
    });
  }

  // High: no beneficiaries
  if (beneficiaries && beneficiaries.length === 0) {
    items.push({
      severity: 'high',
      label: 'No beneficiaries',
      detail: 'No beneficiary designations on file',
    });
  }

  // Medium: DQ issues
  if (dataQualityIssueCount > 0) {
    items.push({
      severity: 'medium',
      label: 'Data quality',
      detail: `${dataQualityIssueCount} issue${dataQualityIssueCount > 1 ? 's' : ''} flagged for review`,
    });
  }

  // Medium: commitments due within 7 days
  const now = new Date();
  const soonCommitments = openCommitments.filter((c) => {
    if (c.status === 'overdue') return false; // already listed
    const due = new Date(c.targetDate);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });
  for (const c of soonCommitments) {
    const dueDate = new Date(c.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    items.push({
      severity: 'medium',
      label: 'Upcoming commitment',
      detail: `${c.description} — due ${dueDate}`,
    });
  }

  // Info: positive confirmations (only if no critical/high items dominate)
  if (beneficiaries && beneficiaries.length > 0) {
    items.push({
      severity: 'info',
      label: 'Beneficiaries',
      detail: `${beneficiaries.length} designation${beneficiaries.length > 1 ? 's' : ''} on file`,
    });
  }

  if (dataQualityIssueCount === 0) {
    items.push({
      severity: 'info',
      label: 'Data quality',
      detail: 'No issues flagged',
    });
  }

  return { context, attentionItems: items };
}
```

Also add this import at the top of the file (alongside existing imports):
```typescript
import { tierLabel } from '@/lib/formatters';
```

Remove the `article()` helper function (no longer used). Keep `formatRelativeDate()` — it's still useful for compact cards later.

**Step 3: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Errors in `useMemberDashboard.ts` and `MemberSummaryCard.tsx` (they expect `string`, now get `MemberSummaryResult`). This is expected — we fix those in Tasks 2 and 3.

**Step 4: Commit**

```bash
git add frontend/src/lib/memberSummary.ts
git commit -m "[frontend] Restructure summary engine to return MemberSummaryResult"
```

---

## Task 2: Update Summary Tests

**Files:**
- Modify: `frontend/src/lib/__tests__/memberSummary.test.ts`

**Step 1: Rewrite tests for structured output**

Replace the entire test file. Tests now assert on `context` and `attentionItems` instead of a flat string.

```typescript
import { describe, it, expect } from 'vitest';
import { generateMemberSummary, type MemberSummaryInput } from '@/lib/memberSummary';
import type { Member } from '@/types/Member';

const baseMember: Member = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  dob: '1963-02-15',
  marital_status: 'M',
  hire_date: '1998-06-15',
  status_code: 'A',
  tier_code: 1,
  dept_name: 'Public Works',
  pos_title: 'Maintenance Supervisor',
};

function makeInput(overrides: Partial<MemberSummaryInput> = {}): MemberSummaryInput {
  return {
    member: baseMember,
    activeCases: [],
    openCommitments: [],
    recentInteractionCount: 0,
    correspondenceCount: 0,
    dataQualityIssueCount: 0,
    ...overrides,
  };
}

describe('generateMemberSummary', () => {
  describe('context line', () => {
    it('includes member name and tier', () => {
      const result = generateMemberSummary(makeInput());
      expect(result.context).toContain('Robert Martinez');
      expect(result.context).toContain('Tier 1');
    });

    it('includes service years when available', () => {
      const result = generateMemberSummary(makeInput({
        serviceCredit: {
          member_id: 10001, earned_years: 27.5, purchased_years: 0,
          military_years: 0, leave_years: 0, total_years: 27.5,
          eligibility_years: 27.5, benefit_years: 27.5,
        },
      }));
      expect(result.context).toContain('27 yr 6 mo');
    });

    it('includes eligibility with no reduction', () => {
      const result = generateMemberSummary(makeInput({
        eligibility: {
          member_id: 10001, retirement_date: '2026-04-01',
          age_at_retirement: { years: 63, months: 1, completed_years: 63, decimal: 63.12 },
          tier: 1, tier_source: 'hire_date', vested: true,
          service_credit: { earned_years: 27.5, purchased_years: 0, military_years: 0, total_years: 27.5, eligibility_years: 27.5, benefit_years: 27.5 },
          evaluations: [], best_eligible_type: 'RULE_OF_75',
          rule_of_n_sum: 90.5, reduction_pct: 0, reduction_factor: 1.0,
        },
      }));
      expect(result.context).toContain('Rule of 75');
      expect(result.context).toContain('no reduction');
    });

    it('includes early retirement with reduction', () => {
      const result = generateMemberSummary(makeInput({
        eligibility: {
          member_id: 10002, retirement_date: '2026-05-01',
          age_at_retirement: { years: 55, months: 3, completed_years: 55, decimal: 55.25 },
          tier: 2, tier_source: 'hire_date', vested: true,
          service_credit: { earned_years: 18, purchased_years: 3, military_years: 0, total_years: 21, eligibility_years: 18, benefit_years: 21 },
          evaluations: [], best_eligible_type: 'EARLY',
          rule_of_n_sum: 73.25, reduction_pct: 30, reduction_factor: 0.7,
        },
      }));
      expect(result.context).toContain('Early Retirement');
      expect(result.context).toContain('30%');
    });

    it('shows not vested status', () => {
      const result = generateMemberSummary(makeInput({
        eligibility: {
          member_id: 10001, retirement_date: '2026-04-01',
          age_at_retirement: { years: 30, months: 0, completed_years: 30, decimal: 30.0 },
          tier: 3, tier_source: 'hire_date', vested: false,
          service_credit: { earned_years: 3, purchased_years: 0, military_years: 0, total_years: 3, eligibility_years: 3, benefit_years: 3 },
          evaluations: [], best_eligible_type: 'NONE',
          rule_of_n_sum: 33.0, reduction_pct: 0, reduction_factor: 0,
        },
      }));
      expect(result.context).toContain('not yet vested');
    });

    it('includes single active case stage', () => {
      const result = generateMemberSummary(makeInput({
        activeCases: [{ caseId: 'RET-2026-0147', stage: 'Benefit Calculation', priority: 'standard', daysOpen: 5 }],
      }));
      expect(result.context).toContain('case at Benefit Calculation');
    });

    it('summarizes multiple active cases', () => {
      const result = generateMemberSummary(makeInput({
        activeCases: [
          { caseId: 'RET-1', stage: 'Stage 1', priority: 'standard', daysOpen: 5 },
          { caseId: 'DRO-1', stage: 'Stage 2', priority: 'urgent', daysOpen: 18 },
        ],
      }));
      expect(result.context).toContain('2 active cases');
    });
  });

  describe('attention items', () => {
    it('flags overdue commitments as critical', () => {
      const result = generateMemberSummary(makeInput({
        openCommitments: [{
          commitmentId: 'c1', interactionId: 'i1', description: 'Send estimate',
          targetDate: '2026-02-01', ownerAgent: 'Sarah', status: 'overdue',
          createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
        } as any],
      }));
      const critical = result.attentionItems.filter((i) => i.severity === 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].label).toBe('Overdue commitment');
      expect(critical[0].detail).toContain('Send estimate');
      expect(critical[0].detail).toContain('Sarah');
    });

    it('flags urgent cases as high', () => {
      const result = generateMemberSummary(makeInput({
        activeCases: [{ caseId: 'DRO-2026-0031', stage: 'Marital Share', priority: 'urgent', daysOpen: 18 }],
      }));
      const high = result.attentionItems.filter((i) => i.severity === 'high' && i.label === 'Urgent case');
      expect(high).toHaveLength(1);
      expect(high[0].detail).toContain('DRO-2026-0031');
    });

    it('flags missing beneficiaries as high', () => {
      const result = generateMemberSummary(makeInput({ beneficiaries: [] }));
      const high = result.attentionItems.filter((i) => i.severity === 'high' && i.label === 'No beneficiaries');
      expect(high).toHaveLength(1);
    });

    it('flags DQ issues as medium', () => {
      const result = generateMemberSummary(makeInput({ dataQualityIssueCount: 3 }));
      const medium = result.attentionItems.filter((i) => i.severity === 'medium' && i.label === 'Data quality');
      expect(medium).toHaveLength(1);
      expect(medium[0].detail).toContain('3 issues');
    });

    it('includes info items for positive confirmations', () => {
      const result = generateMemberSummary(makeInput({
        beneficiaries: [{ bene_id: 1, first_name: 'Jane', last_name: 'M', bene_type: 'PRIMARY', alloc_pct: 100, relationship: 'Spouse' } as any],
        dataQualityIssueCount: 0,
      }));
      const info = result.attentionItems.filter((i) => i.severity === 'info');
      expect(info.length).toBeGreaterThanOrEqual(2);
      expect(info.some((i) => i.label === 'Beneficiaries')).toBe(true);
      expect(info.some((i) => i.label === 'Data quality' && i.detail.includes('No issues'))).toBe(true);
    });

    it('handles minimal data without errors', () => {
      const result = generateMemberSummary(makeInput());
      expect(result.context).toBeTruthy();
      expect(result.context).not.toContain('undefined');
      expect(result.context).not.toContain('NaN');
      expect(result.attentionItems).toBeDefined();
    });
  });
});
```

**Step 2: Run the tests to verify they fail (implementation not yet wired)**

Run: `cd frontend && npx vitest run src/lib/__tests__/memberSummary.test.ts`
Expected: Tests fail because `generateMemberSummary` still returns `string` or the new implementation has type mismatches with old tests. If Task 1 implementation is already applied, tests should pass.

**Step 3: Commit**

```bash
git add frontend/src/lib/__tests__/memberSummary.test.ts
git commit -m "[frontend] Update summary tests for MemberSummaryResult structure"
```

---

## Task 3: Update MemberSummaryCard for Structured Output

**Files:**
- Modify: `frontend/src/components/dashboard/MemberSummaryCard.tsx`

**Step 1: Rewrite MemberSummaryCard to render structured summary**

```tsx
import type { MemberSummaryResult, AttentionSeverity } from '@/lib/memberSummary';

interface MemberSummaryCardProps {
  summary: MemberSummaryResult | null;
  isLoading: boolean;
}

const SEVERITY_STYLES: Record<AttentionSeverity, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-700' },
  high: { dot: 'bg-amber-500', text: 'text-amber-700' },
  medium: { dot: 'bg-blue-500', text: 'text-blue-600' },
  info: { dot: 'bg-gray-300', text: 'text-gray-500' },
};

export default function MemberSummaryCard({ summary, isLoading }: MemberSummaryCardProps) {
  const actionItems = summary?.attentionItems.filter((i) => i.severity !== 'info') ?? [];
  const infoItems = summary?.attentionItems.filter((i) => i.severity === 'info') ?? [];
  const hasActions = actionItems.length > 0;

  return (
    <div className="rounded-lg border border-iw-sage/20 bg-gradient-to-r from-iw-sageLight/30 to-white shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-iw-sage">Member Summary</h3>
          <span className="text-[10px] font-medium text-iw-sage/60 bg-iw-sage/10 px-2 py-0.5 rounded-full">
            AI-generated
          </span>
        </div>

        {isLoading ? (
          <div className="h-12 flex items-center text-sm text-gray-400">Generating summary...</div>
        ) : summary ? (
          <div>
            {/* Context line */}
            <p className="text-sm text-gray-700 leading-relaxed">{summary.context}</p>

            {/* Action items */}
            {hasActions && (
              <div className="mt-3 pt-3 border-t border-iw-sage/10">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Needs attention
                </span>
                <ul className="mt-1.5 space-y-1">
                  {actionItems.map((item, idx) => {
                    const style = SEVERITY_STYLES[item.severity];
                    return (
                      <li key={idx} className="flex items-start gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className={`text-sm ${style.text}`}>
                          <span className="font-medium">{item.label}:</span> {item.detail}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Info items (collapsed inline) */}
            {infoItems.length > 0 && (
              <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 ${hasActions ? 'mt-2' : 'mt-3 pt-3 border-t border-iw-sage/10'}`}>
                {infoItems.map((item, idx) => (
                  <span key={idx}>{item.detail}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No member data available to summarize.</p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update useMemberDashboard to pass MemberSummaryResult**

In `frontend/src/hooks/useMemberDashboard.ts`, the `summary` variable currently returns a `string`. Change the `useMemo` to return `MemberSummaryResult | null`:

```typescript
// Line 54-84: Replace the summary useMemo
const summary = useMemo(() => {
  if (!member.data) return null;

  const openCommitments = (commitments.data ?? []).filter(
    (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
  );

  const entries = timeline.data?.timelineEntries ?? [];
  const lastEntry = entries.length > 0 ? entries[0] : undefined;

  return generateMemberSummary({
    member: member.data,
    serviceCredit: serviceCredit.data?.summary,
    beneficiaries: beneficiaries.data,
    activeCases: activeCaseItems,
    openCommitments,
    recentInteractionCount: entries.length,
    lastInteractionDate: lastEntry?.startedAt,
    correspondenceCount: correspondence.length,
    dataQualityIssueCount: memberDQIssues.data.length,
  });
}, [
  member.data,
  serviceCredit.data,
  beneficiaries.data,
  activeCaseItems,
  commitments.data,
  timeline.data,
  correspondence.length,
  memberDQIssues.data.length,
]);
```

Note: The return value changes from `string` to `MemberSummaryResult | null`. Also update the import to include the type:

```typescript
import { generateMemberSummary, type ActiveCaseItem, type MemberSummaryResult } from '@/lib/memberSummary';
```

**Step 3: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean — no errors.

**Step 4: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass. Some existing MemberSummaryCard tests may need updating if they assert on `summary` as a string prop.

**Step 5: Commit**

```bash
git add frontend/src/components/dashboard/MemberSummaryCard.tsx frontend/src/hooks/useMemberDashboard.ts
git commit -m "[frontend] Wire structured MemberSummaryResult to card and hook"
```

---

## Task 4: Create ReferenceCard Component

**Files:**
- Create: `frontend/src/components/dashboard/ReferenceCard.tsx`

**Step 1: Build the generic compact reference card**

```tsx
import type { ReactNode } from 'react';

interface ReferenceCardProps {
  title: string;
  count?: number | string;
  preview?: string;
  highlight?: boolean;     // amber border for issues
  isLoading?: boolean;
  onViewAll?: () => void;
  children?: ReactNode;    // optional custom content instead of preview
}

export default function ReferenceCard({
  title,
  count,
  preview,
  highlight,
  isLoading,
  onViewAll,
  children,
}: ReferenceCardProps) {
  return (
    <div
      className={`rounded-lg border shadow-sm overflow-hidden ${
        highlight ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-1">
          <h4 className={`text-xs font-semibold ${highlight ? 'text-amber-800' : 'text-gray-700'}`}>
            {title}
          </h4>
          {count !== undefined && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              highlight ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {count}
            </span>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <p className="text-xs text-gray-400">Loading...</p>
        ) : children ? (
          children
        ) : preview ? (
          <p className="text-xs text-gray-500 line-clamp-1">{preview}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">None on file</p>
        )}
      </div>

      {/* View all trigger */}
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full border-t border-gray-100 px-4 py-2 text-[11px] font-medium text-iw-sage hover:bg-gray-50 transition-colors text-left"
        >
          View all →
        </button>
      )}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/ReferenceCard.tsx
git commit -m "[frontend] Add ReferenceCard component for compact sidebar cards"
```

---

## Task 5: Restructure MemberDashboard Layout

**Files:**
- Modify: `frontend/src/components/dashboard/MemberDashboard.tsx`

**Step 1: Rewrite the main content grid**

Replace the `{member && (<>...`)}` block (lines 108-168) with the new layout. The key changes:
- ActiveWorkCard takes full left 2/3 (no longer shares column with interactions/correspondence)
- Right 1/3 becomes ReferenceCard sidebar with compact versions of all historical/reference cards
- Import ReferenceCard and formatters needed for preview strings

New imports to add:
```typescript
import ReferenceCard from '@/components/dashboard/ReferenceCard';
import { formatServiceYears } from '@/lib/formatters';
```

New layout (replace lines 108-168):

```tsx
{member && (
  <>
    {/* Row 1: Member Banner */}
    <MemberBanner member={member} />

    {/* Row 2: AI Summary */}
    <MemberSummaryCard summary={summary} isLoading={isLoading} />

    {/* Row 3: Action zone (2/3) + Reference sidebar (1/3) */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column — active work */}
      <div className="lg:col-span-2">
        <ActiveWorkCard
          activeCases={activeCases}
          commitments={commitments ?? []}
          onOpenCase={onOpenCase}
        />
      </div>

      {/* Right column — compact reference cards */}
      <div className="space-y-3">
        {/* Interactions */}
        <ReferenceCard
          title="Interactions"
          count={timeline?.totalEntries ?? 0}
          preview={
            timeline?.timelineEntries?.[0]
              ? `Last: ${timeline.timelineEntries[0].channel.replace(/_/g, ' ')} · ${new Date(timeline.timelineEntries[0].startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : undefined
          }
          isLoading={isLoadingSecondary}
          onViewAll={() => setSelectedInteraction(null)} // TODO: wire to drill-down overlay
        />

        {/* Correspondence */}
        <ReferenceCard
          title="Correspondence"
          count={correspondence.length}
          preview={
            correspondence[0]
              ? `${correspondence[0].subject} · ${new Date(correspondence[0].sentAt || correspondence[0].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : undefined
          }
        />

        {/* Service Credit */}
        <ReferenceCard
          title="Service Credit"
          count={serviceCredit ? formatServiceYears(serviceCredit.total_years) : undefined}
          isLoading={isLoadingSecondary}
        >
          {serviceCredit && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <div className="flex justify-between">
                <span>Earned</span>
                <span className="font-medium text-gray-700">{formatServiceYears(serviceCredit.earned_years)}</span>
              </div>
              {serviceCredit.purchased_years > 0 && (
                <div className="flex justify-between">
                  <span>Purchased</span>
                  <span className="font-medium text-gray-700">{formatServiceYears(serviceCredit.purchased_years)}</span>
                </div>
              )}
            </div>
          )}
        </ReferenceCard>

        {/* Beneficiaries */}
        <ReferenceCard
          title="Beneficiaries"
          count={beneficiaries?.filter((b) => !b.end_date).length ?? 0}
          preview={
            beneficiaries && beneficiaries.filter((b) => !b.end_date).length > 0
              ? beneficiaries.filter((b) => !b.end_date).map((b) => `${b.first_name} ${b.last_name} (${b.alloc_pct}%)`).join(', ')
              : undefined
          }
          highlight={beneficiaries !== undefined && beneficiaries.filter((b) => !b.end_date).length === 0}
          isLoading={isLoadingSecondary}
        />

        {/* Data Quality */}
        <ReferenceCard
          title="Data Quality"
          count={dqIssues.length > 0 ? `${dqIssues.length} issue${dqIssues.length > 1 ? 's' : ''}` : dqScore ? `${dqScore.overallScore.toFixed(0)}%` : undefined}
          highlight={dqIssues.filter((i) => i.status === 'open').length > 0}
          isLoading={isLoadingSecondary}
        >
          {dqIssues.filter((i) => i.status === 'open').length > 0 && (
            <p className="text-xs text-amber-600">
              {dqIssues.filter((i) => i.status === 'open')[0].description}
            </p>
          )}
        </ReferenceCard>
      </div>
    </div>

    {/* Footer */}
    <footer className="rounded-lg bg-gray-100 px-6 py-4 text-center text-xs text-gray-500">
      <p className="font-medium">Member Dashboard</p>
      <p>
        Aggregated view across data access, CRM, intelligence, correspondence, and data
        quality services.
      </p>
    </footer>
  </>
)}
```

Remove imports that are no longer used in this file:
- `InteractionHistoryCard` and `InteractionRowClickData`
- `InteractionDetailPanel`
- `CorrespondenceHistoryCard`
- `ServiceCreditCard`
- `BeneficiaryCard`
- `DataQualityCard`

Also remove the `selectedInteraction` state and the `InteractionDetailPanel` overlay at the bottom (lines 162-169), since those full cards are no longer rendered here. The interaction drill-down will be wired in a future task when the "View all" buttons connect to overlays.

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All pass. Some MemberDashboard tests may need updating if they assert on the presence of InteractionHistoryCard, etc.

**Step 4: Commit**

```bash
git add frontend/src/components/dashboard/MemberDashboard.tsx
git commit -m "[frontend] Restructure dashboard: action zone + reference sidebar"
```

---

## Task 6: Summary Log — Database Migration

**Files:**
- Create: `domains/pension/schema/010_summary_log.sql`

**Step 1: Write the migration**

```sql
-- 010: Member summary log for AI training corpus
-- Stores deterministic summary outputs alongside their inputs
-- for future LLM few-shot prompting and validation.

CREATE TABLE IF NOT EXISTS member_summary_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       INTEGER NOT NULL,
    input_hash      TEXT NOT NULL,
    input_json      JSONB NOT NULL,
    output_json     JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_summary_log_member ON member_summary_log(member_id);
CREATE INDEX idx_summary_log_hash ON member_summary_log(input_hash);
```

**Step 2: Commit**

```bash
git add domains/pension/schema/010_summary_log.sql
git commit -m "[schema] Add member_summary_log table for AI training corpus"
```

---

## Task 7: Summary Log — Intelligence Service Endpoint

**Files:**
- Modify: `platform/intelligence/api/handlers.go`

**Step 1: Add the summary-log endpoint**

Add the route to `RegisterRoutes` (after line 41):
```go
mux.HandleFunc("POST /api/v1/summary-log", h.LogSummary)
```

Add the handler function:

```go
// LogSummary stores a deterministic summary for future LLM training.
// Fire-and-forget from the frontend — deduplicates by input_hash per member.
func (h *Handler) LogSummary(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MemberID  int             `json:"memberId"`
		InputHash string          `json:"inputHash"`
		Input     json.RawMessage `json:"input"`
		Output    json.RawMessage `json:"output"`
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB limit
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if req.MemberID == 0 || req.InputHash == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "memberId and inputHash required"})
		return
	}

	// For now, log to stdout — DB insert will be wired when intelligence gets a DB connection
	log.Printf("summary-log: member=%d hash=%s", req.MemberID, req.InputHash[:min(16, len(req.InputHash))])

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})
}
```

Note: The intelligence service is currently stateless (no DB connection). This endpoint accepts and acknowledges the log entry. The DB insert will be wired when intelligence gets a DB connection — or we can proxy this to the dataaccess service. For now, stdout logging provides the dedup-ready interface.

**Step 2: Build and test**

Run: `cd platform/intelligence && go build ./... && go vet ./...`
Expected: Clean build.

**Step 3: Commit**

```bash
git add platform/intelligence/api/handlers.go
git commit -m "[intelligence] Add summary-log endpoint for AI training corpus"
```

---

## Task 8: Summary Log — Frontend Fire-and-Forget POST

**Files:**
- Modify: `frontend/src/hooks/useMemberDashboard.ts`

**Step 1: Add the summary log side effect**

Add a `useEffect` after the summary `useMemo` that fires the log POST when summary changes:

```typescript
import { useMemo, useEffect } from 'react';
```

After the summary `useMemo` block, add:

```typescript
// ─── Summary log (fire-and-forget for AI training corpus) ──────────────
useEffect(() => {
  if (!summary || !member.data) return;

  const input = {
    member: member.data,
    serviceCredit: serviceCredit.data?.summary,
    beneficiaries: beneficiaries.data,
    activeCases: activeCaseItems,
    openCommitments: (commitments.data ?? []).filter(
      (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
    ),
    recentInteractionCount: timeline.data?.timelineEntries?.length ?? 0,
    lastInteractionDate: timeline.data?.timelineEntries?.[0]?.startedAt,
    correspondenceCount: correspondence.length,
    dataQualityIssueCount: memberDQIssues.data.length,
  };

  const inputStr = JSON.stringify(input);

  // Simple hash — not crypto, just dedup
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    hash = ((hash << 5) - hash + inputStr.charCodeAt(i)) | 0;
  }
  const inputHash = hash.toString(36);

  fetch('/api/v1/summary-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memberId: member.data.member_id,
      inputHash,
      input,
      output: summary,
    }),
  }).catch(() => {}); // fire-and-forget
}, [summary, member.data?.member_id]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All pass (the fetch is fire-and-forget, no impact on rendering).

**Step 4: Commit**

```bash
git add frontend/src/hooks/useMemberDashboard.ts
git commit -m "[frontend] Add fire-and-forget summary log POST to useMemberDashboard"
```

---

## Task 9: Update Existing Dashboard Tests

**Files:**
- Modify: any test files in `frontend/src/components/dashboard/__tests__/` that reference MemberSummaryCard with a string `summary` prop or test for InteractionHistoryCard presence in MemberDashboard.

**Step 1: Find and update affected tests**

Search for test files that render `MemberSummaryCard` or `MemberDashboard`:

```bash
cd frontend && grep -rl "MemberSummaryCard\|MemberDashboard" src/components/dashboard/__tests__/
```

Update any `summary="some string"` props to `summary={{ context: 'some string', attentionItems: [] }}`.

Update any assertions that check for `InteractionHistoryCard`, `CorrespondenceHistoryCard`, `ServiceCreditCard`, `BeneficiaryCard`, or `DataQualityCard` in the MemberDashboard to check for `ReferenceCard` titles instead (e.g., `getByText('Interactions')`).

**Step 2: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All pass.

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/__tests__/
git commit -m "[frontend] Update dashboard tests for structured summary and new layout"
```

---

## Task 10: Visual Verification

**Step 1: Start dev server**

Use preview tools to start the frontend dev server and verify the new layout.

**Step 2: Navigate to a member dashboard**

Load Robert Martinez (member 10001) in the Staff Portal → Member Dashboard.

**Step 3: Verify**

Check:
- [ ] Summary card shows context line (name, tenure, eligibility, case stage)
- [ ] Attention items appear with severity dots (red for overdue, amber for urgent, etc.)
- [ ] Info items appear as inline gray text below
- [ ] ActiveWorkCard takes full left 2/3
- [ ] Right 1/3 shows compact ReferenceCards for Interactions, Correspondence, Service Credit, Beneficiaries, Data Quality
- [ ] Each ReferenceCard shows count + preview + "View all →" where applicable
- [ ] No console errors

**Step 4: Take screenshot as proof**

**Step 5: Final commit**

```bash
git add -A
git commit -m "[frontend] Member dashboard enhancement: structured summary + action-first layout"
```
