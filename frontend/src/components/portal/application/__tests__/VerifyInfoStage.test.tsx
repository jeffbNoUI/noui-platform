import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VerifyInfoStage from '../VerifyInfoStage';
import type { VerificationItem } from '@/types/RetirementApplication';

const SAMPLE_ITEMS: VerificationItem[] = [
  {
    field_name: 'legal_name',
    label: 'Legal Name',
    current_value: 'Robert Martinez',
    category: 'personal',
    verified: null,
  },
  {
    field_name: 'date_of_birth',
    label: 'Date of Birth',
    current_value: '1962-03-15',
    category: 'personal',
    verified: null,
  },
  {
    field_name: 'employer',
    label: 'Employer',
    current_value: 'Retirement Plan',
    category: 'employment',
    verified: null,
  },
  {
    field_name: 'hire_date',
    label: 'Hire Date',
    current_value: '2000-09-01',
    category: 'employment',
    verified: null,
  },
  {
    field_name: 'spouse',
    label: 'Spouse',
    current_value: 'Maria Martinez',
    category: 'beneficiary',
    verified: null,
  },
];

function defaultProps(overrides: Partial<Parameters<typeof VerifyInfoStage>[0]> = {}) {
  return {
    items: SAMPLE_ITEMS,
    onItemVerified: vi.fn(),
    onItemFlagged: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

describe('VerifyInfoStage', () => {
  it('renders all verification items grouped by category', () => {
    render(<VerifyInfoStage {...defaultProps()} />);

    expect(screen.getByTestId('category-personal')).toHaveTextContent('Personal Information');
    expect(screen.getByTestId('category-employment')).toHaveTextContent('Employment History');
    expect(screen.getByTestId('category-beneficiary')).toHaveTextContent('Beneficiaries');

    expect(screen.getByTestId('item-legal_name')).toBeInTheDocument();
    expect(screen.getByTestId('item-employer')).toBeInTheDocument();
    expect(screen.getByTestId('item-spouse')).toBeInTheDocument();
  });

  it('shows current values for each item', () => {
    render(<VerifyInfoStage {...defaultProps()} />);

    expect(screen.getByTestId('item-legal_name')).toHaveTextContent('Robert Martinez');
    expect(screen.getByTestId('item-hire_date')).toHaveTextContent('2000-09-01');
  });

  it('calls onItemVerified when Correct is clicked', () => {
    const onItemVerified = vi.fn();
    render(<VerifyInfoStage {...defaultProps({ onItemVerified })} />);

    fireEvent.click(screen.getByTestId('correct-legal_name'));
    expect(onItemVerified).toHaveBeenCalledWith('legal_name', true);
  });

  it('calls onItemVerified(false) when Flag is clicked', () => {
    const onItemVerified = vi.fn();
    render(<VerifyInfoStage {...defaultProps({ onItemVerified })} />);

    fireEvent.click(screen.getByTestId('flag-legal_name'));
    expect(onItemVerified).toHaveBeenCalledWith('legal_name', false);
  });

  it('shows flag reason input when item is flagged', () => {
    const flaggedItems = SAMPLE_ITEMS.map((i) =>
      i.field_name === 'legal_name' ? { ...i, verified: false as const } : i,
    );
    render(<VerifyInfoStage {...defaultProps({ items: flaggedItems })} />);

    // Click flag to expand reason input
    fireEvent.click(screen.getByTestId('flag-legal_name'));
    expect(screen.getByTestId('reason-input-legal_name')).toBeInTheDocument();
  });

  it('calls onItemFlagged with reason when submit flag is clicked', () => {
    const onItemFlagged = vi.fn();
    const flaggedItems = SAMPLE_ITEMS.map((i) =>
      i.field_name === 'legal_name' ? { ...i, verified: false as const } : i,
    );
    render(<VerifyInfoStage {...defaultProps({ items: flaggedItems, onItemFlagged })} />);

    // Expand flag reason
    fireEvent.click(screen.getByTestId('flag-legal_name'));
    fireEvent.change(screen.getByTestId('reason-input-legal_name'), {
      target: { value: 'Name changed after marriage' },
    });
    fireEvent.click(screen.getByTestId('submit-flag-legal_name'));

    expect(onItemFlagged).toHaveBeenCalledWith('legal_name', 'Name changed after marriage');
  });

  it('disables continue button when not all items are addressed', () => {
    render(<VerifyInfoStage {...defaultProps()} />);

    const button = screen.getByTestId('continue-button');
    expect(button).toBeDisabled();
  });

  it('enables continue button when all items are addressed', () => {
    const allVerified = SAMPLE_ITEMS.map((i) => ({ ...i, verified: true as const }));
    render(<VerifyInfoStage {...defaultProps({ items: allVerified })} />);

    const button = screen.getByTestId('continue-button');
    expect(button).not.toBeDisabled();
  });

  it('calls onComplete when continue is clicked', () => {
    const onComplete = vi.fn();
    const allVerified = SAMPLE_ITEMS.map((i) => ({ ...i, verified: true as const }));
    render(<VerifyInfoStage {...defaultProps({ items: allVerified, onComplete })} />);

    fireEvent.click(screen.getByTestId('continue-button'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows progress count', () => {
    const partialItems = SAMPLE_ITEMS.map((i, idx) =>
      idx < 2 ? { ...i, verified: true as const } : i,
    );
    render(<VerifyInfoStage {...defaultProps({ items: partialItems })} />);

    expect(screen.getByText(/2 of 5 items reviewed/)).toBeInTheDocument();
  });

  it('shows flagged count when items are flagged', () => {
    const flaggedItems = SAMPLE_ITEMS.map((i) => ({ ...i, verified: false as const }));
    render(<VerifyInfoStage {...defaultProps({ items: flaggedItems })} />);

    expect(screen.getByText(/5 flagged/)).toBeInTheDocument();
  });

  it('shows bounce-back message when provided', () => {
    render(
      <VerifyInfoStage
        {...defaultProps({ bounceMessage: 'Please re-verify your date of birth.' })}
      />,
    );

    expect(screen.getByTestId('bounce-message')).toHaveTextContent(
      'Please re-verify your date of birth.',
    );
  });

  it('disables submit-flag button when reason is empty', () => {
    const flaggedItems = SAMPLE_ITEMS.map((i) =>
      i.field_name === 'legal_name' ? { ...i, verified: false as const } : i,
    );
    render(<VerifyInfoStage {...defaultProps({ items: flaggedItems })} />);

    fireEvent.click(screen.getByTestId('flag-legal_name'));
    expect(screen.getByTestId('submit-flag-legal_name')).toBeDisabled();
  });
});
