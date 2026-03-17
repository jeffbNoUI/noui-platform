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
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assigned/i)).toBeInTheDocument();
  });

  it('filters by category', () => {
    renderWithProviders(<IssueManagementPanel />);
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'enhancement' } });
    // Only ISS-039 is an enhancement
    expect(screen.getByText('ISS-039')).toBeInTheDocument();
    expect(screen.queryByText('ISS-042')).not.toBeInTheDocument();
  });

  it('filters by assigned', () => {
    renderWithProviders(<IssueManagementPanel />);
    fireEvent.change(screen.getByLabelText(/assigned/i), { target: { value: 'jsmith' } });
    // ISS-042 and ISS-038 are assigned to jsmith
    expect(screen.getByText('ISS-042')).toBeInTheDocument();
    expect(screen.getByText('ISS-038')).toBeInTheDocument();
    expect(screen.queryByText('ISS-039')).not.toBeInTheDocument();
  });

  it('expands issue to show detail via button role', () => {
    renderWithProviders(<IssueManagementPanel />);
    const issueButtons = screen.getAllByRole('button');
    // Find the first issue row button (contains ISS- text)
    const firstIssueBtn = issueButtons.find((btn) => btn.textContent?.includes('ISS-'));
    expect(firstIssueBtn).toBeDefined();
    fireEvent.click(firstIssueBtn!);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('shows demo data notice', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByText(/demo data/i)).toBeInTheDocument();
  });
});
