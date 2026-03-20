# Rules Explorer Three-Level Card Drill-Down — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat-list Rules Explorer with a visually appealing card-based drill-down: Domain Cards → Rule Cards → Rule Detail.

**Architecture:** Three-level state machine in `RulesExplorer.tsx`. Level 1 shows domain cards with progress rings. Level 2 shows rule cards for a selected domain. Level 3 reuses the existing `RuleDetail` component with breadcrumb navigation. A static domain mapping object maps rule IDs to 9 semantic categories.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest + Testing Library, SVG for progress ring.

**Design Doc:** `docs/plans/2026-03-20-rules-explorer-redesign-design.md`

---

### Task 1: Domain Mapping — Static Rule-to-Domain Map

**Files:**
- Create: `frontend/src/lib/domainMapping.ts`
- Test: `frontend/src/lib/__tests__/domainMapping.test.ts`

The YAML rule files use flat `domain` fields like `"eligibility"`, `"benefit-calculation"`, etc. We need a richer mapping that groups rules into 9 user-facing categories with display names. The YAML `domain` field is the source of truth for grouping — we map YAML domain slugs to display categories.

**Step 1: Write the failing test**

```typescript
// frontend/src/lib/__tests__/domainMapping.test.ts
import { describe, it, expect } from 'vitest';
import { getDomainForRule, DOMAIN_META, type DomainKey } from '../domainMapping';

describe('domainMapping', () => {
  it('maps eligibility rule IDs to Eligibility domain', () => {
    expect(getDomainForRule('RULE-VESTING')).toBe('eligibility');
    expect(getDomainForRule('RULE-NORMAL-RET')).toBe('eligibility');
    expect(getDomainForRule('RULE-RULE-OF-75')).toBe('eligibility');
  });

  it('maps benefit-calculation IDs to Benefits domain', () => {
    expect(getDomainForRule('RULE-BENEFIT-T1')).toBe('benefits');
    expect(getDomainForRule('RULE-BENEFIT-T2')).toBe('benefits');
    expect(getDomainForRule('RULE-ROUNDING')).toBe('benefits');
  });

  it('maps salary/AMS IDs to Salary & AMS domain', () => {
    expect(getDomainForRule('RULE-AMS-WINDOW')).toBe('salary-ams');
    expect(getDomainForRule('RULE-AMS-CALC')).toBe('salary-ams');
    expect(getDomainForRule('RULE-LEAVE-PAYOUT')).toBe('salary-ams');
    expect(getDomainForRule('RULE-FURLOUGH')).toBe('salary-ams');
  });

  it('maps service credit IDs correctly', () => {
    expect(getDomainForRule('RULE-SVC-EARNED')).toBe('service-credit');
    expect(getDomainForRule('RULE-SVC-PURCHASED')).toBe('service-credit');
  });

  it('maps payment option IDs correctly', () => {
    expect(getDomainForRule('RULE-PAY-MAXIMUM')).toBe('payment-options');
    expect(getDomainForRule('RULE-JS-100')).toBe('payment-options');
    expect(getDomainForRule('RULE-SPOUSAL-CONSENT')).toBe('payment-options');
  });

  it('maps DRO IDs correctly', () => {
    expect(getDomainForRule('RULE-DRO-MARITAL-SHARE')).toBe('dro');
    expect(getDomainForRule('RULE-DRO-COLA')).toBe('dro');
  });

  it('maps tier/contribution IDs correctly', () => {
    expect(getDomainForRule('RULE-TIER-1')).toBe('tiers-contributions');
    expect(getDomainForRule('RULE-CONTRIB-EE')).toBe('tiers-contributions');
  });

  it('maps death benefit IDs correctly', () => {
    expect(getDomainForRule('RULE-DEATH-NORMAL')).toBe('death-benefits');
    expect(getDomainForRule('RULE-DEATH-EARLY-T12')).toBe('death-benefits');
  });

  it('maps process IDs correctly', () => {
    expect(getDomainForRule('RULE-APP-DEADLINE')).toBe('process-compliance');
    expect(getDomainForRule('RULE-IRREVOCABILITY')).toBe('process-compliance');
    expect(getDomainForRule('RULE-COLA')).toBe('process-compliance');
  });

  it('returns "general" for unknown rule IDs', () => {
    expect(getDomainForRule('RULE-UNKNOWN-999')).toBe('general');
  });

  it('DOMAIN_META has display names for all domains', () => {
    const keys: DomainKey[] = [
      'eligibility', 'benefits', 'salary-ams', 'service-credit',
      'payment-options', 'dro', 'tiers-contributions', 'death-benefits',
      'process-compliance',
    ];
    for (const key of keys) {
      expect(DOMAIN_META[key]).toBeDefined();
      expect(DOMAIN_META[key].label).toBeTruthy();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/__tests__/domainMapping.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// frontend/src/lib/domainMapping.ts
export type DomainKey =
  | 'eligibility'
  | 'benefits'
  | 'salary-ams'
  | 'service-credit'
  | 'payment-options'
  | 'dro'
  | 'tiers-contributions'
  | 'death-benefits'
  | 'process-compliance'
  | 'general';

export interface DomainMeta {
  label: string;
  description: string;
}

export const DOMAIN_META: Record<DomainKey, DomainMeta> = {
  eligibility: { label: 'Eligibility', description: 'Vesting, retirement age, Rule of 75/85, early and deferred retirement' },
  benefits: { label: 'Benefits', description: 'Tier benefit formulas, reduction factors, rounding, COLA adjustments' },
  'salary-ams': { label: 'Salary & AMS', description: 'Average Monthly Salary window, calculation, leave payout, furlough' },
  'service-credit': { label: 'Service Credit', description: 'Earned, purchased, and separation service credit rules' },
  'payment-options': { label: 'Payment Options', description: 'Maximum, joint & survivor, default options, spousal consent' },
  dro: { label: 'DRO', description: 'Domestic Relations Orders — marital share, methods, exclusions' },
  'tiers-contributions': { label: 'Tiers & Contributions', description: 'Tier classification, employee and employer contribution rates' },
  'death-benefits': { label: 'Death Benefits', description: 'Normal and early death benefits, election, reemployment' },
  'process-compliance': { label: 'Process & Compliance', description: 'Application deadlines, notarization, payment cutoff, irrevocability' },
  general: { label: 'General', description: 'Uncategorized rules' },
};

const RULE_TO_DOMAIN: Record<string, DomainKey> = {
  // Eligibility (from eligibility.yaml)
  'RULE-VESTING': 'eligibility',
  'RULE-NORMAL-RET': 'eligibility',
  'RULE-RULE-OF-75': 'eligibility',
  'RULE-RULE-OF-85': 'eligibility',
  'RULE-EARLY-RET-T12': 'eligibility',
  'RULE-EARLY-RET-T3': 'eligibility',
  'RULE-EARLY-REDUCE-T12': 'eligibility',
  'RULE-EARLY-REDUCE-T3': 'eligibility',
  'RULE-DEFERRED': 'eligibility',
  'RULE-ELIG-HIERARCHY': 'eligibility',

  // Benefits (benefit formulas from benefit-calculation.yaml)
  'RULE-BENEFIT-T1': 'benefits',
  'RULE-BENEFIT-T2': 'benefits',
  'RULE-BENEFIT-T3': 'benefits',
  'RULE-REDUCTION-APPLY': 'benefits',
  'RULE-ROUNDING': 'benefits',

  // Salary & AMS (salary rules from benefit-calculation.yaml)
  'RULE-AMS-WINDOW': 'salary-ams',
  'RULE-AMS-CALC': 'salary-ams',
  'RULE-LEAVE-PAYOUT': 'salary-ams',
  'RULE-FURLOUGH': 'salary-ams',

  // Service Credit (from service-credit.yaml)
  'RULE-SVC-EARNED': 'service-credit',
  'RULE-SVC-PURCHASED': 'service-credit',
  'RULE-SVC-SEPARATION': 'service-credit',

  // Payment Options (from payment-options.yaml)
  'RULE-PAY-MAXIMUM': 'payment-options',
  'RULE-JS-100': 'payment-options',
  'RULE-JS-75': 'payment-options',
  'RULE-JS-50': 'payment-options',
  'RULE-JS-DEFAULT': 'payment-options',
  'RULE-SPOUSAL-CONSENT': 'payment-options',
  'RULE-BENEFICIARY-PREDECEASE': 'payment-options',

  // DRO (from dro.yaml)
  'RULE-DRO-MARITAL-SHARE': 'dro',
  'RULE-DRO-SEQUENCE': 'dro',
  'RULE-DRO-METHODS': 'dro',
  'RULE-DRO-NO-IPR': 'dro',
  'RULE-DRO-NO-HEALTH': 'dro',
  'RULE-DRO-COLA': 'dro',

  // Tiers & Contributions (from membership.yaml)
  'RULE-TIER-1': 'tiers-contributions',
  'RULE-TIER-2': 'tiers-contributions',
  'RULE-TIER-3': 'tiers-contributions',
  'RULE-CONTRIB-EE': 'tiers-contributions',
  'RULE-CONTRIB-ER': 'tiers-contributions',

  // Death Benefits (from supplemental.yaml)
  'RULE-DEATH-NORMAL': 'death-benefits',
  'RULE-DEATH-EARLY-T12': 'death-benefits',
  'RULE-DEATH-EARLY-T3': 'death-benefits',
  'RULE-DEATH-ELECTION': 'death-benefits',
  'RULE-DEATH-REEMPLOY': 'death-benefits',

  // Process & Compliance (from process.yaml)
  'RULE-APP-DEADLINE': 'process-compliance',
  'RULE-NOTARIZATION': 'process-compliance',
  'RULE-PAYMENT-CUTOFF': 'process-compliance',
  'RULE-EFFECTIVE-DATE': 'process-compliance',
  'RULE-IRREVOCABILITY': 'process-compliance',
  'RULE-COLA': 'process-compliance',

  // Supplemental (IPR → service-credit)
  'RULE-IPR': 'service-credit',
};

export function getDomainForRule(ruleId: string): DomainKey {
  return RULE_TO_DOMAIN[ruleId] ?? 'general';
}

export const ALL_DOMAINS: DomainKey[] = [
  'eligibility', 'benefits', 'salary-ams', 'service-credit',
  'payment-options', 'dro', 'tiers-contributions', 'death-benefits',
  'process-compliance',
];
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/__tests__/domainMapping.test.ts`
Expected: PASS — all assertions green

