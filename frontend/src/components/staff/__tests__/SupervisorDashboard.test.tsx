import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import SupervisorDashboard from '../SupervisorDashboard';
import type { CaseStats } from '@/types/Case';
import type { RetirementCase } from '@/types/Case';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockStats: CaseStats = {
  totalActive: 20,
  completedMTD: 47,
  atRiskCount: 3,
  caseloadByStage: [
    { stage: 'Intake Review', stageIdx: 0, count: 5 },
    { stage: 'Employment Verification', stageIdx: 1, count: 3 },
    { stage: 'Eligibility Determination', stageIdx: 2, count: 4 },
    { stage: 'Benefit Calculation', stageIdx: 4, count: 6 },
    { stage: 'Final Certification', stageIdx: 6, count: 2 },
  ],
  casesByStatus: [{ status: 'active', count: 20 }],
  casesByPriority: [
    { priority: 'urgent', count: 2 },
    { priority: 'high', count: 5 },
    { priority: 'standard', count: 13 },
  ],
  casesByAssignee: [
    { assignedTo: 'Sarah Chen', count: 4, avgDaysOpen: 6.2 },
    { assignedTo: 'Michael Torres', count: 6, avgDaysOpen: 8.5 },
  ],
};

const mockCertCase: RetirementCase = {
  caseId: 'RET-2026-0141',
  tenantId: 'T1',
  memberId: 10001,
  caseType: 'Standard',
  retDate: '2026-06-01',
  priority: 'standard',
  sla: 'on-track',
  stage: 'Final Certification',
  stageIdx: 6,
  assignedTo: 'Sarah Chen',
  daysOpen: 12,
  status: 'active',
  flags: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-03-01',
  name: 'Thomas Anderson',
  tier: 2,
  dept: 'IT',
};

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockStatsData: CaseStats | undefined = mockStats;
let mockStatsLoading = false;
let mockStatsError: Error | null = null;
let mockCasesData: RetirementCase[] = [mockCertCase];

vi.mock('@/hooks/useCaseStats', () => ({
  useCaseStats: () => ({
    data: mockStatsData,
    isLoading: mockStatsLoading,
    error: mockStatsError,
  }),
}));

vi.mock('@/hooks/useCaseManagement', () => ({
  useCases: () => ({
    data: mockCasesData,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SupervisorDashboard', () => {
  beforeEach(() => {
    mockStatsData = mockStats;
    mockStatsLoading = false;
    mockStatsError = null;
    mockCasesData = [mockCertCase];
  });

  it('renders KPI cards with live stats data', () => {
    renderWithProviders(<SupervisorDashboard />);

    // Use label-based lookups to avoid ambiguity
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Completed (MTD)')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    // Verify KPI values via the cards that hold them
    expect(screen.getByText('20')).toBeInTheDocument(); // totalActive (unique)
    expect(screen.getByText('47')).toBeInTheDocument(); // completedMTD (unique)
  });

  it('renders caseload by stage from API data', () => {
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('Intake Review')).toBeInTheDocument();
    expect(screen.getByText('Employment Verification')).toBeInTheDocument();
    // "Final Certification" appears in both caseload and approval queue
    expect(screen.getAllByText('Final Certification').length).toBeGreaterThanOrEqual(1);
  });

  it('renders approval queue from certification cases', () => {
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('RET-2026-0141')).toBeInTheDocument();
    expect(screen.getByText('Thomas Anderson')).toBeInTheDocument();
    expect(screen.getByText('1 waiting')).toBeInTheDocument();
  });

  it('shows loading skeletons while stats are loading', () => {
    mockStatsLoading = true;
    mockStatsData = undefined;
    const { container } = renderWithProviders(<SupervisorDashboard />);

    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('shows error notice when stats fetch fails but still renders dashboard', () => {
    mockStatsError = new Error('Network error');
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('Stats unavailable')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    // Dashboard still renders (team table, approval queue)
    expect(screen.getByText('Team Performance')).toBeInTheDocument();
  });

  it('shows empty state when no caseload data', () => {
    mockStatsData = { ...mockStats, caseloadByStage: [] };
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('No active cases')).toBeInTheDocument();
  });

  it('shows empty approval queue when no certification cases', () => {
    mockCasesData = [];
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('0 waiting')).toBeInTheDocument();
    expect(screen.getByText('No cases pending approval')).toBeInTheDocument();
  });

  it('renders team performance table from live assignee data', () => {
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('Team Performance')).toBeInTheDocument();
    // Sarah Chen (4 cases, 6.2 avg days → ~93% efficiency → Expert)
    expect(screen.getAllByText('Sarah Chen').length).toBeGreaterThanOrEqual(1);
    // Michael Torres (6 cases, 8.5 avg days → ~91% efficiency → Expert)
    expect(screen.getByText('Michael Torres')).toBeInTheDocument();
    // Both should show Expert proficiency (avgDays < 9 → efficiency > 90%)
    expect(screen.getAllByText('Expert').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty team table when no assignee data', () => {
    mockStatsData = { ...mockStats, casesByAssignee: [] };
    renderWithProviders(<SupervisorDashboard />);

    expect(screen.getByText('No team data available')).toBeInTheDocument();
  });
});
