import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import LearningHint from '../LearningHint';

const testHint = {
  id: 'benefit-growth',
  cardKey: 'calculator',
  personas: ['active' as const],
  teaser: 'Each additional year increases your benefit.',
  expanded: 'Your DERP benefit is calculated as years of service times multiplier times salary.',
};

describe('LearningHint', () => {
  it('renders teaser text', () => {
    renderWithProviders(<LearningHint hint={testHint} />);

    expect(screen.getByText('Each additional year increases your benefit.')).toBeInTheDocument();
  });

  it('shows "Did you know?" label', () => {
    renderWithProviders(<LearningHint hint={testHint} />);

    expect(screen.getByText('Did you know?')).toBeInTheDocument();
  });

  it('shows "Learn more" toggle button', () => {
    renderWithProviders(<LearningHint hint={testHint} />);

    expect(screen.getByTestId('hint-toggle-benefit-growth')).toBeInTheDocument();
    expect(screen.getByTestId('hint-toggle-benefit-growth')).toHaveTextContent('Learn more');
  });

  it('expands to show full content on click', () => {
    renderWithProviders(<LearningHint hint={testHint} />);

    fireEvent.click(screen.getByTestId('hint-toggle-benefit-growth'));

    expect(screen.getByText(/Your DERP benefit is calculated/)).toBeInTheDocument();
    expect(screen.getByTestId('hint-toggle-benefit-growth')).toHaveTextContent('Show less');
  });

  it('collapses on second click', () => {
    renderWithProviders(<LearningHint hint={testHint} />);

    const toggle = screen.getByTestId('hint-toggle-benefit-growth');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Show less');

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Learn more');
  });

  it('sets correct data-testid from hint id', () => {
    renderWithProviders(<LearningHint hint={testHint} />);

    expect(screen.getByTestId('hint-benefit-growth')).toBeInTheDocument();
  });
});