**Step 5: Commit**

```bash
git add frontend/src/lib/domainMapping.ts frontend/src/lib/__tests__/domainMapping.test.ts
git commit -m "[frontend] Add domain mapping for Rules Explorer card drill-down"
```

---

### Task 2: ProgressRing Component

**Files:**
- Create: `frontend/src/components/rules/ProgressRing.tsx`
- Test: `frontend/src/components/rules/__tests__/ProgressRing.test.tsx`

Small SVG circular progress indicator (32-40px). Green fill for passing percentage, gray remainder. Used on Level 1 domain cards.

**Step 1: Write the failing test**

```tsx
// frontend/src/components/rules/__tests__/ProgressRing.test.tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ProgressRing from '../ProgressRing';

describe('ProgressRing', () => {
  it('renders an SVG element', () => {
    const { container } = renderWithProviders(<ProgressRing passing={3} total={10} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows percentage text', () => {
    renderWithProviders(<ProgressRing passing={7} total={10} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('handles zero total gracefully', () => {
    renderWithProviders(<ProgressRing passing={0} total={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% when all passing', () => {
    renderWithProviders(<ProgressRing passing={5} total={5} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/ProgressRing.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/rules/ProgressRing.tsx
interface ProgressRingProps {
  passing: number;
  total: number;
  size?: number;
}

export default function ProgressRing({ passing, total, size = 36 }: ProgressRingProps) {
  const pct = total > 0 ? Math.round((passing / total) * 100) : 0;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={pct === 100 ? 'text-green-500' : pct > 0 ? 'text-green-400' : 'text-gray-300'}
        />
      </svg>
      <span className="absolute text-[8px] font-semibold text-gray-600">{pct}%</span>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/ProgressRing.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/rules/ProgressRing.tsx frontend/src/components/rules/__tests__/ProgressRing.test.tsx
git commit -m "[frontend] Add ProgressRing SVG component for domain cards"
```

