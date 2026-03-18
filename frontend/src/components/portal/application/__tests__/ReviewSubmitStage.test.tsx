import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewSubmitStage from '../ReviewSubmitStage';
import { DEFAULT_ACKNOWLEDGMENTS, ALL_STAGES } from '@/lib/applicationStateMachine';
import type { RetirementApplicationState, Acknowledgment } from '@/types/RetirementApplication';

function makeApplication(
  overrides: Partial<RetirementApplicationState> = {},
): RetirementApplicationState {
  return {
    member_id: 10001,
    status: 'in_progress',
    current_stage: 'review_submit',
    retirement_date: '2027-06-01',
    stages: ALL_STAGES.map((stage) => ({ stage, status: 'complete' as const })),
    verification_items: [
      {
        field_name: 'name',
        label: 'Name',
        current_value: 'Robert',
        category: 'personal',
        verified: true,
      },
      {
        field_name: 'dob',
        label: 'DOB',
        current_value: '1962-03-15',
        category: 'personal',
        verified: true,
      },
    ],
    required_documents: [
      { document_type: 'proof_of_age', label: 'Proof of Age', required: true, uploaded: true },
      { document_type: 'direct_deposit', label: 'Direct Deposit', required: true, uploaded: true },
    ],
    benefit_estimate: {
      monthly_benefit: 3250,
      eligibility_type: 'NORMAL',
      ams: 8500,
      base_benefit: 3250,
      service_years: 25,
      reduction_pct: 0,
      payment_options: [],
    },
    payment_selection: {
      option_id: 'joint_50',
      option_label: 'Joint & 50% Survivor',
      member_amount: 2900,
      survivor_amount: 1450,
    },
    acknowledgments: DEFAULT_ACKNOWLEDGMENTS.map((a) => ({ ...a })),
    ...overrides,
  };
}

function defaultProps(overrides: Partial<Parameters<typeof ReviewSubmitStage>[0]> = {}) {
  const app = makeApplication();
  return {
    application: app,
    acknowledgments: app.acknowledgments,
    onAcknowledgmentChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
}

describe('ReviewSubmitStage', () => {
  it('renders summary of all completed stages', () => {
    render(<ReviewSubmitStage {...defaultProps()} />);

    expect(screen.getByTestId('summary-retirement-date')).toHaveTextContent(/2027/);
    expect(screen.getByTestId('summary-verification')).toHaveTextContent('2 items confirmed');
    expect(screen.getByTestId('summary-documents')).toHaveTextContent('2 of 2 documents');
    expect(screen.getByTestId('summary-benefit')).toHaveTextContent('$3,250');
    expect(screen.getByTestId('summary-payment')).toHaveTextContent('Joint & 50% Survivor');
  });

  it('shows payment option with survivor amount', () => {
    render(<ReviewSubmitStage {...defaultProps()} />);

    expect(screen.getByTestId('summary-payment')).toHaveTextContent(/Survivor.*\$1,450/);
  });

  it('shows flagged items count in verification summary', () => {
    const app = makeApplication({
      verification_items: [
        {
          field_name: 'name',
          label: 'Name',
          current_value: 'Robert',
          category: 'personal',
          verified: true,
        },
        {
          field_name: 'dob',
          label: 'DOB',
          current_value: '1962-03-15',
          category: 'personal',
          verified: false,
          flag_reason: 'Wrong',
        },
      ],
    });
    render(<ReviewSubmitStage {...defaultProps({ application: app })} />);

    expect(screen.getByTestId('summary-verification')).toHaveTextContent('1 items flagged');
  });

  it('renders acknowledgment checkboxes', () => {
    render(<ReviewSubmitStage {...defaultProps()} />);

    expect(screen.getByTestId('ack-info_accurate')).toBeInTheDocument();
    expect(screen.getByTestId('ack-irrevocable')).toBeInTheDocument();
  });

  it('calls onAcknowledgmentChange when checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<ReviewSubmitStage {...defaultProps({ onAcknowledgmentChange: onChange })} />);

    fireEvent.click(screen.getByTestId('checkbox-info_accurate'));
    expect(onChange).toHaveBeenCalledWith('info_accurate', true);
  });

  it('disables submit when acknowledgments are not all checked', () => {
    render(<ReviewSubmitStage {...defaultProps()} />);

    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('enables submit when all acknowledgments are checked', () => {
    const checked: Acknowledgment[] = DEFAULT_ACKNOWLEDGMENTS.map((a) => ({ ...a, checked: true }));
    render(<ReviewSubmitStage {...defaultProps({ acknowledgments: checked })} />);

    expect(screen.getByTestId('submit-button')).not.toBeDisabled();
  });

  it('calls onSubmit when submit is clicked', () => {
    const onSubmit = vi.fn();
    const checked: Acknowledgment[] = DEFAULT_ACKNOWLEDGMENTS.map((a) => ({ ...a, checked: true }));
    render(<ReviewSubmitStage {...defaultProps({ acknowledgments: checked, onSubmit })} />);

    fireEvent.click(screen.getByTestId('submit-button'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows submitting state', () => {
    const checked: Acknowledgment[] = DEFAULT_ACKNOWLEDGMENTS.map((a) => ({ ...a, checked: true }));
    render(<ReviewSubmitStage {...defaultProps({ acknowledgments: checked, submitting: true })} />);

    expect(screen.getByTestId('submit-button')).toHaveTextContent('Submitting...');
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('shows early retirement detail in benefit summary', () => {
    const app = makeApplication({
      benefit_estimate: {
        monthly_benefit: 2600,
        eligibility_type: 'EARLY',
        ams: 8500,
        base_benefit: 2954,
        service_years: 25,
        reduction_pct: 12,
        payment_options: [],
      },
    });
    render(<ReviewSubmitStage {...defaultProps({ application: app })} />);

    expect(screen.getByTestId('summary-benefit')).toHaveTextContent('Early retirement');
  });
});
