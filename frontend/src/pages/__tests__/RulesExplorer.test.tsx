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

// Use real rule IDs that exist in the domain mapping
const MOCK_RULES: RuleDefinition[] = [
  {
    id: 'RULE-VESTING',
    name: 'Vesting Requirements',
    domain: 'eligibility',
    description: '5 years of service required',
    sourceReference: { document: 'RMC', section: '§18-401', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [{ name: 'service_years', type: 'number', description: 'Years of service' }],
    logic: {
      type: 'conditional',
      conditions: [{ condition: 'service_years >= 5', result: { vested: true } }],
    },
    output: [{ field: 'vested', type: 'boolean' }],
    dependencies: [],
    tags: ['eligibility'],
    testCases: [{ name: 'Test 1', inputs: { service_years: 5 }, expected: { vested: true } }],
    governance: {
      status: 'approved',
      lastReviewed: '2026-01-01',
      reviewedBy: 'Committee',
      effectiveDate: '2026-01-01',
    },
    testStatus: { total: 2, passing: 2, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
  },
  {
    id: 'RULE-BENEFIT-T1',
    name: 'Tier 1 Benefit Formula',
    domain: 'benefit-calc',
    description: 'Tier 1 multiplier is 2.0%',
    sourceReference: { document: 'RMC', section: '§18-501', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
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

  it('shows domain cards at Level 1 when data loaded', () => {
    renderWithProviders(<RulesExplorer />);
    // Level 1 shows domain cards, not individual rules
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Benefits')).toBeInTheDocument();
  });

  it('shows summary bar with passing text', () => {
    renderWithProviders(<RulesExplorer />);
    const passingElements = screen.getAllByText('passing');
    expect(passingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('drills into domain to show rule cards at Level 2', () => {
    renderWithProviders(<RulesExplorer />);
    // Click the Eligibility domain card
    fireEvent.click(screen.getByText('Eligibility'));
    // Should show rule cards for that domain
    expect(screen.getByText('Vesting Requirements')).toBeInTheDocument();
    // Should show breadcrumb
    expect(screen.getByText('Rules Explorer')).toBeInTheDocument();
  });

  it('search filters domains at Level 1', () => {
    renderWithProviders(<RulesExplorer />);
    const searchInput = screen.getByPlaceholderText(/Search domains/);
    fireEvent.change(searchInput, { target: { value: 'Eligibility' } });
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.queryByText('Benefits')).not.toBeInTheDocument();
  });
});
