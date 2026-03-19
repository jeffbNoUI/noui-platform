import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DemoCasesPage from '../DemoCases';
import type { DemoCase } from '@/types/Rules';

const mockUseDemoCases = vi.fn();
const mockUseDemoCase = vi.fn();
vi.mock('@/hooks/useDemoCases', () => ({
  useDemoCases: (...args: unknown[]) => mockUseDemoCases(...args),
  useDemoCase: (...args: unknown[]) => mockUseDemoCase(...args),
}));

const MOCK_CASES: DemoCase[] = [
  {
    caseId: 'CASE-001',
    description: 'Normal retirement, leave payout',
    member: {
      memberId: 1001,
      firstName: 'Robert',
      lastName: 'Martinez',
      dob: '1960-05-15',
      hireDate: '1995-08-01',
      tier: 1,
    },
    retirementDate: '2025-06-01',
    inputs: {},
    expected: {},
    testPoints: ['Verify AMS', 'Verify benefit'],
    full: {},
  },
  {
    caseId: 'CASE-002',
    description: 'Service purchase, early retirement',
    member: {
      memberId: 1002,
      firstName: 'Jennifer',
      lastName: 'Kim',
      dob: '1970-03-22',
      hireDate: '2005-01-15',
      tier: 2,
    },
    retirementDate: '2026-01-01',
    inputs: {},
    expected: {},
    testPoints: ['Verify service credit', 'Verify reduction'],
    full: {},
  },
];

describe('DemoCasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDemoCases.mockReturnValue({ data: MOCK_CASES, isLoading: false, error: null });
    mockUseDemoCase.mockReturnValue({ data: undefined });
  });

  it('shows loading state', () => {
    mockUseDemoCases.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<DemoCasesPage initialCaseId={null} />);
    expect(screen.getByText('Loading demo cases...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseDemoCases.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    });
    renderWithProviders(<DemoCasesPage initialCaseId={null} />);
    expect(screen.getByText('Failed to load demo cases.')).toBeInTheDocument();
  });

  it('shows case cards when data loaded', () => {
    renderWithProviders(<DemoCasesPage initialCaseId={null} />);
    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    expect(screen.getByText('Jennifer Kim')).toBeInTheDocument();
  });

  it('shows page title and description', () => {
    renderWithProviders(<DemoCasesPage initialCaseId={null} />);
    expect(screen.getByText('Demo Cases')).toBeInTheDocument();
    expect(screen.getByText(/Acceptance test fixtures/)).toBeInTheDocument();
  });
});
