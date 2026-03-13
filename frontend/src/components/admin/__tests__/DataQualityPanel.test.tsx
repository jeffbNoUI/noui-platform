import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DataQualityPanel from '../DataQualityPanel';
import { mockDQScore, mockDQIssues } from '@/components/dashboard/__tests__/fixtures';
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