---

### Task 3: Breadcrumb Component

**Files:**
- Create: `frontend/src/components/rules/Breadcrumb.tsx`
- Test: `frontend/src/components/rules/__tests__/Breadcrumb.test.tsx`

Simple clickable text breadcrumb with ">" separators. Each segment is clickable to navigate to that level.

**Step 1: Write the failing test**

```tsx
// frontend/src/components/rules/__tests__/Breadcrumb.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import Breadcrumb from '../Breadcrumb';

describe('Breadcrumb', () => {
  it('renders all segments', () => {
    renderWithProviders(
      <Breadcrumb
        segments={[
          { label: 'Rules Explorer', onClick: vi.fn() },
          { label: 'Eligibility', onClick: vi.fn() },
          { label: 'RULE-VESTING' },
        ]}
      />,
    );
    expect(screen.getByText('Rules Explorer')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('RULE-VESTING')).toBeInTheDocument();
  });

  it('renders clickable segments as buttons', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Breadcrumb
        segments={[
          { label: 'Rules Explorer', onClick },
          { label: 'Eligibility' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Rules Explorer'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders final segment as plain text (not clickable)', () => {
    renderWithProviders(
      <Breadcrumb
        segments={[
          { label: 'Rules Explorer', onClick: vi.fn() },
          { label: 'Eligibility' },
        ]}
      />,
    );
    // Final segment should not be a button
    const final = screen.getByText('Eligibility');
    expect(final.tagName).not.toBe('BUTTON');
  });

  it('renders separator between segments', () => {
    const { container } = renderWithProviders(
      <Breadcrumb
        segments={[
          { label: 'Rules Explorer', onClick: vi.fn() },
          { label: 'Eligibility' },
        ]}
      />,
    );
    // Check for the > separator character
    expect(container.textContent).toContain('>');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/Breadcrumb.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/rules/Breadcrumb.tsx
export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export default function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {segments.map((segment, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <span className="text-gray-400">{'>'}</span>}
            {segment.onClick && !isLast ? (
              <button
                onClick={segment.onClick}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                {segment.label}
              </button>
            ) : (
              <span className={isLast ? 'font-medium text-gray-900' : 'text-gray-500'}>
                {segment.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/Breadcrumb.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/rules/Breadcrumb.tsx frontend/src/components/rules/__tests__/Breadcrumb.test.tsx
git commit -m "[frontend] Add Breadcrumb navigation component for Rules Explorer"
```

---

### Task 4: DomainCard Component (Level 1 Card)

**Files:**
- Create: `frontend/src/components/rules/DomainCard.tsx`
- Test: `frontend/src/components/rules/__tests__/DomainCard.test.tsx`

Card showing domain name, rule count, progress ring. Matches CaseCard styling: white bg, rounded-lg, border, shadow-sm, hover transitions.

**Step 1: Write the failing test**

