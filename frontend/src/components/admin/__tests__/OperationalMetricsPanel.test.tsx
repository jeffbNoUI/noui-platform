import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import OperationalMetricsPanel from '../OperationalMetricsPanel';

const mockCaseStats = vi.fn();
const mockSLAStats = vi.fn();
const mockVolumeStats = vi.fn();
const mockCommitmentStats = vi.fn();
const mockDQScore = vi.fn();

vi.mock('@/hooks/useCaseStats', () => ({
  useCaseStats: () => mockCaseStats(),
  useSLAStats: () => mockSLAStats(),
  useVolumeStats: () => mockVolumeStats(),
}));
vi.mock('@/hooks/useCommitmentStats', () => ({
  useCommitmentStats: () => mockCommitmentStats(),
}));
vi.mock('@/hooks/useDataQuality', () => ({
  useDQScore: () => mockDQScore(),
}));

// Mock Recharts to avoid JSDOM SVG issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

const CASE_STATS = {
  totalActive: 47,
  completedMTD: 12,
  atRiskCount: 5,
  caseloadByStage: [
    { stage: 'intake-review', stageIdx: 0, count: 12 },
    { stage: 'employment-verification', stageIdx: 1, count: 18 },
    { stage: 'eligibility-determination', stageIdx: 2, count: 8 },
    { stage: 'benefit-calculation', stageIdx: 3, count: 4 },
    { stage: 'election-enrollment', stageIdx: 4, count: 3 },
    { stage: 'final-certification', stageIdx: 5, count: 2 },
  ],
  casesByStatus: [
    { status: 'active', count: 47 },
    { status: 'closed', count: 120 },
  ],
  casesByPriority: [
    { priority: 'urgent', count: 5 },
    { priority: 'high', count: 12 },
    { priority: 'standard', count: 30 },
  ],
  casesByAssignee: [],
};

const SLA_STATS = {
  onTrack: 39,
  atRisk: 5,
  overdue: 3,
  avgProcessingDays: 12.3,
  thresholds: { urgent: 5, high: 10, standard: 30 },
};

const VOLUME_STATS = {
  months: [
    { month: 'Oct', year: 2025, count: 22 },
    { month: 'Nov', year: 2025, count: 28 },
    { month: 'Dec', year: 2025, count: 31 },
    { month: 'Jan', year: 2026, count: 25 },
    { month: 'Feb', year: 2026, count: 33 },
    { month: 'Mar', year: 2026, count: 18 },
  ],
};

describe('OperationalMetricsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseStats.mockReturnValue({ data: CASE_STATS, isLoading: false });
    mockSLAStats.mockReturnValue({ data: SLA_STATS, isLoading: false });
    mockVolumeStats.mockReturnValue({ data: VOLUME_STATS, isLoading: false });
    mockCommitmentStats.mockReturnValue({
      data: { overdue: 3, dueThisWeek: 7, upcoming: 12 },
      isLoading: false,
    });
    mockDQScore.mockReturnValue({ data: { overallScore: 96.2 }, isLoading: false });
  });

  it('renders KPI cards with values', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('SLA On-Track')).toBeInTheDocument();
  });

  it('renders pipeline by stage section', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText(/pipeline/i)).toBeInTheDocument();
  });

  it('renders SLA health section', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText(/sla health/i)).toBeInTheDocument();
  });

  it('renders commitments due section', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText(/commitments/i)).toBeInTheDocument();
    expect(screen.getAllByText(/overdue/i).length).toBeGreaterThan(0);
  });

  it('handles loading state', () => {
    mockCaseStats.mockReturnValue({ data: undefined, isLoading: true });
    mockSLAStats.mockReturnValue({ data: undefined, isLoading: true });
    mockVolumeStats.mockReturnValue({ data: undefined, isLoading: true });
    mockCommitmentStats.mockReturnValue({ data: undefined, isLoading: true });
    mockDQScore.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
  });

  it('shows unavailability banner when all hooks return no data', () => {
    mockCaseStats.mockReturnValue({ data: undefined, isLoading: false });
    mockSLAStats.mockReturnValue({ data: undefined, isLoading: false });
    mockVolumeStats.mockReturnValue({ data: undefined, isLoading: false });
    mockCommitmentStats.mockReturnValue({ data: undefined, isLoading: false });
    mockDQScore.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
  });

  it('does NOT show banner while loading', () => {
    mockCaseStats.mockReturnValue({ data: undefined, isLoading: true });
    mockSLAStats.mockReturnValue({ data: undefined, isLoading: true });
    mockVolumeStats.mockReturnValue({ data: undefined, isLoading: false });
    mockCommitmentStats.mockReturnValue({ data: undefined, isLoading: false });
    mockDQScore.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('formats DQ Score to 1 decimal place', () => {
    mockDQScore.mockReturnValue({ data: { overallScore: 98.61538461538461 }, isLoading: false });
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText('98.6%')).toBeInTheDocument();
    expect(screen.queryByText(/98\.615/)).not.toBeInTheDocument();
  });

  it('does NOT show banner when any data is available', () => {
    mockCaseStats.mockReturnValue({ data: CASE_STATS, isLoading: false });
    mockSLAStats.mockReturnValue({ data: undefined, isLoading: false });
    mockVolumeStats.mockReturnValue({ data: undefined, isLoading: false });
    mockCommitmentStats.mockReturnValue({ data: undefined, isLoading: false });
    mockDQScore.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
