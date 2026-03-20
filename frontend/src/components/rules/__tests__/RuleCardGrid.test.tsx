import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RuleCardGrid from '../RuleCardGrid';
import type { RuleDefinition } from '@/types/Rules';

function makeRule(id: string, name: string): RuleDefinition {
  return {
    id,
    name,
    domain: 'eligibility',
    description: `Description for ${name}`,
    sourceReference: { document: 'RMC', section: '§1', lastVerified: '2026-01-01' },
    appliesTo: { tiers: ['tier_1'], memberTypes: ['active'] },
    inputs: [],
    logic: { type: 'conditional', conditions: [] },
    output: [],
    dependencies: [],
    tags: [],
    testCases: [],
    governance: {
      status: 'approved',
      lastReviewed: '2026-01-01',
      reviewedBy: 'Committee',
      effectiveDate: '2026-01-01',
    },
    testStatus: { total: 2, passing: 2, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
  };
}

describe('RuleCardGrid', () => {
  it('renders a card for each rule', () => {
    const rules = [
      makeRule('RULE-VESTING', 'Vesting'),
      makeRule('RULE-NORMAL-RET', 'Normal Retirement'),
    ];
    renderWithProviders(<RuleCardGrid rules={rules} onSelectRule={vi.fn()} />);
    expect(screen.getByText('Vesting')).toBeInTheDocument();
    expect(screen.getByText('Normal Retirement')).toBeInTheDocument();
  });

  it('calls onSelectRule with rule ID when clicked', () => {
    const onSelectRule = vi.fn();
    const rules = [makeRule('RULE-VESTING', 'Vesting')];
    renderWithProviders(<RuleCardGrid rules={rules} onSelectRule={onSelectRule} />);
    fireEvent.click(screen.getByText('Vesting'));
    expect(onSelectRule).toHaveBeenCalledWith('RULE-VESTING');
  });

  it('shows empty state', () => {
    renderWithProviders(<RuleCardGrid rules={[]} onSelectRule={vi.fn()} />);
    expect(screen.getByText('No rules in this domain.')).toBeInTheDocument();
  });
});