```tsx
// frontend/src/components/rules/__tests__/DomainCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DomainCard from '../DomainCard';

describe('DomainCard', () => {
  const defaultProps = {
    domainKey: 'eligibility' as const,
    label: 'Eligibility',
    description: 'Vesting, retirement age, Rule of 75/85',
    ruleCount: 10,
    passingRules: 7,
    onClick: vi.fn(),
  };

  it('renders domain label', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
  });

  it('renders rule count', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('10 rules')).toBeInTheDocument();
  });

  it('renders description', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('Vesting, retirement age, Rule of 75/85')).toBeInTheDocument();
  });

  it('renders progress ring with percentage', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    renderWithProviders(<DomainCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows singular "rule" for count of 1', () => {
    renderWithProviders(<DomainCard {...defaultProps} ruleCount={1} />);
    expect(screen.getByText('1 rule')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/DomainCard.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/rules/DomainCard.tsx
import ProgressRing from './ProgressRing';
import type { DomainKey } from '@/lib/domainMapping';

interface DomainCardProps {
  domainKey: DomainKey;
  label: string;
  description: string;
  ruleCount: number;
  passingRules: number;
  onClick: () => void;
}

export default function DomainCard({
  label,
  description,
  ruleCount,
  passingRules,
  onClick,
}: DomainCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md hover:border-iw-sage hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        <ProgressRing passing={passingRules} total={ruleCount} />
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <span className="text-xs text-gray-500">
        {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
      </span>
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/DomainCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/rules/DomainCard.tsx frontend/src/components/rules/__tests__/DomainCard.test.tsx
git commit -m "[frontend] Add DomainCard component for Level 1 domain grid"
```

---

### Task 5: DomainCardGrid Component (Level 1 Grid)

**Files:**
- Create: `frontend/src/components/rules/DomainCardGrid.tsx`
- Test: `frontend/src/components/rules/__tests__/DomainCardGrid.test.tsx`

Responsive grid matching CaseCardGrid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Receives enriched rules, groups them by domain, and renders DomainCards.

**Step 1: Write the failing test**

```tsx
// frontend/src/components/rules/__tests__/DomainCardGrid.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DomainCardGrid from '../DomainCardGrid';
import type { RuleDefinition } from '@/types/Rules';

function makeRule(id: string, overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id,
    name: `Rule ${id}`,
    domain: 'eligibility',
    description: 'Test rule',
    sourceReference: { document: 'RMC', section: '§1', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [],
    logic: { type: 'conditional', conditions: [] },
    output: [],
    dependencies: [],
    tags: [],
    testCases: [],
    governance: { status: 'approved', lastReviewed: '2026-01-01', reviewedBy: 'Committee', effectiveDate: '2026-01-01' },
    testStatus: { total: 3, passing: 3, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    ...overrides,
  };
}

describe('DomainCardGrid', () => {
  it('renders a card for each domain with rules', () => {
    const rules = [
      makeRule('RULE-VESTING'),
      makeRule('RULE-NORMAL-RET'),
      makeRule('RULE-BENEFIT-T1'),
    ];
    renderWithProviders(<DomainCardGrid rules={rules} onSelectDomain={vi.fn()} />);
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Benefits')).toBeInTheDocument();
  });

  it('calls onSelectDomain when a card is clicked', () => {
    const onSelectDomain = vi.fn();
    const rules = [makeRule('RULE-VESTING')];
    renderWithProviders(<DomainCardGrid rules={rules} onSelectDomain={onSelectDomain} />);
    fireEvent.click(screen.getByText('Eligibility'));
    expect(onSelectDomain).toHaveBeenCalledWith('eligibility');
  });

  it('shows empty state when no rules', () => {
    renderWithProviders(<DomainCardGrid rules={[]} onSelectDomain={vi.fn()} />);
    expect(screen.getByText('No rule domains available.')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/DomainCardGrid.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/rules/DomainCardGrid.tsx
import { useMemo } from 'react';
import type { RuleDefinition } from '@/types/Rules';
import { getDomainForRule, DOMAIN_META, ALL_DOMAINS, type DomainKey } from '@/lib/domainMapping';
import DomainCard from './DomainCard';

interface DomainCardGridProps {
  rules: RuleDefinition[];
  onSelectDomain: (domain: DomainKey) => void;
}

interface DomainSummary {
  key: DomainKey;
  label: string;
  description: string;
  ruleCount: number;
  passingRules: number;
}

export default function DomainCardGrid({ rules, onSelectDomain }: DomainCardGridProps) {
  const domains = useMemo(() => {
    // Group rules by domain
    const grouped: Record<string, RuleDefinition[]> = {};
    for (const rule of rules) {
      const domain = getDomainForRule(rule.id);
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(rule);
    }

    // Build summary for each domain that has rules, in canonical order
    const result: DomainSummary[] = [];
    for (const key of ALL_DOMAINS) {
      const domainRules = grouped[key];
      if (!domainRules || domainRules.length === 0) continue;
      const passing = domainRules.filter(
        (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
      ).length;
      result.push({
        key,
        label: DOMAIN_META[key].label,
        description: DOMAIN_META[key].description,
        ruleCount: domainRules.length,
        passingRules: passing,
      });
    }

    // Add "general" if any rules don't match
    const generalRules = grouped['general'];
    if (generalRules && generalRules.length > 0) {
      const passing = generalRules.filter(
        (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
      ).length;
      result.push({
        key: 'general',
        label: DOMAIN_META.general.label,
        description: DOMAIN_META.general.description,
        ruleCount: generalRules.length,
        passingRules: passing,
      });
    }

    return result;
  }, [rules]);

  if (domains.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">No rule domains available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {domains.map((d) => (
        <DomainCard
          key={d.key}
          domainKey={d.key}
          label={d.label}
          description={d.description}
          ruleCount={d.ruleCount}
          passingRules={d.passingRules}
          onClick={() => onSelectDomain(d.key)}
        />
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/DomainCardGrid.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/rules/DomainCardGrid.tsx frontend/src/components/rules/__tests__/DomainCardGrid.test.tsx
git commit -m "[frontend] Add DomainCardGrid for Level 1 domain overview"
```

