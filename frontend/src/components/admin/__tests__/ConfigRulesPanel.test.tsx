import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ConfigRulesPanel from '../ConfigRulesPanel';

const mockUseKBRules = vi.fn();
vi.mock('@/hooks/useKBRules', () => ({
  useKBRules: (...args: unknown[]) => mockUseKBRules(...args),
}));

// Mock FeatureBurndown to isolate this panel's tests
vi.mock('../FeatureBurndown', () => ({
  default: () => <div>Platform Completion</div>,
}));

const MOCK_RULES = [
  {
    referenceId: 'ref1',
    articleId: 'a1',
    ruleId: 'r1',
    code: 'RMC §18-401',
    description: 'Age + service >= 75, min age 55',
    domain: 'eligibility',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
  },
  {
    referenceId: 'ref2',
    articleId: 'a2',
    ruleId: 'r2',
    code: 'RMC §18-501',
    description: 'Highest 36 consecutive months',
    domain: 'benefit-calc',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
  },
  {
    referenceId: 'ref3',
    articleId: 'a3',
    ruleId: 'r3',
    code: 'RMC §18-502',
    description: '2.0% for Tier 1',
    domain: 'benefit-calc',
    sortOrder: 2,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
  },
];

describe('ConfigRulesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseKBRules.mockReturnValue({ data: MOCK_RULES, isLoading: false, isError: false });
  });

  it('renders plan provisions section', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/plan provisions/i)).toBeInTheDocument();
  });

  it('renders system parameters table', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/system parameters/i)).toBeInTheDocument();
    expect(screen.getByText(/SLA/)).toBeInTheDocument();
  });

  it('renders service catalog (FeatureBurndown)', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText('Platform Completion')).toBeInTheDocument();
  });

  it('groups rules by domain', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/eligibility/i)).toBeInTheDocument();
    expect(screen.getByText(/benefit/i)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockUseKBRules.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/system parameters/i)).toBeInTheDocument();
  });
});
