import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ContextualHelpPanel from '../ContextualHelpPanel';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/planProfile', () => ({
  getPlanProfile: () => ({
    help_content: {
      plan_specific_terms: [
        { term: 'AMS', definition: 'Average Monthly Salary — your highest consecutive months.' },
        { term: 'Vesting', definition: 'After 5 years you are vested.' },
        { term: 'Purchased Service', definition: 'Extra service you can buy.' },
        {
          term: 'Early Retirement Reduction',
          definition: 'Benefit reduction for early retirement.',
        },
        {
          term: 'Rule of 75',
          definition: 'Age + service = 75',
          applies_to_tiers: ['tier_1', 'tier_2'],
        },
        { term: 'Rule of 85', definition: 'Age + service = 85', applies_to_tiers: ['tier_3'] },
      ],
    },
  }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ContextualHelpPanel', () => {
  it('renders help toggle button', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" />);
    expect(screen.getByTestId('help-toggle')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('does not show content initially', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" />);
    expect(screen.queryByTestId('help-content')).not.toBeInTheDocument();
  });

  it('shows content when toggle clicked', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" />);
    fireEvent.click(screen.getByTestId('help-toggle'));
    expect(screen.getByTestId('help-content')).toBeInTheDocument();
    expect(screen.getByText('Hide Help')).toBeInTheDocument();
  });

  it('shows relevant terms for calculator section', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" />);
    fireEvent.click(screen.getByTestId('help-toggle'));
    expect(screen.getByTestId('glossary-item-ams')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-item-vesting')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-item-purchased-service')).toBeInTheDocument();
  });

  it('filters tier-specific terms for tier 1 member', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" memberTier="tier_1" />);
    fireEvent.click(screen.getByTestId('help-toggle'));
    expect(screen.getByTestId('glossary-item-rule-of-75')).toBeInTheDocument();
    expect(screen.queryByTestId('glossary-item-rule-of-85')).not.toBeInTheDocument();
  });

  it('filters tier-specific terms for tier 3 member', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" memberTier="tier_3" />);
    fireEvent.click(screen.getByTestId('help-toggle'));
    expect(screen.getByTestId('glossary-item-rule-of-85')).toBeInTheDocument();
    expect(screen.queryByTestId('glossary-item-rule-of-75')).not.toBeInTheDocument();
  });

  it('hides content when toggle clicked again', () => {
    renderWithProviders(<ContextualHelpPanel sectionId="calculator" />);
    fireEvent.click(screen.getByTestId('help-toggle'));
    expect(screen.getByTestId('help-content')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('help-toggle'));
    expect(screen.queryByTestId('help-content')).not.toBeInTheDocument();
  });

  it('returns null for unknown section with no terms', () => {
    const { container } = renderWithProviders(<ContextualHelpPanel sectionId="unknown-section" />);
    expect(
      container.querySelector('[data-testid="contextual-help-panel"]'),
    ).not.toBeInTheDocument();
  });
});