---

### Task 6: Redesign RuleCard for Card Layout (Level 2)

**Files:**
- Modify: `frontend/src/components/rules/RuleCard.tsx`
- Modify: `frontend/src/components/rules/__tests__/RuleCard.test.tsx`

Transform from flat row to card with: full name (no truncation), description (natural wrap), test badge bottom-right, colored left border (green/red/gray).

**Step 1: Update tests for new card layout**

Replace the existing test file contents:

```tsx
// frontend/src/components/rules/__tests__/RuleCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RuleCard from '../RuleCard';
import type { RuleDefinition } from '@/types/Rules';

function makeRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'RULE-ELG-01',
    name: 'Normal Retirement Eligibility',
    domain: 'eligibility',
    description: 'Determines if a member is eligible for normal retirement based on age and vesting status',
    sourceReference: { document: 'RMC', section: '§18-401', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [{ name: 'age', type: 'number', description: 'Age in years' }],
    logic: { type: 'conditional', conditions: [{ condition: 'age >= 65', result: { eligible: true } }] },
    output: [{ field: 'eligible', type: 'boolean' }],
    dependencies: [],
    tags: ['eligibility'],
    testCases: [{ name: 'Happy path', inputs: { age: 65 }, expected: { eligible: true } }],
    governance: { status: 'approved', lastReviewed: '2026-01-01', reviewedBy: 'Committee', effectiveDate: '2026-01-01' },
    testStatus: { total: 3, passing: 3, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    ...overrides,
  };
}

describe('RuleCard', () => {
  it('renders full rule name without truncation', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    const name = screen.getByText('Normal Retirement Eligibility');
    expect(name).toBeInTheDocument();
    // Should not have truncate class
    expect(name.className).not.toContain('truncate');
  });

  it('renders full description text', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    const desc = screen.getByText(/Determines if a member is eligible/);
    expect(desc).toBeInTheDocument();
    expect(desc.className).not.toContain('truncate');
  });

  it('renders rule ID', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByText('RULE-ELG-01')).toBeInTheDocument();
  });

  it('shows green left border when all tests pass', () => {
    const { container } = renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-l-green');
  });

  it('shows red left border when tests fail', () => {
    const rule = makeRule({
      testStatus: { total: 3, passing: 2, failing: 1, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    });
    const { container } = renderWithProviders(<RuleCard rule={rule} onClick={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-l-red');
  });

  it('shows gray left border when no tests', () => {
    const rule = makeRule({ testStatus: undefined });
    const { container } = renderWithProviders(<RuleCard rule={rule} onClick={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-l-gray');
  });

  it('renders test count badge', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    renderWithProviders(<RuleCard rule={makeRule()} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/RuleCard.test.tsx`
Expected: FAIL — tests expect card layout but current code renders flat row

**Step 3: Rewrite RuleCard as card layout**

```tsx
// frontend/src/components/rules/RuleCard.tsx
import type { RuleDefinition } from '@/types/Rules';

interface RuleCardProps {
  rule: RuleDefinition;
  onClick: () => void;
}

export default function RuleCard({ rule, onClick }: RuleCardProps) {
  const status = rule.testStatus;
  const allPassing = status && status.failing === 0 && status.total > 0;
  const hasFailing = status && status.failing > 0;

  const borderColor = allPassing
    ? 'border-l-green-500'
    : hasFailing
      ? 'border-l-red-500'
      : 'border-l-gray-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border border-gray-200 border-l-4 ${borderColor} bg-white shadow-sm p-5 hover:shadow-md hover:border-iw-sage hover:-translate-y-0.5 transition-all cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-gray-900">{rule.name}</h3>
        {status && (
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              hasFailing ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {status.passing}/{status.total}
          </span>
        )}
      </div>
      <span className="font-mono text-xs text-gray-400 mb-2 block">{rule.id}</span>
      <p className="text-sm text-gray-600">{rule.description}</p>
    </button>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/RuleCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/rules/RuleCard.tsx frontend/src/components/rules/__tests__/RuleCard.test.tsx
git commit -m "[frontend] Redesign RuleCard from flat row to card with full name/description"
```

---

### Task 7: RuleCardGrid Component (Level 2 Grid)

**Files:**
- Create: `frontend/src/components/rules/RuleCardGrid.tsx`
- Test: `frontend/src/components/rules/__tests__/RuleCardGrid.test.tsx`

