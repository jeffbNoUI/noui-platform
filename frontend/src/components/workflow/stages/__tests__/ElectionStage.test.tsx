import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ElectionStage from '../ElectionStage';
import { mockMember, mockCalculation, mockMemberTier3 } from './fixtures';

describe('ElectionStage', () => {
  it('renders without crashing with valid props', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText('Payment Option')).toBeInTheDocument();
  });

  it('renders all four payment options from buildPaymentOptions()', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText('Maximum (Single Life)')).toBeInTheDocument();
    expect(screen.getByText('100% Joint & Survivor')).toBeInTheDocument();
    expect(screen.getByText('75% Joint & Survivor')).toBeInTheDocument();
    expect(screen.getByText('50% Joint & Survivor')).toBeInTheDocument();
  });

  it('shows correct amounts from payment options', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    // Maximum = $5,206.55
    expect(screen.getByText('$5,206.55')).toBeInTheDocument();
    // J&S 100% member = $4,607.80
    expect(screen.getByText('$4,607.80')).toBeInTheDocument();
    // J&S 75% member = $4,764.50
    expect(screen.getByText('$4,764.50')).toBeInTheDocument();
  });

  it('shows survivor amounts for J&S options', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    // J&S 100% survivor = $4,607.80
    expect(screen.getByText(/Survivor: \$4,607\.80/)).toBeInTheDocument();
    // J&S 75% survivor = $3,573.37
    expect(screen.getByText(/Survivor: \$3,573\.37/)).toBeInTheDocument();
  });

  it('shows factors for each option', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText(/Factor: 1\.0000/)).toBeInTheDocument();
    expect(screen.getByText(/Factor: 0\.8850/)).toBeInTheDocument();
    expect(screen.getByText(/Factor: 0\.9150/)).toBeInTheDocument();
    expect(screen.getByText(/Factor: 0\.9450/)).toBeInTheDocument();
  });

  it('defaults to 75% J&S selected', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    // The j75 option should be selected (shown by filled circle ●)
    const j75Label = screen.getByText('75% Joint & Survivor');
    const j75Row = j75Label.closest('[class*="cursor-pointer"]')!;
    // Selected row has sage border
    expect(j75Row.className).toContain('border-iw-sage');
  });

  it('shows spousal consent warning for married member selecting Maximum', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    // Click Maximum option — fireEvent.click bubbles to the onClick handler
    fireEvent.click(screen.getByText('Maximum (Single Life)'));
    expect(screen.getByText('Spousal Consent Required')).toBeInTheDocument();
    expect(screen.getByText(/Spousal Consent Waiver/)).toBeInTheDocument();
  });

  it('does not show spousal consent for single member selecting Maximum', () => {
    renderWithProviders(<ElectionStage member={mockMemberTier3} calculation={mockCalculation} />);
    // mockMemberTier3 has marital_status: 'S'
    fireEvent.click(screen.getByText('Maximum (Single Life)'));
    expect(screen.queryByText('Spousal Consent Required')).not.toBeInTheDocument();
  });

  it('shows survivor info callout for married member with J&S', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    // Default selection is j75, member is married
    expect(screen.getByText(/Spouse will receive 75% of the member's benefit/)).toBeInTheDocument();
  });

  it('renders death benefit election section', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText('Death Benefit Election')).toBeInTheDocument();
    expect(screen.getByText('Lump Sum')).toBeInTheDocument();
    expect(screen.getByText('Monthly Installments')).toBeInTheDocument();
  });

  it('shows death benefit amounts', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00/mo')).toBeInTheDocument();
  });

  it('renders IPR section with amounts', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText('Insurance Premium Reduction (IPR)')).toBeInTheDocument();
    expect(screen.getByText('Enroll in IPR')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
    expect(screen.getByText('$225.00')).toBeInTheDocument();
  });

  it('shows IPR callout with earned service years and legal reference', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={mockCalculation} />);
    expect(screen.getByText(/27\.75 years of earned service/)).toBeInTheDocument();
    expect(screen.getByText(/RMC § 18-502/)).toBeInTheDocument();
  });

  it('renders fallback options when calculation has no payment_options', () => {
    renderWithProviders(<ElectionStage member={mockMember} calculation={{}} />);
    // Should still show all 4 options with zero amounts
    expect(screen.getByText('Maximum (Single Life)')).toBeInTheDocument();
    expect(screen.getByText('100% Joint & Survivor')).toBeInTheDocument();
    expect(screen.getByText('75% Joint & Survivor')).toBeInTheDocument();
    expect(screen.getByText('50% Joint & Survivor')).toBeInTheDocument();
  });
});
