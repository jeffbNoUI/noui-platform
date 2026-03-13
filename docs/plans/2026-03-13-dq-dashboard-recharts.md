# DQ Dashboard + Recharts Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add DQ score trend chart and category breakdown chart to DataQualityPanel, then migrate all existing hand-rolled SVG charts to Recharts for a consistent premium charting experience.

**Architecture:** Install Recharts as the standard charting library. Build two new DQ chart components (AreaChart for trends, horizontal BarChart for categories), wire them into DataQualityPanel, write tests for all DQ components, then migrate BenefitProjectionChart and ContributionBars from raw SVG to Recharts. RingGauge stays as raw SVG.

**Tech Stack:** React, TypeScript, Recharts, Vitest, @testing-library/react

**Baseline:** 327 tests passing, TypeScript clean.

---

### Task 1: Install Recharts

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install recharts**

Run: `cd frontend && npm install recharts`

**Step 2: Verify TypeScript still clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors (Recharts ships its own types)

**Step 3: Verify all tests still pass**

Run: `cd frontend && npm test -- --run`
Expected: 327 tests passing

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "[frontend] Add recharts dependency for chart standardization"
```

---

### Task 2: DQ Score Trend Chart

**Files:**
- Create: `frontend/src/components/admin/DQScoreTrendChart.tsx`
- Test: `frontend/src/components/admin/__tests__/DQScoreTrendChart.test.tsx`

**Context:**
- `DQScoreTrend` type: `{ date: string; score: number }` — defined in `frontend/src/types/DataQuality.ts`
- `useDQScoreTrend(days)` hook exists in `frontend/src/hooks/useDataQuality.ts`
- Design system colors in `frontend/src/lib/designSystem.ts`: `C.sage = '#5B8A72'`, `C.coral = '#D4725C'`, `C.textTertiary = '#9C9890'`, `C.borderLight = '#EDEAE4'`, `C.cardBg = '#FFFFFF'`
- Reference line at 95% threshold

**Step 1: Write the test file**

Create `frontend/src/components/admin/__tests__/DQScoreTrendChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DQScoreTrendChart from '../DQScoreTrendChart';
import type { DQScoreTrend } from '@/types/DataQuality';

// Recharts uses ResizeObserver — mock it for jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

const mockTrend: DQScoreTrend[] = [
  { date: '2026-02-11', score: 92.5 },
  { date: '2026-02-18', score: 93.1 },
  { date: '2026-02-25', score: 94.0 },
  { date: '2026-03-04', score: 95.8 },
  { date: '2026-03-11', score: 96.2 },
];