Responsive grid of RuleCards for a specific domain. Receives filtered rules array. Same grid pattern as CaseCardGrid.

**Step 1: Write the failing test**

```tsx
// frontend/src/components/rules/__tests__/RuleCardGrid.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RuleCardGrid from '../RuleCardGrid';
import type { RuleDefinition } from '@/types/Rules';

function makeRule(id: string, name: string): RuleDefinition {
  return {
    id,
    name,
    domain: 'eligibility',
    description: `Description for ${name}`,
    sourceReference: { document: 'RMC', section: '§1', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [],
    logic: { type: 'conditional', conditions: [] },
    output: [],
    dependencies: [],
    tags: [],
    testCases: [],
    governance: { status: 'approved', lastReviewed: '2026-01-01', reviewedBy: 'Committee', effectiveDate: '2026-01-01' },
    testStatus: { total: 2, passing: 2, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
  };
}

describe('RuleCardGrid', () => {
  it('renders a card for each rule', () => {
    const rules = [
      makeRule('RULE-VESTING', 'Vesting'),
      makeRule('RULE-NORMAL-RET', 'Normal Retirement'),
    ];
    renderWithProviders(<RuleCardGrid rules={rules} onSelectRule={vi.fn()} />);
    expect(screen.getByText('Vesting')).toBeInTheDocument();
    expect(screen.getByText('Normal Retirement')).toBeInTheDocument();
  });

  it('calls onSelectRule with rule ID when clicked', () => {
    const onSelectRule = vi.fn();
    const rules = [makeRule('RULE-VESTING', 'Vesting')];
    renderWithProviders(<RuleCardGrid rules={rules} onSelectRule={onSelectRule} />);
    fireEvent.click(screen.getByText('Vesting'));
    expect(onSelectRule).toHaveBeenCalledWith('RULE-VESTING');
  });

  it('shows empty state', () => {
    renderWithProviders(<RuleCardGrid rules={[]} onSelectRule={vi.fn()} />);
    expect(screen.getByText('No rules in this domain.')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/RuleCardGrid.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/rules/RuleCardGrid.tsx
import type { RuleDefinition } from '@/types/Rules';
import RuleCard from './RuleCard';

interface RuleCardGridProps {
  rules: RuleDefinition[];
  onSelectRule: (ruleId: string) => void;
}

export default function RuleCardGrid({ rules, onSelectRule }: RuleCardGridProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">No rules in this domain.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onClick={() => onSelectRule(rule.id)} />
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/RuleCardGrid.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/rules/RuleCardGrid.tsx frontend/src/components/rules/__tests__/RuleCardGrid.test.tsx
git commit -m "[frontend] Add RuleCardGrid for Level 2 rule grid"
```

---

### Task 8: Update RulesSummaryBar for Domain/Rule Scoping

**Files:**
- Modify: `frontend/src/components/rules/RulesSummaryBar.tsx`
- Modify: `frontend/src/components/rules/__tests__/RulesSummaryBar.test.tsx`

Add an optional `label` prop so the bar can say "4/10 passing in Eligibility" or "Rules Explorer" at different levels.

**Step 1: Read current test file**

Read `frontend/src/components/rules/__tests__/RulesSummaryBar.test.tsx` to understand existing tests.

**Step 2: Add tests for the label prop**

Append to existing tests:

```tsx
it('renders domain label when provided', () => {
  renderWithProviders(
    <RulesSummaryBar totalRules={10} passingRules={4} failingRules={6} label="in Eligibility" />,
  );
  expect(screen.getByText('in Eligibility')).toBeInTheDocument();
});
```

**Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/RulesSummaryBar.test.tsx`
Expected: FAIL — label prop not rendered

**Step 4: Add label prop to RulesSummaryBar**

In `RulesSummaryBar.tsx`, add `label?: string` to the interface and render it after "passing":

```tsx
// In the interface, add:
label?: string;

// In the JSX, after the "passing" span:
{label && <span className="text-sm text-gray-600">{label}</span>}
```

**Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/rules/__tests__/RulesSummaryBar.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/components/rules/RulesSummaryBar.tsx frontend/src/components/rules/__tests__/RulesSummaryBar.test.tsx
git commit -m "[frontend] Add label prop to RulesSummaryBar for domain-scoped display"
```

---

### Task 9: Rewrite RulesExplorer with Three-Level State Machine

**Files:**
- Modify: `frontend/src/pages/RulesExplorer.tsx`

This is the main integration task. Replace the two-view (list/detail) with three levels: domain grid → rule grid → rule detail. Add breadcrumb, contextual search, and scoped summary bar.

**Step 1: Write the new RulesExplorer**

The state machine has three levels controlled by `selectedDomain` and `selectedRuleId`:
- Both null → Level 1 (domain cards)
- `selectedDomain` set, `selectedRuleId` null → Level 2 (rule cards for that domain)
- Both set → Level 3 (rule detail)

