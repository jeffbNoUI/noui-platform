import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import NavigationCard from '../NavigationCard';
import { C } from '@/lib/designSystem';

describe('NavigationCard', () => {
  const defaultProps = {
    icon: '◉',
    title: 'My Profile',
    tourId: 'card-profile',
    accentColor: C.sky,
    onClick: vi.fn(),
  };

  it('renders icon, title, and summary', () => {
    renderWithProviders(<NavigationCard {...defaultProps} summary="Review your info" />);

    expect(screen.getByText('◉')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('Review your info')).toBeInTheDocument();
  });

  it('sets data-tour-id and data-testid', () => {
    renderWithProviders(<NavigationCard {...defaultProps} />);

    const card = screen.getByTestId('card-profile');
    expect(card).toHaveAttribute('data-tour-id', 'card-profile');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    renderWithProviders(<NavigationCard {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('card-profile'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows badge when badgeCount > 0', () => {
    renderWithProviders(<NavigationCard {...defaultProps} badgeCount={3} />);

    expect(screen.getByTestId('badge-profile')).toBeInTheDocument();
    expect(screen.getByTestId('badge-profile')).toHaveTextContent('3');
  });

  it('hides badge when badgeCount is 0', () => {
    renderWithProviders(<NavigationCard {...defaultProps} badgeCount={0} />);

    expect(screen.queryByTestId('badge-profile')).not.toBeInTheDocument();
  });

  it('hides badge when badgeCount is undefined', () => {
    renderWithProviders(<NavigationCard {...defaultProps} />);

    expect(screen.queryByTestId('badge-profile')).not.toBeInTheDocument();
  });

  it('renders learning hint when provided', () => {
    const hint = {
      id: 'vesting',
      cardKey: 'profile',
      personas: ['active' as const],
      teaser: 'Five years makes you vested.',
      expanded: 'Vesting details...',
    };

    renderWithProviders(<NavigationCard {...defaultProps} hint={hint} />);

    expect(screen.getByTestId('hint-vesting')).toBeInTheDocument();
    expect(screen.getByText('Five years makes you vested.')).toBeInTheDocument();
  });

  it('does not render hint when hint is null', () => {
    renderWithProviders(<NavigationCard {...defaultProps} hint={null} />);

    expect(screen.queryByText('Did you know?')).not.toBeInTheDocument();
  });

  it('shows "View details" action text', () => {
    renderWithProviders(<NavigationCard {...defaultProps} />);

    expect(screen.getByText('View details')).toBeInTheDocument();
  });
});
