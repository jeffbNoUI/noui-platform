import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RulesExplorer from '../RulesExplorer';
import type { RuleDefinition } from '@/types/Rules';

const mockUseRuleDefinitions = vi.fn();
vi.mock('@/hooks/useRuleDefinitions', () => ({
  useRuleDefinitions: (...args: unknown[]) => mockUseRuleDefinitions(...args),
}));

const mockUseTestReport = vi.fn();
vi.mock('@/hooks/useTestReport', () => ({
  useTestReport: (...args: unknown[]) => mockUseTestReport(...args),
}));

const MOCK_RULES: RuleDefinition[] = [
  {
    id: 'RULE-ELG-01',
    name: 'Normal Retirement',
    domain: 'eligibility',
    description: 'Age 65 with 5 years service',
    sourceReference: { document: 'RMC', section: '§18-401', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [{ name: 'age', type: 'number', description: 'Age' }],
    logic: {
      type: 'conditional',
      conditions: [{ condition: 'age >= 65', result: { eligible: true } }],
    },
    output: [{ field: 'eligible', type: 'boolean' }],
    dependencies: [],
    tags: ['eligibility'],
    testCases: [{ name: 'Test 1', inputs: { age: 65 }, expected: { eligible: true } }],
    governance: {
      status: 'approved',
      lastReviewed: '2026-01-01',
      reviewedBy: 'Committee',
      effectiveDate: '2026-01-01',
    },
    testStatus: { total: 2, passing: 2, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
  },
  {
    id: 'RULE-BEN-01',
    name: 'Benefit Multiplier',
    domain: 'benefit-calc',
    description: 'Tier-based multiplier lookup',
    sourceReference: { document: 'RMC', section: '§18-501', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1', 'tier_2', 'tier_3'], memberTypes: ['active'] },
    inputs: [{ name: 'tier', type: 'string', description: 'Member tier' }],
    logic: { type: 'lookup_table', table: [{ key: 'tier_1', values: { multiplier: '2.0%' } }] },
    output: [{ field: 'multiplier', type: 'number' }],
    dependencies: [],
    tags: ['benefit-calc'],
    testCases: [{ name: 'Tier 1', inputs: { tier: 'tier_1' }, expected: { multiplier: 0.02 } }],
    governance: {
      status: 'approved',
      lastReviewed: '2026-01-01',
      reviewedBy: 'Committee',
      effectiveDate: '2026-01-01',
    },
    testStatus: { total: 3, passing: 3, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
  },
];

describe('RulesExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRuleDefinitions.mockReturnValue({ data: MOCK_RULES, isLoading: false, isError: false });
    mockUseTestReport.mockReturnValue({ data: undefined });
  });

  it('shows loading state', () => {
    mockUseRuleDefinitions.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<RulesExplorer />);
    expect(screen.getByText('Loading rules...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseRuleDefinitions.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<RulesExplorer />);
    expect(screen.getByText('Failed to load rules. Please try again.')).toBeInTheDocument();
  });

  it('shows rules list when data loaded', () => {
    renderWithProviders(<RulesExplorer />);
    expect(screen.getByText('Normal Retirement')).toBeInTheDocument();
    expect(screen.getByText('Benefit Multiplier')).toBeInTheDocument();
  });

  it('shows summary bar with passing text', () => {
    renderWithProviders(<RulesExplorer />);
    // The summary bar shows "X/Y" and "passing" text
    const passingElements = screen.getAllByText('passing');
    expect(passingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('search filters rules by name', () => {
    renderWithProviders(<RulesExplorer />);
    const searchInput = screen.getByPlaceholderText(/Search rules/);
    fireEvent.change(searchInput, { target: { value: 'Multiplier' } });
    expect(screen.getByText('Benefit Multiplier')).toBeInTheDocument();
    expect(screen.queryByText('Normal Retirement')).not.toBeInTheDocument();
  });

  it('search filters rules by ID', () => {
    renderWithProviders(<RulesExplorer />);
    const searchInput = screen.getByPlaceholderText(/Search rules/);
    fireEvent.change(searchInput, { target: { value: 'RULE-ELG' } });
    expect(screen.getByText('Normal Retirement')).toBeInTheDocument();
    expect(screen.queryByText('Benefit Multiplier')).not.toBeInTheDocument();
  });
});
