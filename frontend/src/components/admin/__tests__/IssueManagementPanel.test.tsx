import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import IssueManagementPanel from '../IssueManagementPanel';

describe('IssueManagementPanel', () => {
  it('renders summary stat cards', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByText('Open Issues')).toBeInTheDocument();
    expect(screen.getAllByText('Critical').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg Resolution')).toBeInTheDocument();
    expect(screen.getByText('Resolved (30d)')).toBeInTheDocument();
  });

  it('renders issue list with demo entries', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getAllByText(/ISS-/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows severity badges', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders filter controls', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/severity/i)).toBeInTheDocument();
  });

  it('expands issue to show detail', () => {
    renderWithProviders(<IssueManagementPanel />);
    const firstIssue = screen.getAllByText(/ISS-/)[0];
    fireEvent.click(firstIssue);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('shows demo data notice', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByText(/demo data/i)).toBeInTheDocument();
  });
});
