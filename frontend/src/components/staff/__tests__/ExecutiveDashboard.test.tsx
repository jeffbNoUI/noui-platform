import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ExecutiveDashboard from '../ExecutiveDashboard';
import type { SLAStats, VolumeStats } from '@/types/Case';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockSLA: SLAStats = {
  onTrack: 18,
  atRisk: 3,
  overdue: 1,
  avgProcessingDays: 3.2,
  thresholds: { urgent: 30, high: 60, standard: 90 },
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockVolume: VolumeStats = {
  months: [
    { month: 'Oct', year: 2025, count: 3 },
    { month: 'Nov', year: 2025, count: 5 },
    { month: 'Dec', year: 2025, count: 2 },
    { month: 'Jan', year: 2026, count: 7 },
    { month: 'Feb', year: 2026, count: 4 },
    { month: 'Mar', year: 2026, count: 18 },
  ],
};

let mockSLAData: SLAStats | undefined = mockSLA;
let mockSLALoading = false;
let mockVolumeData: VolumeStats | undefined = mockVolume;
let mockVolumeLoading = false;

vi.mock('@/hooks/useCaseStats', () => ({
  useSLAStats: () => ({
    data: mockSLAData,
    isLoading: mockSLALoading,
  }),
  useVolumeStats: () => ({
    data: mockVolumeData,
    isLoading: mockVolumeLoading,
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
    mockVolumeData = mockVolume;
    mockVolumeLoading = false;
  });

  it('renders SLA-based On-Time Rate KPI', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    // 18 / (18+3+1) = 81.8%
    await waitFor(() => {
      expect(screen.getByText('81.8%')).toBeInTheDocument();
    });
  });

  it('renders Avg Processing from SLA stats', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText('3.2d')).toBeInTheDocument();
    });
  });

  it('renders SLA health breakdown bar', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText('SLA Health Breakdown')).toBeInTheDocument();
    });
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows SLA sub-text with threshold details', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/30d urgent/)).toBeInTheDocument();
    });
  });

  it('shows loading placeholders when SLA data is loading', async () => {
    mockSLALoading = true;
    mockSLAData = undefined;
    renderWithProviders(<ExecutiveDashboard />);

    // Both On-Time Rate and Avg Processing show '...' when loading
    await waitFor(() => {
      const placeholders = screen.getAllByText('...');
      expect(placeholders.length).toBe(2);
    });
  });

  it('renders processing volume chart from live data', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Processing Volume (6 months)')).toBeInTheDocument();
    });
    // Volume months are rendered — check for a month label
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText('Oct')).toBeInTheDocument();
  });

  it('shows empty state when no volume data', async () => {
    mockVolumeData = { months: [] };
    renderWithProviders(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No volume data available')).toBeInTheDocument();
    });
  });

  it('renders system health section', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });
    expect(screen.getByText('Data Connector')).toBeInTheDocument();
    expect(screen.getByText('Rules Engine')).toBeInTheDocument();
  });

  it('renders live DQ score after async fetch', async () => {
    renderWithProviders(<ExecutiveDashboard />);

    // After the DQ score resolves, it should show live data
    await waitFor(() => {
      expect(screen.getByText('4 open')).toBeInTheDocument();
      expect(screen.getByText(/96\.5% score/)).toBeInTheDocument();
    });
  });
});