```tsx
// frontend/src/pages/RulesExplorer.tsx
import { useState, useMemo } from 'react';
import { useRuleDefinitions } from '@/hooks/useRuleDefinitions';
import { useTestReport } from '@/hooks/useTestReport';
import RulesSummaryBar from '@/components/rules/RulesSummaryBar';
import DomainCardGrid from '@/components/rules/DomainCardGrid';
import RuleCardGrid from '@/components/rules/RuleCardGrid';
import RuleDetail from '@/components/rules/RuleDetail';
import Breadcrumb from '@/components/rules/Breadcrumb';
import type { BreadcrumbSegment } from '@/components/rules/Breadcrumb';
import type { RuleDefinition } from '@/types/Rules';
import type { ViewMode } from '@/types/auth';
import { getDomainForRule, DOMAIN_META, type DomainKey } from '@/lib/domainMapping';

interface RulesExplorerProps {
  onNavigateToRule?: (ruleId: string) => void;
  onNavigateToDemoCase?: (caseId: string) => void;
  onChangeView?: (mode: ViewMode) => void;
  initialRuleId?: string;
}

export default function RulesExplorer({
  onNavigateToRule,
  onNavigateToDemoCase,
  onChangeView,
  initialRuleId,
}: RulesExplorerProps) {
  const [selectedDomain, setSelectedDomain] = useState<DomainKey | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(initialRuleId ?? null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rules, isLoading, isError } = useRuleDefinitions();
  const { data: testReport } = useTestReport();

  // Merge test status into rules
  const enrichedRules = useMemo(() => {
    if (!rules) return [];
    if (!testReport?.byRule) return rules;
    return rules.map((rule): RuleDefinition => {
      const summary = testReport.byRule[rule.id];
      if (!summary) return rule;
      return {
        ...rule,
        testStatus: {
          total: summary.total,
          passing: summary.passing,
          failing: summary.failing,
          skipped: summary.skipped,
          lastRun: testReport.lastRun,
        },
      };
    });
  }, [rules, testReport]);

  // Filter rules for current domain
  const domainRules = useMemo(() => {
    if (!selectedDomain) return enrichedRules;
    return enrichedRules.filter((r) => getDomainForRule(r.id) === selectedDomain);
  }, [enrichedRules, selectedDomain]);

  // Search filter (applies to current level)
  const filteredRules = useMemo(() => {
    if (!searchQuery) return domainRules;
    const q = searchQuery.toLowerCase();
    return domainRules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [domainRules, searchQuery]);

  // Summary stats scoped to current view
  const summary = useMemo(() => {
    const source = selectedDomain ? filteredRules : enrichedRules;
    const total = source.length;
    const passing = source.filter(
      (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
    ).length;
    const failing = source.filter((r) => r.testStatus && r.testStatus.failing > 0).length;
    return { total, passing, failing };
  }, [enrichedRules, filteredRules, selectedDomain]);

  // Selected rule for detail view
  const selectedRule = useMemo(
    () => enrichedRules.find((r) => r.id === selectedRuleId) ?? null,
    [enrichedRules, selectedRuleId],
  );

  // Navigation handlers
  const goToLevel1 = () => {
    setSelectedDomain(null);
    setSelectedRuleId(null);
    setSearchQuery('');
  };

  const goToLevel2 = (domain: DomainKey) => {
    setSelectedDomain(domain);
    setSelectedRuleId(null);
    setSearchQuery('');
  };

  const goToLevel3 = (ruleId: string) => {
    // Auto-set domain if not already set
    if (!selectedDomain) {
      setSelectedDomain(getDomainForRule(ruleId));
    }
    setSelectedRuleId(ruleId);
    onNavigateToRule?.(ruleId);
  };

  // Breadcrumb segments
  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [{ label: 'Rules Explorer', onClick: goToLevel1 }];
    if (selectedDomain) {
      segments.push({
        label: DOMAIN_META[selectedDomain].label,
        onClick: selectedRuleId ? () => goToLevel2(selectedDomain) : undefined,
      });
    }
    if (selectedRule) {
      segments.push({ label: selectedRule.id });
    }
    return segments;
  }, [selectedDomain, selectedRuleId, selectedRule]);

  // Summary label
  const summaryLabel = selectedDomain
    ? `in ${DOMAIN_META[selectedDomain].label}`
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading rules...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-red-500">Failed to load rules. Please try again.</div>
      </div>
    );
  }

  // Level 3: Rule Detail
  if (selectedRule) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumb segments={breadcrumbs} />
          {onChangeView && (
            <button
              onClick={() => onChangeView('staff')}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>←</span> Back to Staff Portal
            </button>
          )}
        </div>
        <RuleDetail
          rule={selectedRule}
          onBack={() => selectedDomain ? goToLevel2(selectedDomain) : goToLevel1()}
          onNavigateToRule={goToLevel3}
          onNavigateToDemoCase={onNavigateToDemoCase}
        />
      </div>
    );
  }

  // Level 2: Rule Cards for selected domain
  if (selectedDomain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumb segments={breadcrumbs} />
          {onChangeView && (
            <button
              onClick={() => onChangeView('staff')}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>←</span> Back to Staff Portal
            </button>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{DOMAIN_META[selectedDomain].label}</h1>
          <p className="mt-1 text-sm text-gray-500">{DOMAIN_META[selectedDomain].description}</p>
        </div>

        <RulesSummaryBar
          totalRules={summary.total}
          passingRules={summary.passing}
          failingRules={summary.failing}
          lastRun={testReport?.lastRun}
          label={summaryLabel}
        />

        <div>
          <input
            type="text"
            placeholder="Search rules by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-iw-sage/30 focus:border-iw-sage"
          />
        </div>

        <RuleCardGrid rules={filteredRules} onSelectRule={goToLevel3} />
      </div>
    );
  }

  // Level 1: Domain Cards
  // For Level 1, search filters domain cards by name
  const filteredForDomainSearch = searchQuery
    ? enrichedRules.filter((r) => {
        const domain = getDomainForRule(r.id);
        const meta = DOMAIN_META[domain];
        const q = searchQuery.toLowerCase();
        return meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q);
      })
    : enrichedRules;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rules Explorer</h1>
          <p className="mt-1 text-sm text-gray-500">Business rule definitions with test status</p>
        </div>
        {onChangeView && (
          <button
            onClick={() => onChangeView('staff')}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span>←</span> Back to Staff Portal
          </button>
        )}
      </div>

      <RulesSummaryBar
        totalRules={summary.total}
        passingRules={summary.passing}
        failingRules={summary.failing}
        lastRun={testReport?.lastRun}
      />

      <div>
        <input
          type="text"
          placeholder="Search domains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-iw-sage/30 focus:border-iw-sage"
        />
      </div>

      <DomainCardGrid rules={filteredForDomainSearch} onSelectDomain={goToLevel2} />
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS — no type errors

**Step 3: Run all rules-related tests**

Run: `cd frontend && npx vitest run src/components/rules/`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/pages/RulesExplorer.tsx
git commit -m "[frontend] Rewrite RulesExplorer with three-level card drill-down"
```

