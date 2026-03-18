import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaymentOptionStage from '../PaymentOptionStage';
import type { PaymentOptionResult } from '@/types/MemberPortal';

const OPTIONS = [
  {
    id: 'life_only',
    label: 'Life Only',
    description: 'Highest monthly payment.',
    has_survivor: false,
  },
  {
    id: 'joint_50',
    label: 'Joint & 50% Survivor',
    description: '50% survivor.',
    has_survivor: true,
    survivor_pct: 50,
  },
  {
    id: 'joint_75',
    label: 'Joint & 75% Survivor',
    description: '75% survivor.',
    has_survivor: true,
    survivor_pct: 75,
  },
  {
    id: 'joint_100',
    label: 'Joint & 100% Survivor',
    description: '100% survivor.',
    has_survivor: true,
    survivor_pct: 100,
  },
];

const AMOUNTS: PaymentOptionResult[] = [
  { option_id: 'life_only', member_amount: 3250, survivor_amount: 0 },
  { option_id: 'joint_50', member_amount: 2900, survivor_amount: 1450 },
  { option_id: 'joint_75', member_amount: 2700, survivor_amount: 2025 },
  { option_id: 'joint_100', member_amount: 2500, survivor_amount: 2500 },
];

function defaultProps(overrides: Partial<Parameters<typeof PaymentOptionStage>[0]> = {}) {
  return {
    options: OPTIONS,
    amounts: AMOUNTS,
    selectedOption: null,
    onSelect: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

describe('PaymentOptionStage', () => {
  it('renders all 4 payment options', () => {
    render(<PaymentOptionStage {...defaultProps()} />);

    expect(screen.getByTestId('option-life_only')).toHaveTextContent('Life Only');
    expect(screen.getByTestId('option-joint_50')).toHaveTextContent('Joint & 50%');
    expect(screen.getByTestId('option-joint_75')).toHaveTextContent('Joint & 75%');
    expect(screen.getByTestId('option-joint_100')).toHaveTextContent('Joint & 100%');
  });

  it('shows member and survivor amounts', () => {
    render(<PaymentOptionStage {...defaultProps()} />);

    expect(screen.getByTestId('amounts-life_only')).toHaveTextContent('$3,250');
    expect(screen.getByTestId('amounts-joint_50')).toHaveTextContent('$2,900');
    expect(screen.getByTestId('amounts-joint_50')).toHaveTextContent(/Survivor:.*\$1,450/);
  });

  it('calls onSelect when an option is clicked', () => {
    const onSelect = vi.fn();
    render(<PaymentOptionStage {...defaultProps({ onSelect })} />);

    fireEvent.click(screen.getByTestId('option-joint_50'));
    expect(onSelect).toHaveBeenCalledWith({
      option_id: 'joint_50',
      option_label: 'Joint & 50% Survivor',
      member_amount: 2900,
      survivor_amount: 1450,
    });
  });

  it('disables continue when no option is selected', () => {
    render(<PaymentOptionStage {...defaultProps()} />);

    expect(screen.getByTestId('continue-button')).toBeDisabled();
  });

  it('enables continue when an option is selected', () => {
    const selection = {
      option_id: 'life_only',
      option_label: 'Life Only',
      member_amount: 3250,
      survivor_amount: 0,
    };
    render(<PaymentOptionStage {...defaultProps({ selectedOption: selection })} />);

    expect(screen.getByTestId('continue-button')).not.toBeDisabled();
  });

  it('shows beneficiary info when provided', () => {
    render(
      <PaymentOptionStage
        {...defaultProps({ beneficiaryName: 'Maria Martinez', beneficiaryAge: 60 })}
      />,
    );

    expect(screen.getByTestId('beneficiary-info')).toHaveTextContent('Maria Martinez');
    expect(screen.getByTestId('beneficiary-info')).toHaveTextContent('age 60');
  });

  it('shows permanence warning', () => {
    render(<PaymentOptionStage {...defaultProps()} />);

    expect(screen.getByTestId('permanence-warning')).toHaveTextContent('cannot be changed');
  });

  it('shows bounce-back message when provided', () => {
    render(
      <PaymentOptionStage
        {...defaultProps({ bounceMessage: 'Beneficiary changed — please re-select.' })}
      />,
    );

    expect(screen.getByTestId('bounce-message')).toHaveTextContent('re-select');
  });

  it('highlights selected option', () => {
    const selection = {
      option_id: 'joint_75',
      option_label: 'Joint & 75% Survivor',
      member_amount: 2700,
      survivor_amount: 2025,
    };
    render(<PaymentOptionStage {...defaultProps({ selectedOption: selection })} />);

    expect(screen.getByTestId('option-joint_75')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('option-life_only')).toHaveAttribute('aria-checked', 'false');
  });
});
