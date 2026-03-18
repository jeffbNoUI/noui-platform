import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffReviewView from '../StaffReviewView';
import type { StaffActivityEntry } from '@/types/RetirementApplication';

const SAMPLE_ACTIVITIES: StaffActivityEntry[] = [
  {
    id: '1',
    action: 'Verified employment history',
    performed_by: 'staff_1',
    timestamp: '2027-06-03T10:00:00Z',
  },
  {
    id: '2',
    action: 'Verified salary records',
    performed_by: 'staff_1',
    note: 'AMS confirmed at $8,500',
    timestamp: '2027-06-03T14:00:00Z',
  },
  {
    id: '3',
    action: 'Reviewed benefit calculation',
    performed_by: 'staff_1',
    timestamp: '2027-06-04T09:00:00Z',
  },
];

function defaultProps(overrides: Partial<Parameters<typeof StaffReviewView>[0]> = {}) {
  return {
    activities: SAMPLE_ACTIVITIES,
    submittedAt: '2027-06-02T12:00:00Z',
    ...overrides,
  };
}

describe('StaffReviewView', () => {
  it('renders "Application Under Review" header', () => {
    render(<StaffReviewView {...defaultProps()} />);

    expect(screen.getByText('Application Under Review')).toBeInTheDocument();
  });

  it('shows submitted date', () => {
    render(<StaffReviewView {...defaultProps()} />);

    expect(screen.getByTestId('submitted-at')).toHaveTextContent(/2027/);
  });

  it('renders activity log entries', () => {
    render(<StaffReviewView {...defaultProps()} />);

    expect(screen.getByTestId('activity-1')).toHaveTextContent('Verified employment history');
    expect(screen.getByTestId('activity-2')).toHaveTextContent('Verified salary records');
    expect(screen.getByTestId('activity-2')).toHaveTextContent('AMS confirmed at $8,500');
    expect(screen.getByTestId('activity-3')).toHaveTextContent('Reviewed benefit calculation');
  });

  it('shows empty state when no activities', () => {
    render(<StaffReviewView {...defaultProps({ activities: [] })} />);

    expect(screen.getByTestId('no-activities')).toHaveTextContent('No activity yet');
  });

  it('shows bounce-back card with message', () => {
    render(
      <StaffReviewView
        {...defaultProps({
          bounced: true,
          bounceMessage: 'Birth certificate is illegible. Please upload a clearer copy.',
          bounceStage: 'upload_docs',
        })}
      />,
    );

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByTestId('bounce-card')).toHaveTextContent('illegible');
    expect(screen.getByTestId('bounce-target')).toHaveTextContent('Upload Documents');
  });

  it('calls onResolveBounce when resolve button is clicked', () => {
    const onResolveBounce = vi.fn();
    render(
      <StaffReviewView
        {...defaultProps({
          bounced: true,
          bounceMessage: 'Fix docs',
          bounceStage: 'upload_docs',
          onResolveBounce,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('resolve-bounce-button'));
    expect(onResolveBounce).toHaveBeenCalled();
  });

  it('resolve button shows target stage label', () => {
    render(
      <StaffReviewView
        {...defaultProps({
          bounced: true,
          bounceMessage: 'Fix info',
          bounceStage: 'verify_info',
          onResolveBounce: vi.fn(),
        })}
      />,
    );

    expect(screen.getByTestId('resolve-bounce-button')).toHaveTextContent(
      'Go to Verify Your Information',
    );
  });

  it('does not show bounce card when not bounced', () => {
    render(<StaffReviewView {...defaultProps()} />);

    expect(screen.queryByTestId('bounce-card')).not.toBeInTheDocument();
  });
});
