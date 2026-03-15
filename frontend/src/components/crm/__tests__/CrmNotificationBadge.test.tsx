import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CrmNotificationBadge from '../CrmNotificationBadge';

describe('CrmNotificationBadge', () => {
  it('returns null when count is 0', () => {
    const { container } = render(<CrmNotificationBadge count={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when count is negative', () => {
    const { container } = render(<CrmNotificationBadge count={-1} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows count when positive', () => {
    render(<CrmNotificationBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ for counts over 99', () => {
    render(<CrmNotificationBadge count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
