// frontend/src/components/rules/__tests__/DomainCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DomainCard from '../DomainCard';

describe('DomainCard', () => {
  const defaultProps = {
    domainKey: 'eligibility' as const,
    label: 'Eligibility',
    description: 'Vesting, retirement age, Rule of 75/85',
    ruleCount: 10,
    passingRules: 7,
    onClick: vi.fn(),
  };

  it('renders domain label', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
  });

  it('renders rule count', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('10 rules')).toBeInTheDocument();
  });

  it('renders description', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('Vesting, retirement age, Rule of 75/85')).toBeInTheDocument();
  });

  it('renders progress ring with percentage', () => {
    renderWithProviders(<DomainCard {...defaultProps} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    renderWithProviders(<DomainCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows singular "rule" for count of 1', () => {
    renderWithProviders(<DomainCard {...defaultProps} ruleCount={1} />);
    expect(screen.getByText('1 rule')).toBeInTheDocument();
  });
});
