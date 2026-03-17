import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ServiceHealthDashboard from '../ServiceHealthDashboard';

// Mock useServiceHealth at the hook level (acceptable for component rendering tests)
const mockUseServiceHealth = vi.fn();
vi.mock('@/hooks/useServiceHealth', () => ({
  useServiceHealth: () => mockUseServiceHealth(),
}));

const HEALTHY_DATA = {
  timestamp: '2026-03-17T00:00:00Z',
  overall: 'healthy' as const,
  services: {
    casemanagement: {
      status: 'ok' as const,
      service: 'casemanagement',
      version: '1.0.0',
      uptime: '2d 3h',
      uptime_sec: 183600,
      started_at: '2026-03-15T00:00:00Z',
      requests: {
        total: 100,
        errors_4xx: 0,
        errors_5xx: 0,
        avg_latency_ms: 12,
        p95_latency_ms: 30,
      },
      runtime: { goroutines: 10, heap_alloc_mb: 50, heap_sys_mb: 100, gc_pause_ms_avg: 1 },
      db: {
        max_open: 20,
        open: 5,
        in_use: 3,
        idle: 2,
        wait_count: 0,
        wait_duration_ms: 0,
        utilization_pct: 25,
      },
    },
  },
  unreachable: [],
};

describe('ServiceHealthDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary stats section with expected labels', () => {
    mockUseServiceHealth.mockReturnValue({ data: HEALTHY_DATA, isLoading: false, isError: false });
    renderWithProviders(<ServiceHealthDashboard />);

    expect(screen.getByText('Total Services')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    // "Platform Completion" appears in both summary stats and FeatureBurndown
    const completionLabels = screen.getAllByText('Platform Completion');
    expect(completionLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeletons when health data is loading', () => {
    mockUseServiceHealth.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = renderWithProviders(<ServiceHealthDashboard />);

    // Loading state renders 6 skeleton divs with animate-pulse
    const skeletons = container.querySelectorAll('.animate-pulse.h-32');
    expect(skeletons.length).toBe(6);
  });

  it('shows graceful degradation banner when health API errors', () => {
    mockUseServiceHealth.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<ServiceHealthDashboard />);

    expect(screen.getByText(/Health monitoring unavailable/)).toBeInTheDocument();
  });

  it('renders ServiceMapLayers section', () => {
    mockUseServiceHealth.mockReturnValue({ data: HEALTHY_DATA, isLoading: false, isError: false });
    renderWithProviders(<ServiceHealthDashboard />);

    expect(screen.getByText('Four-Layer Architecture')).toBeInTheDocument();
  });

  it('renders FeatureBurndown section', () => {
    mockUseServiceHealth.mockReturnValue({ data: HEALTHY_DATA, isLoading: false, isError: false });
    renderWithProviders(<ServiceHealthDashboard />);

    expect(screen.getByText('Feature Burndown')).toBeInTheDocument();
    // "Platform Completion" appears in both summary stats and FeatureBurndown
    const completionLabels = screen.getAllByText('Platform Completion');
    expect(completionLabels.length).toBeGreaterThanOrEqual(2);
  });
});
