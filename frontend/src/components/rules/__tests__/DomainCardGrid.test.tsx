// frontend/src/components/rules/__tests__/DomainCardGrid.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DomainCardGrid from '../DomainCardGrid';
import type { RuleDefinition } from '@/types/Rules';

function makeRule(id: string, overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id,
    name: `Rule ${id}`,
    domain: 'eligibility',
    description: 'Test rule',
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
    testStatus: { total: 3, passing: 3, failing: 0, skipped: 0, lastRun: '2026-03-19T14:30:00Z' },
    ...overrides,
  };
}

describe('DomainCardGrid', () => {
  it('renders a card for each domain with rules', () => {
    const rules = [
      makeRule('RULE-VESTING'),
      makeRule('RULE-NORMAL-RET'),
      makeRule('RULE-BENEFIT-T1'),
    ];
    renderWithProviders(<DomainCardGrid rules={rules} onSelectDomain={vi.fn()} />);
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Benefits')).toBeInTheDocument();
  });

  it('calls onSelectDomain when a card is clicked', () => {
    const onSelectDomain = vi.fn();
    const rules = [makeRule('RULE-VESTING')];
    renderWithProviders(<DomainCardGrid rules={rules} onSelectDomain={onSelectDomain} />);
    fireEvent.click(screen.getByText('Eligibility'));
    expect(onSelectDomain).toHaveBeenCalledWith('eligibility');
  });

  it('shows empty state when no rules', () => {
    renderWithProviders(<DomainCardGrid rules={[]} onSelectDomain={vi.fn()} />);
    expect(screen.getByText('No rule domains available.')).toBeInTheDocument();
  });
});