describe('DQScoreTrendChart', () => {
  it('renders the chart container', () => {
    const { container } = render(<DQScoreTrendChart data={mockTrend} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<DQScoreTrendChart data={[]} />);
    expect(screen.getByText(/no trend data/i)).toBeInTheDocument();
  });

  it('renders with single data point without crashing', () => {
    const { container } = render(<DQScoreTrendChart data={[{ date: '2026-03-13', score: 95.0 }]} />);
    expect(container).toBeTruthy();
  });

  it('shows the 95% target label', () => {
    render(<DQScoreTrendChart data={mockTrend} />);
    expect(screen.getByText('95% Target')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/DQScoreTrendChart.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the component**

Create `frontend/src/components/admin/DQScoreTrendChart.tsx`:

```tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { C, BODY } from '@/lib/designSystem';
import type { DQScoreTrend } from '@/types/DataQuality';

interface Props {
  data: DQScoreTrend[];
  height?: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: BODY,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ color: C.textTertiary, marginBottom: 2 }}>{formatDate(label)}</div>
      <div style={{ color: C.sage, fontWeight: 600 }}>{payload[0].value.toFixed(1)}%</div>
    </div>
  );
}

export default function DQScoreTrendChart({ data, height = 200 }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No trend data available
      </div>
    );
  }

  const minScore = Math.min(...data.map((d) => d.score));
  const yMin = Math.max(0, Math.floor(minScore / 5) * 5 - 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">Score Trend</h3>
        <span className="text-[10px] text-gray-400">Last {data.length} data points</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <defs>
            <linearGradient id="scoreTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.sage} stopOpacity={0.2} />
              <stop offset="100%" stopColor={C.sage} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
            axisLine={{ stroke: C.borderLight }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, 100]}
            tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={95}
            stroke={C.coral}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: '95% Target',
              position: 'right',
              fontSize: 10,
              fill: C.coral,
              fontFamily: BODY,
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={C.sage}
            strokeWidth={2.5}
            fill="url(#scoreTrendGradient)"
            dot={false}
            activeDot={{ r: 4, fill: C.cardBg, stroke: C.sage, strokeWidth: 2.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/DQScoreTrendChart.test.tsx`
Expected: 4 tests passing

**Step 5: Commit**

```bash
git add frontend/src/components/admin/DQScoreTrendChart.tsx frontend/src/components/admin/__tests__/DQScoreTrendChart.test.tsx
git commit -m "[frontend] Add DQScoreTrendChart — Recharts AreaChart with 95% reference line"
```

---

### Task 3: DQ Category Chart

**Files:**
- Create: `frontend/src/components/admin/DQCategoryChart.tsx`
- Test: `frontend/src/components/admin/__tests__/DQCategoryChart.test.tsx`

**Context:**
- Category scores come from `DQScore.categoryScores: Record<string, number>` (e.g., `{ completeness: 98.0, consistency: 95.0, validity: 96.0 }`)
- Horizontal BarChart — categories on Y axis, score 0-100 on X axis

**Step 1: Write the test file**

Create `frontend/src/components/admin/__tests__/DQCategoryChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DQCategoryChart from '../DQCategoryChart';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

describe('DQCategoryChart', () => {
  it('renders bars for each category', () => {
    const { container } = render(
      <DQCategoryChart categoryScores={{ completeness: 98.0, consistency: 95.0, validity: 96.0 }} />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders empty state when no categories', () => {
    render(<DQCategoryChart categoryScores={{}} />);
    expect(screen.getByText(/no category data/i)).toBeInTheDocument();
  });

  it('capitalizes category names', () => {
    render(<DQCategoryChart categoryScores={{ completeness: 90.0 }} />);
    expect(screen.getByText('Completeness')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/DQCategoryChart.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the component**

Create `frontend/src/components/admin/DQCategoryChart.tsx`:

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { C, BODY } from '@/lib/designSystem';

interface Props {
  categoryScores: Record<string, number>;
  height?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  completeness: C.sage,
  consistency: C.sky,
  validity: C.gold,
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, score } = payload[0].payload;
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: BODY,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ color: C.textTertiary, marginBottom: 2 }}>{name}</div>
      <div style={{ fontWeight: 600 }}>{score.toFixed(1)}%</div>
    </div>
  );
}

export default function DQCategoryChart({ categoryScores, height = 140 }: Props) {
  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No category data available
      </div>
    );
  }

  const chartData = entries.map(([cat, score]) => ({
    name: capitalize(cat),
    category: cat,
    score,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
          axisLine={{ stroke: C.borderLight }}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: C.text, fontFamily: BODY }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: C.borderLight, opacity: 0.3 }} />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
          {chartData.map((entry) => (
            <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || C.sage} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/DQCategoryChart.test.tsx`
Expected: 3 tests passing

**Step 5: Commit**

```bash
git add frontend/src/components/admin/DQCategoryChart.tsx frontend/src/components/admin/__tests__/DQCategoryChart.test.tsx
git commit -m "[frontend] Add DQCategoryChart — horizontal bar chart for category scores"
```

---

### Task 4: Wire Charts into DataQualityPanel

**Files:**
- Modify: `frontend/src/components/admin/DataQualityPanel.tsx`

**Context:**
- `DataQualityPanel.tsx` already imports `useDQScore`, `useDQChecks`, `useDQIssues`, `useUpdateDQIssue` from `@/hooks/useDataQuality`
- Need to add `useDQScoreTrend` import
- Insert `DQScoreTrendChart` between KPI cards (line ~69) and Category Scores section (line ~72)
- Replace the progress bar category section (lines 72-92) with `DQCategoryChart`

**Step 1: Add imports and hook call**

At top of `DataQualityPanel.tsx`, add to the existing import from `useDataQuality`:

```tsx
import { useDQScore, useDQScoreTrend, useDQChecks, useDQIssues, useUpdateDQIssue } from '@/hooks/useDataQuality';
import DQScoreTrendChart from './DQScoreTrendChart';
import DQCategoryChart from './DQCategoryChart';
```

Inside the component function, add after existing hook calls:

```tsx
const { data: trendData = [] } = useDQScoreTrend();
```

**Step 2: Insert trend chart after KPI cards**

After the closing `</div>` of the Score Summary grid (after line 69), insert:

```tsx
{/* Score Trend */}
{trendData.length > 0 && (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <DQScoreTrendChart data={trendData} />
  </div>
)}
```

**Step 3: Replace Category Scores progress bars with DQCategoryChart**

Replace the entire Category Scores section (lines 72-92, the `bg-white border...` div with `h3` "Scores by Category" and the progress bar map) with:

```tsx
{/* Category Scores */}
{score && Object.keys(score.categoryScores).length > 0 && (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <h3 className="text-sm font-bold text-gray-700 mb-2">Scores by Category</h3>
    <DQCategoryChart categoryScores={score.categoryScores} />
  </div>
)}
```

**Step 4: Verify TypeScript clean and tests pass**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run`
Expected: TypeScript clean, 327+ tests passing

**Step 5: Commit**

```bash
git add frontend/src/components/admin/DataQualityPanel.tsx
git commit -m "[frontend] Wire DQScoreTrendChart + DQCategoryChart into DataQualityPanel"
```

---

### Task 5: DataQualityPanel Tests

**Files:**
- Create: `frontend/src/components/admin/__tests__/DataQualityPanel.test.tsx`

**Context:**
- Panel uses 4 hooks: `useDQScore`, `useDQScoreTrend`, `useDQChecks`, `useDQIssues`, `useUpdateDQIssue`
- All hooks must be mocked
- Use `renderWithProviders` from `@/test/helpers`
- Follow patterns from `DQIssueDetail.test.tsx`
- Mock data: `mockDQScore`, `mockDQScoreLow`, `mockDQIssues` from `@/components/dashboard/__tests__/fixtures`

**Step 1: Write the test file**

Create `frontend/src/components/admin/__tests__/DataQualityPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import DataQualityPanel from '../DataQualityPanel';
import { mockDQScore, mockDQScoreLow, mockDQIssues } from '@/components/dashboard/__tests__/fixtures';
import type { DQCheckDefinition } from '@/types/DataQuality';

// Mock ResizeObserver for Recharts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

const mockChecks: DQCheckDefinition[] = [
  {
    checkId: 'CHK-001',
    tenantId: 'T1',
    checkName: 'Email format validation',
    checkCode: 'EMAIL_FORMAT',
    category: 'validity',
    severity: 'warning',
    targetTable: 'member',
    isActive: true,
    schedule: 'daily',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
    latestResult: {
      resultId: 'RES-001',
      checkId: 'CHK-001',
      tenantId: 'T1',
      runAt: '2026-03-13T06:00:00Z',
      recordsChecked: 1000,
      recordsPassed: 985,
      recordsFailed: 15,
      passRate: 98.5,
      status: 'completed',
      createdAt: '2026-03-13T06:00:00Z',
    },
  },
];

const mockMutate = vi.fn();

// Default mocks — override per-test as needed
let mockScoreData: any = mockDQScore;
let mockScoreLoading = false;
let mockTrendData: any = [];
let mockChecksData: any = mockChecks;
let mockIssuesData: any = mockDQIssues;

vi.mock('@/hooks/useDataQuality', () => ({
  useDQScore: () => ({
    data: mockScoreData,
    isLoading: mockScoreLoading,
    refetch: vi.fn(),
  }),
  useDQScoreTrend: () => ({
    data: mockTrendData,
  }),
  useDQChecks: () => ({
    data: mockChecksData,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDQIssues: () => ({
    data: mockIssuesData,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUpdateDQIssue: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe('DataQualityPanel', () => {
  beforeEach(() => {
    mockScoreData = mockDQScore;
    mockScoreLoading = false;
    mockTrendData = [];
    mockChecksData = mockChecks;
    mockIssuesData = mockDQIssues;
    mockMutate.mockClear();
  });

  it('renders overall score', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('96.2%')).toBeInTheDocument();
  });

  it('renders KPI cards', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
    expect(screen.getByText('Active Checks')).toBeInTheDocument();
    expect(screen.getByText('Open Issues')).toBeInTheDocument();
    expect(screen.getByText('Critical Issues')).toBeInTheDocument();
  });

  it('renders check definitions count', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Check Definitions (1)')).toBeInTheDocument();
  });

  it('renders check name', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Email format validation')).toBeInTheDocument();
  });

  it('renders open issues count', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Open Issues (2)')).toBeInTheDocument();
  });

  it('renders issue descriptions', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Email address format appears invalid')).toBeInTheDocument();
    expect(screen.getByText('Hire date is after retirement date')).toBeInTheDocument();
  });

  it('shows loading state when score is loading and no data', () => {
    mockScoreData = undefined;
    mockScoreLoading = true;
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Loading data quality metrics...')).toBeInTheDocument();
  });

  it('shows no open issues message when issues list is empty', () => {
    mockIssuesData = [];
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('No open issues')).toBeInTheDocument();
  });

  it('renders severity summary pills', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('1 Warning')).toBeInTheDocument();
    expect(screen.getByText('1 Critical')).toBeInTheDocument();
  });

  it('renders category scores section', () => {
    renderWithProviders(<DataQualityPanel />);
    expect(screen.getByText('Scores by Category')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/DataQualityPanel.test.tsx`
Expected: 10 tests passing

**Step 3: Commit**

```bash
git add frontend/src/components/admin/__tests__/DataQualityPanel.test.tsx
git commit -m "[frontend] Add DataQualityPanel tests — 10 tests covering KPIs, checks, issues, states"
```

---

### Task 6: DataQualityCard Tests

**Files:**
- Create: `frontend/src/components/dashboard/__tests__/DataQualityCard.test.tsx`

**Context:**
- `DataQualityCard` takes props: `score?: DQScore`, `memberIssues: DQIssue[]`, `isLoading: boolean`
- Uses `CollapsibleSection`, `DQIssueDetail` overlay
- Mock data available in same `__tests__/fixtures.ts`
- Must mock `useSpawnAnimation` for DQIssueDetail overlay (same pattern as DQIssueDetail.test.tsx)

**Step 1: Write the test file**

Create `frontend/src/components/dashboard/__tests__/DataQualityCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DataQualityCard from '../../dashboard/DataQualityCard';
import { mockDQScore, mockDQIssues } from './fixtures';

vi.mock('@/hooks/useSpawnAnimation', () => ({
  useSpawnAnimation: () => ({
    panelRef: { current: null },
    isVisible: true,
    phase: 'open',
    open: vi.fn(),
    close: vi.fn(),
    style: { transform: 'none', opacity: 1, transition: 'none' },
    DURATION_MS: 0,
  }),
}));

describe('DataQualityCard', () => {
  it('renders overall score', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('96.2%')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithProviders(
      <DataQualityCard score={undefined} memberIssues={[]} isLoading={true} />,
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('returns null when no score and no issues', () => {
    const { container } = renderWithProviders(
      <DataQualityCard score={undefined} memberIssues={[]} isLoading={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders member issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('Email address format appears invalid')).toBeInTheDocument();
    expect(screen.getByText('Hire date is after retirement date')).toBeInTheDocument();
  });

  it('shows issue count badge when member has issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('2 issues')).toBeInTheDocument();
  });

  it('shows score badge when no member issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('96%')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/dashboard/__tests__/DataQualityCard.test.tsx`
Expected: 6 tests passing

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/__tests__/DataQualityCard.test.tsx
git commit -m "[frontend] Add DataQualityCard tests — 6 tests covering score, loading, issues, badges"
```

---

### Task 7: Migrate BenefitProjectionChart to Recharts

**Files:**
- Modify: `frontend/src/components/portal/BenefitProjectionChart.tsx`
- Update: `frontend/src/components/portal/__tests__/BenefitProjectionChart.test.tsx`

**Context:**
- Currently renders raw SVG with bezier curves for 3 data series (projected, conservative, contributed)
- Exported interface `ProjectionDataPoint { year, projected, conservative, contributed }` — keep this
- Imported by `MemberPortal.tsx`
- Design system uses `C.sage` (projected), `C.textTertiary` (conservative), `C.gold` (contributed)

**Step 1: Rewrite the component**

Replace contents of `frontend/src/components/portal/BenefitProjectionChart.tsx`:

```tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { C, BODY, MONO } from '@/lib/designSystem';

export interface ProjectionDataPoint {
  year: string;
  projected: number;
  conservative: number;
  contributed: number;
}

interface Props {
  data: ProjectionDataPoint[];
  width?: number;
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: BODY,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ color: C.textTertiary, marginBottom: 4 }}>{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, fontWeight: 500, fontFamily: MONO }}>
          {entry.name}: ${(entry.value / 1000).toFixed(1)}k
        </div>
      ))}
    </div>
  );
}

export default function BenefitProjectionChart({ data, height = 220 }: Props) {
  if (data.length < 2) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No projection data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.sage} stopOpacity={0.18} />
            <stop offset="100%" stopColor={C.sage} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.gold} stopOpacity={0.12} />
            <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
          axisLine={{ stroke: C.borderLight }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="contributed"
          name="Contributed"
          stroke={C.gold}
          strokeWidth={2}
          strokeDasharray="6 3"
          strokeOpacity={0.6}
          fill="url(#contribGrad)"
        />
        <Area
          type="monotone"
          dataKey="conservative"
          name="Conservative"
          stroke={C.textTertiary}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="projected"
          name="Projected"
          stroke={C.sage}
          strokeWidth={2.5}
          fill="url(#projGrad)"
          activeDot={{ r: 5, fill: C.cardBg, stroke: C.sage, strokeWidth: 2.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: Update the test file**

Replace contents of `frontend/src/components/portal/__tests__/BenefitProjectionChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BenefitProjectionChart from '../BenefitProjectionChart';
import type { ProjectionDataPoint } from '../BenefitProjectionChart';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

const zeroData: ProjectionDataPoint[] = [
  { year: '2026', projected: 0, conservative: 0, contributed: 0 },
  { year: '2027', projected: 0, conservative: 0, contributed: 0 },
  { year: '2028', projected: 0, conservative: 0, contributed: 0 },
];

const normalData: ProjectionDataPoint[] = [
  { year: '2026', projected: 10000, conservative: 8000, contributed: 5000 },
  { year: '2027', projected: 15000, conservative: 12000, contributed: 7000 },
  { year: '2028', projected: 20000, conservative: 16000, contributed: 9000 },
];

describe('BenefitProjectionChart', () => {
  it('renders empty state with insufficient data', () => {
    render(<BenefitProjectionChart data={[]} />);
    expect(screen.getByText('No projection data')).toBeInTheDocument();
  });

  it('renders chart container with valid data', () => {
    const { container } = render(<BenefitProjectionChart data={normalData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders without crashing with zero values', () => {
    const { container } = render(<BenefitProjectionChart data={zeroData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
```

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/portal/__tests__/BenefitProjectionChart.test.tsx`
Expected: 3 tests passing

**Step 4: Full test suite**

Run: `cd frontend && npm test -- --run`
Expected: All tests passing (327 baseline + new tests)

**Step 5: Commit**

```bash
git add frontend/src/components/portal/BenefitProjectionChart.tsx frontend/src/components/portal/__tests__/BenefitProjectionChart.test.tsx
git commit -m "[frontend] Migrate BenefitProjectionChart to Recharts AreaChart"
```

---

### Task 8: Migrate ContributionBars to Recharts

**Files:**
- Modify: `frontend/src/components/portal/ContributionBars.tsx`
- Update: `frontend/src/components/portal/__tests__/ContributionBars.test.tsx`

**Context:**
- Currently renders stacked bar chart via raw SVG — employer (sage) on top, employee (gold) on bottom
- Exported interface `ContributionDataPoint { year, employee, employer }` — keep this
- Imported by `MemberPortal.tsx`

**Step 1: Rewrite the component**

Replace contents of `frontend/src/components/portal/ContributionBars.tsx`:

```tsx
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { C, BODY, MONO } from '@/lib/designSystem';

export interface ContributionDataPoint {
  year: string;
  employee: number;
  employer: number;
}

interface Props {
  data: ContributionDataPoint[];
  width?: number;
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: BODY,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ color: C.textTertiary, marginBottom: 4 }}>{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, fontWeight: 500, fontFamily: MONO }}>
          {entry.name}: ${entry.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function ContributionBars({ data, height = 140 }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No contribution data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="year"
          tick={{ fontSize: 9, fill: C.textTertiary, fontFamily: BODY }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: C.borderLight, opacity: 0.3 }} />
        <Bar dataKey="employer" name="Employer" stackId="contributions" fill={C.sage} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
        <Bar dataKey="employee" name="Employee" stackId="contributions" fill={C.gold} fillOpacity={0.7} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: Update the test file**

Replace contents of `frontend/src/components/portal/__tests__/ContributionBars.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContributionBars from '../ContributionBars';
import type { ContributionDataPoint } from '../ContributionBars';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

const zeroData: ContributionDataPoint[] = [
  { year: '2024', employee: 0, employer: 0 },
  { year: '2025', employee: 0, employer: 0 },
  { year: '2026', employee: 0, employer: 0 },
];

const normalData: ContributionDataPoint[] = [
  { year: '2024', employee: 3000, employer: 6000 },
  { year: '2025', employee: 3200, employer: 6400 },
  { year: '2026', employee: 3400, employer: 6800 },
];

describe('ContributionBars', () => {
  it('renders empty state with no data', () => {
    render(<ContributionBars data={[]} />);
    expect(screen.getByText('No contribution data')).toBeInTheDocument();
  });

  it('renders chart container with valid data', () => {
    const { container } = render(<ContributionBars data={normalData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders without crashing with zero values', () => {
    const { container } = render(<ContributionBars data={zeroData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
```

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/portal/__tests__/ContributionBars.test.tsx`
Expected: 3 tests passing

**Step 4: Full test suite + typecheck**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run`
Expected: TypeScript clean, all tests passing

**Step 5: Commit**

```bash
git add frontend/src/components/portal/ContributionBars.tsx frontend/src/components/portal/__tests__/ContributionBars.test.tsx
git commit -m "[frontend] Migrate ContributionBars to Recharts stacked BarChart"
```

---

### Task 9: Final Verification + BUILD_HISTORY

**Files:**
- Modify: `BUILD_HISTORY.md`

**Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Full build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 3: Full test suite**

Run: `cd frontend && npm test -- --run`
Expected: All tests pass — 327 baseline + ~26 new tests = ~353 total

**Step 4: Update BUILD_HISTORY.md**

Add session 6 entry at top of BUILD_HISTORY.md.

**Step 5: Commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Add Session 6 build history — DQ dashboard + Recharts migration"
```