---

### Task 10: Remove DomainFilter and Clean Up RulesList

**Files:**
- Delete: `frontend/src/components/rules/DomainFilter.tsx`
- Modify or delete: `frontend/src/components/rules/RulesList.tsx` (no longer imported)

**Step 1: Verify DomainFilter is no longer imported**

Run: `cd frontend && grep -r "DomainFilter" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the file itself and possibly its own test — no imports from RulesExplorer

**Step 2: Verify RulesList is no longer imported**

Run: `cd frontend && grep -r "RulesList" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the file itself — no imports from RulesExplorer

**Step 3: Delete unused files**

```bash
rm frontend/src/components/rules/DomainFilter.tsx
rm frontend/src/components/rules/RulesList.tsx
```

**Step 4: Run typecheck to confirm no broken imports**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 5: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: PASS (all existing tests still green)

**Step 6: Commit**

```bash
git add -A
git commit -m "[frontend] Remove DomainFilter and RulesList (replaced by card drill-down)"
```

---

### Task 11: Visual Verification

**Files:** None — this is a manual verification task using the running Docker stack.

**Step 1: Start dev server or use Docker**

If Docker stack is running: navigate to `http://localhost:3000`
If not: `cd frontend && npm run dev`

**Step 2: Verify Level 1 — Domain Cards**

1. Navigate to Rules Explorer
2. Confirm 9 domain cards appear in a responsive grid
3. Confirm each card shows: domain name, description, rule count, progress ring
4. Confirm hover effect: shadow-md, border color shift, slight lift
5. Confirm search filters domains by name

**Step 3: Verify Level 2 — Rule Cards**

1. Click a domain card (e.g., "Eligibility")
2. Confirm breadcrumb shows "Rules Explorer > Eligibility"
3. Confirm rule cards appear in grid with: full name, description, test badge, colored left border
4. Confirm search filters rules within the domain
5. Confirm summary bar says "X/Y passing in Eligibility"

**Step 4: Verify Level 3 — Rule Detail**

1. Click a rule card
2. Confirm breadcrumb shows "Rules Explorer > Eligibility > RULE-VESTING"
3. Confirm 4-tab detail view works (Logic, I/O, Tests, Governance)
4. Confirm breadcrumb navigation: click "Rules Explorer" goes to Level 1, click domain name goes to Level 2

**Step 5: Take screenshots for PR**

Use preview tools to capture screenshots of all three levels.

**Step 6: Final commit — update BUILD_HISTORY.md**

```bash
# Update BUILD_HISTORY.md with the Rules Explorer redesign entry
git add BUILD_HISTORY.md
git commit -m "[docs] Add Rules Explorer card drill-down redesign to BUILD_HISTORY"
```

---

### Task Summary

| Task | Component | Type | Est. |
|------|-----------|------|------|
| 1 | Domain Mapping | New file + tests | 5 min |
| 2 | ProgressRing | New component + tests | 5 min |
| 3 | Breadcrumb | New component + tests | 5 min |
| 4 | DomainCard | New component + tests | 5 min |
| 5 | DomainCardGrid | New component + tests | 5 min |
| 6 | RuleCard redesign | Modify + update tests | 5 min |
| 7 | RuleCardGrid | New component + tests | 5 min |
| 8 | RulesSummaryBar | Modify + add test | 3 min |
| 9 | RulesExplorer rewrite | Major modify | 10 min |
| 10 | Cleanup (DomainFilter, RulesList) | Delete unused | 3 min |
| 11 | Visual verification | Manual check | 5 min |

**Total: ~56 min, 11 commits**
