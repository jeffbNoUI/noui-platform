// frontend/src/components/rules/__tests__/RuleCard.test.tsx
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
    description:
      'Determines if a member is eligible for normal retirement based on age and vesting status',
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
  it('renders full rule name without truncation', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    const name = screen.getByText('Normal Retirement Eligibility');
    expect(name).toBeInTheDocument();
    expect(name.className).not.toContain('truncate');
  });

  it('renders full description text', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    const desc = screen.getByText(/Determines if a member is eligible/);
    expect(desc).toBeInTheDocument();
    expect(desc.className).not.toContain('truncate');
  });

  it('renders rule ID', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByText('RULE-ELG-01')).toBeInTheDocument();
  });

  it('shows green left border when all tests pass', () => {
    const { container } = renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-l-green');
  });

  it('shows red left border when tests fail', () => {
    const rule = makeRule({
      testStatus: { total: 3, passing: 2, failing: 1, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    });
    const { container } = renderWithProviders(<RuleCard rule={rule} onClick={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-l-red');
  });

  it('shows gray left border when no tests', () => {
    const rule = makeRule({ testStatus: undefined });
    const { container } = renderWithProviders(<RuleCard rule={rule} onClick={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-l-gray');
  });

  it('renders test count badge', () => {
    renderWithProviders(<RuleCard rule={makeRule()} onClick={() => {}} />);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    renderWithProviders(<RuleCard rule={makeRule()} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
