import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ExecutiveDashboard from '../ExecutiveDashboard';
import type { SLAStats } from '@/types/Case';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockSLA: SLAStats = {
  onTrack: 18,
  atRisk: 3,
  overdue: 1,
  avgProcessingDays: 3.2,
  thresholds: { urgent: 30, high: 60, standard: 90 },
};

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockSLAData: SLAStats | undefined = mockSLA;
let mockSLALoading = false;

vi.mock('@/hooks/useCaseStats', () => ({
  useSLAStats: () => ({
    data: mockSLAData,
    isLoading: mockSLALoading,
  }),
}));

vi.mock('@/lib/dqApi', () => ({
  dqAPI: {
    getScore: () =>
      Promise.resolve({
        overallScore: 96.5,
        openIssues: 4,
        criticalIssues: 2,
        resolvedIssues: 12,
      }),
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExecutiveDashboard', () => {
  beforeEach(() => {
    mockSLAData = mockSLA;
    mockSLALoading = false;
  });

  it('renders SLA-based On-Time Rate KPI', () => {
    renderWithProviders(<ExecutiveDashboard />);

    // 18 / (18+3+1) = 81.8%
    expect(screen.getByText('81.8%')).toBeInTheDocument();
  });

  it('renders Avg Processing from SLA stats', () => {
    renderWithProviders(<ExecutiveDashboard />);

    expect(screen.getByText('3.2d')).toBeInTheDocument();
  });

  it('renders SLA health breakdown bar', () => {
    renderWithProviders(<ExecutiveDashboard />);

    expect(screen.getByText('SLA Health Breakdown')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows SLA sub-text with threshold details', () => {
    renderWithProviders(<ExecutiveDashboard />);

    expect(screen.getByText(/30d urgent/)).toBeInTheDocument();
  });

  it('shows loading placeholders when SLA data is loading', () => {
    mockSLALoading = true;
    mockSLAData = undefined;
    renderWithProviders(<ExecutiveDashboard />);

    // Both On-Time Rate and Avg Processing show '...' when loading
    const placeholders = screen.getAllByText('...');
    expect(placeholders.length).toBe(2);
  });

  it('renders processing volume chart', () => {
    renderWithProviders(<ExecutiveDashboard />);

    expect(screen.getByText('Processing Volume (6 months)')).toBeInTheDocument();
    expect(screen.getByText('127')).toBeInTheDocument(); // Feb value
  });

  it('renders system health section', () => {
    renderWithProviders(<ExecutiveDashboard />);

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Data Connector')).toBeInTheDocument();
    expect(screen.getByText('Rules Engine')).toBeInTheDocument();
  });
});
