import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RuleCard from '../RuleCard';
import type { RuleDefinition } from '@/types/Rules';

function makeRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'RULE-ELG-01',
    name: 'Normal Retirement Eligibility',
    domain: 'eligibility',
    description: 'Age >= 65 and vested',
    sourceReference: { document: 'RMC', section: '§18-401', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [{ name: 'age', type: 'number', description: 'Age in years' }],
    logic: {
      type: 'conditional',
      conditions: [{ condition: 'age >= 65', result: { eligible: true } }],
    },
    output: [{ field: 'eligible', type: 'boolean' }],
    dependencies: [],
    tags: ['eligibility'],
    testCases: [{ name: 'Happy path', inputs: { age: 65 }, expected: { eligible: true } }],
    governance: {
      status: 'approved',
      lastReviewed: '2026-01-01',
      reviewedBy: 'Committee',
      effectiveDate: '2026-01-01',
    },
    testStatus: { total: 3, passing: 3, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    ...overrides,
  };
}

describe('RuleCard', () => {
  it('renders rule ID and name', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByText('RULE-ELG-01')).toBeInTheDocument();
    expect(screen.getByText('Normal Retirement Eligibility')).toBeInTheDocument();
  });

  it('shows pass status icon when all tests pass', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByLabelText('Passing')).toBeInTheDocument();
  });

  it('shows fail status icon when tests fail', () => {
    const rule = makeRule({
      testStatus: { total: 3, passing: 2, failing: 1, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    });
    renderWithProviders(<RuleCard rule={rule} onClick={() => {}} />);
    expect(screen.getByLabelText('Failing')).toBeInTheDocument();
  });

  it('shows no-tests icon when testStatus is undefined', () => {
    const rule = makeRule({ testStatus: undefined });
    renderWithProviders(<RuleCard rule={rule} onClick={() => {}} />);
    expect(screen.getByLabelText('No tests')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    renderWithProviders(<RuleCard rule={makeRule()} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('renders test count badge', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });
});
