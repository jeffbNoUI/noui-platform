import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import IntakeStage from '../IntakeStage';

describe('IntakeStage', () => {
  const baseFlags = { hasDRO: false, maritalStatus: 'S' };

  it('renders document checklist with progress', () => {
    renderWithProviders(<IntakeStage flags={baseFlags} />);
    expect(screen.getByText('Document Checklist')).toBeInTheDocument();
    // Progress counter (received/total)
    expect(screen.getByText(/\/7/)).toBeInTheDocument();
  });

  it('shows base documents for single non-DRO member', () => {
    renderWithProviders(<IntakeStage flags={baseFlags} />);
    expect(screen.getByText('Signed Retirement Application')).toBeInTheDocument();
    expect(screen.getByText('Government-Issued Photo ID')).toBeInTheDocument();
    expect(screen.getByText('Birth Certificate or Proof of Age')).toBeInTheDocument();
    expect(screen.getByText('Employment Verification Letter')).toBeInTheDocument();
    expect(screen.getByText('Final Salary Certification')).toBeInTheDocument();
    expect(screen.getByText('Direct Deposit Authorization')).toBeInTheDocument();
    expect(screen.getByText('Federal/State Tax Withholding (W-4P)')).toBeInTheDocument();
  });

  it('adds marriage documents for married member', () => {
    renderWithProviders(<IntakeStage flags={{ hasDRO: false, maritalStatus: 'M' }} />);
    expect(screen.getByText('Marriage Certificate')).toBeInTheDocument();
    expect(screen.getByText('Spousal Consent Form')).toBeInTheDocument();
    // Progress should show /9 (7 base + 2 marriage)
    expect(screen.getByText(/\/9/)).toBeInTheDocument();
  });

  it('adds DRO documents when DRO flag is set', () => {
    renderWithProviders(<IntakeStage flags={{ hasDRO: true, maritalStatus: 'S' }} />);
    expect(screen.getByText('Certified DRO Court Order')).toBeInTheDocument();
    expect(screen.getByText('QDRO Approval Letter')).toBeInTheDocument();
    expect(screen.getByText(/\/9/)).toBeInTheDocument();
  });

  it('adds both marriage and DRO documents when both apply', () => {
    renderWithProviders(<IntakeStage flags={{ hasDRO: true, maritalStatus: 'M' }} />);
    expect(screen.getByText('Marriage Certificate')).toBeInTheDocument();
    expect(screen.getByText('Certified DRO Court Order')).toBeInTheDocument();
    expect(screen.getByText(/\/11/)).toBeInTheDocument();
  });

  it('shows conditional label on marriage/DRO documents', () => {
    renderWithProviders(<IntakeStage flags={{ hasDRO: true, maritalStatus: 'M' }} />);
    const conditionalLabels = screen.getAllByText('conditional');
    // 2 marriage + 2 DRO = 4 conditional items
    expect(conditionalLabels).toHaveLength(4);
  });

  it('cycles document status on click', () => {
    renderWithProviders(<IntakeStage flags={baseFlags} />);
    // Birth cert starts as 'pending' — click cycles to 'missing'
    // fireEvent.click bubbles up to the div with onClick handler
    fireEvent.click(screen.getByText('Birth Certificate or Proof of Age'));
    expect(screen.getByText('Missing Required Documents')).toBeInTheDocument();
  });

  it('shows missing required callout when a required doc is missing', () => {
    renderWithProviders(<IntakeStage flags={baseFlags} />);
    // Click birth cert (pending → missing) — it's required
    fireEvent.click(screen.getByText('Birth Certificate or Proof of Age'));
    expect(screen.getByText('Missing Required Documents')).toBeInTheDocument();
    expect(screen.getByText(/must be obtained before certification/)).toBeInTheDocument();
  });

  it('renders with member prop (optional, unused by component)', () => {
    renderWithProviders(<IntakeStage member={{ name: 'test' }} flags={baseFlags} />);
    expect(screen.getByText('Document Checklist')).toBeInTheDocument();
  });
});
