import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import SubmitStage from '../SubmitStage';
import { mockMember, mockCalculation, mockCalcNoDRO } from './fixtures';

describe('SubmitStage', () => {
  const baseProps = {
    member: mockMember,
    calculation: mockCalculation,
    retirementDate: '2026-04-01',
    completedStages: 6,
    totalStages: 7,
  };

  it('renders without crashing', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText('Certification Summary')).toBeInTheDocument();
  });

  it('displays member name', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
  });

  it('displays formatted retirement date', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText('April 1, 2026')).toBeInTheDocument();
  });

  it('displays tier', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
  });

  it('displays monthly benefit amount', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    // Monthly benefit = reduced_benefit = $5,206.55
    expect(screen.getByText('$5,206.55')).toBeInTheDocument();
  });

  it('displays annual benefit', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    // Annual = 5206.55 * 12 = 62478.60
    expect(screen.getByText('$62,478.60')).toBeInTheDocument();
  });

  it('shows DRO fields when DRO is present', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText('DRO — Alt Payee')).toBeInTheDocument();
    expect(screen.getByText('$1,509.90')).toBeInTheDocument();
    expect(screen.getByText('DRO — Member After')).toBeInTheDocument();
    expect(screen.getByText('$3,696.65')).toBeInTheDocument();
  });

  it('hides DRO fields when no DRO', () => {
    renderWithProviders(<SubmitStage {...baseProps} calculation={mockCalcNoDRO} />);
    expect(screen.queryByText('DRO — Alt Payee')).not.toBeInTheDocument();
  });

  it('shows IPR amount', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText('$450.00/mo')).toBeInTheDocument();
  });

  it('shows death benefit amount', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    // $5,000.00 appears in death benefit field
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
  });

  it('shows enabled Certify button when all stages complete', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    const button = screen.getByText('Certify & Submit');
    expect(button).not.toBeDisabled();
    expect(screen.getByText('Ready for Certification')).toBeInTheDocument();
  });

  it('shows RMC reference when all stages complete', () => {
    renderWithProviders(<SubmitStage {...baseProps} />);
    expect(screen.getByText(/RMC § 18-601/)).toBeInTheDocument();
  });

  it('shows disabled Certify button when stages incomplete', () => {
    renderWithProviders(<SubmitStage {...baseProps} completedStages={4} />);
    const button = screen.getByText('Certify & Submit');
    expect(button).toBeDisabled();
    expect(screen.getByText('Complete All Stages First')).toBeInTheDocument();
  });

  it('shows incomplete stages warning with count', () => {
    renderWithProviders(<SubmitStage {...baseProps} completedStages={3} />);
    expect(screen.getByText('Incomplete Stages')).toBeInTheDocument();
    // totalStages - 1 - completedStages = 7 - 1 - 3 = 3 stages pending
    expect(screen.getByText(/3 stage\(s\) still pending/)).toBeInTheDocument();
  });

  it('handles null member gracefully', () => {
    renderWithProviders(<SubmitStage {...baseProps} member={null} />);
    expect(screen.getByText('Certification Summary')).toBeInTheDocument();
  });

  it('handles null calculation gracefully', () => {
    renderWithProviders(<SubmitStage {...baseProps} calculation={null} />);
    expect(screen.getByText('Certification Summary')).toBeInTheDocument();
  });
});
