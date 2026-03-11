import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DROStage from '../DROStage';
import { mockCalculation, mockCalcNoDRO } from './fixtures';

describe('DROStage', () => {
  it('shows empty state when no DRO data', () => {
    renderWithProviders(<DROStage calculation={mockCalcNoDRO} />);
    expect(screen.getByText('No DRO data available for this case.')).toBeInTheDocument();
  });

  it('shows empty state when calculation is null', () => {
    renderWithProviders(<DROStage calculation={undefined} />);
    expect(screen.getByText('No DRO data available for this case.')).toBeInTheDocument();
  });

  it('renders DRO warning callout when DRO exists', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    expect(screen.getByText('Domestic Relations Order Active')).toBeInTheDocument();
  });

  it('displays alternate payee name', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    expect(screen.getByText('Maria Martinez')).toBeInTheDocument();
  });

  it('displays marriage period dates', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    // Dates formatted via toLocaleDateString('en-US') — timezone can shift day by ±1
    // marriage_date: 1990-06-15, divorce_date: 2015-09-20
    expect(screen.getByText(/\d+\/\d+\/1990/)).toBeInTheDocument();
    expect(screen.getByText(/\d+\/\d+\/2015/)).toBeInTheDocument();
  });

  it('displays marital service years and total service', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    expect(screen.getByText('17.25 years')).toBeInTheDocument();
    expect(screen.getByText('29.75 years')).toBeInTheDocument();
  });

  it('shows marital fraction percentage', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    // marital_fraction = 0.58 → 58.00%
    expect(screen.getByText('58.00%')).toBeInTheDocument();
  });

  it('displays division method', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    expect(screen.getByText('Shared Interest')).toBeInTheDocument();
  });

  it('displays alt payee monthly amount', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    // alt_payee_amount = 1509.90
    expect(screen.getByText('$1,509.90')).toBeInTheDocument();
  });

  it('displays member benefit after DRO', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    // member_benefit_after_dro = 3696.65
    expect(screen.getByText('$3,696.65')).toBeInTheDocument();
  });

  it('shows DRO info callout with legal reference', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    expect(screen.getByText(/RMC § 18-420/)).toBeInTheDocument();
  });

  it('shows DRO award percentage', () => {
    renderWithProviders(<DROStage calculation={mockCalculation} />);
    // alt_payee_pct = 50 (API returns percentage, not decimal)
    expect(screen.getByText('50% of marital share')).toBeInTheDocument();
  });
});
