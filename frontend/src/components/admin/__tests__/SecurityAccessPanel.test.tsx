import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import SecurityAccessPanel from '../SecurityAccessPanel';

describe('SecurityAccessPanel', () => {
  it('renders role definitions table with all 5 roles', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('employer')).toBeInTheDocument();
    expect(screen.getByText('vendor')).toBeInTheDocument();
  });

  it('renders access matrix section', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText(/access matrix/i)).toBeInTheDocument();
  });

  it('shows portal names in access matrix', () => {
    renderWithProviders(<SecurityAccessPanel />);
    // Look for portal column headers in the matrix (formatted labels)
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Retirement App')).toBeInTheDocument();
  });

  it('renders summary stats', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText('Roles Defined')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows Phase B coming soon notice for security events', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText(/security events/i)).toBeInTheDocument();
  });
});
