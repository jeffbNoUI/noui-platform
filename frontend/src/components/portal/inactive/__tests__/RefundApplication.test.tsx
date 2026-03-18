import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RefundApplication from '../RefundApplication';

const mockMember = {
  member_id: 10003,
  first_name: 'Sarah',
  last_name: 'Chen',
  dob: '1975-06-15',
  hire_date: '2005-03-01',
  status_code: 'inactive',
  current_salary: 72000,
  earned_service_years: 12.5,
  purchased_service_years: 0,
  military_service_years: 0,
  tier: 2,
  beneficiary_count: 1,
};

let memberData: typeof mockMember | undefined = mockMember;
let memberLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: memberData,
    isLoading: memberLoading,
    error: null,
  }),
}));

const mockEstimate = {
  employee_contributions: 45000,
  interest: 8500,
  total: 53500,
};

let estimateData: typeof mockEstimate | undefined = mockEstimate;

vi.mock('@/hooks/useRefundEstimate', () => ({
  useRefundEstimate: () => ({
    data: estimateData,
    isLoading: false,
    error: null,
  }),
}));

describe('RefundApplication', () => {
  beforeEach(() => {
    memberData = mockMember;
    memberLoading = false;
    estimateData = mockEstimate;
  });

  it('renders stage tracker with 5 stages', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    const tracker = screen.getByTestId('refund-stage-tracker');
    expect(tracker).toBeTruthy();
    expect(tracker.textContent).toContain('Verify Info');
    expect(tracker.textContent).toContain('Distribution');
    expect(tracker.textContent).toContain('Review');
    expect(tracker.textContent).toContain('Acknowledge');
    expect(tracker.textContent).toContain('Processing');
  });

  it('shows verify info stage initially', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    expect(screen.getByTestId('verify-info-stage')).toBeTruthy();
    expect(screen.queryByTestId('distribution-stage')).toBeNull();
  });

  it('shows member info in verify stage', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    const stage = screen.getByTestId('verify-info-stage');
    expect(stage.textContent).toContain('Sarah');
    expect(stage.textContent).toContain('Chen');
    expect(stage.textContent).toContain('#10003');
  });

  it('advances to distribution stage on continue', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    fireEvent.click(screen.getByTestId('continue-button'));
    expect(screen.getByTestId('distribution-stage')).toBeTruthy();
    expect(screen.queryByTestId('verify-info-stage')).toBeNull();
  });

  it('distribution choice required to advance', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    // Advance to distribution stage
    fireEvent.click(screen.getByTestId('continue-button'));
    expect(screen.getByTestId('distribution-stage')).toBeTruthy();
    // Continue button should be disabled without a selection
    const continueBtn = screen.getByTestId('continue-button');
    expect(continueBtn).toHaveProperty('disabled', true);
  });

  it('selects distribution and advances to review', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    // Go to distribution
    fireEvent.click(screen.getByTestId('continue-button'));
    // Select rollover
    fireEvent.click(screen.getByTestId('choice-rollover'));
    // Continue should now be enabled
    const continueBtn = screen.getByTestId('continue-button');
    expect(continueBtn).toHaveProperty('disabled', false);
    fireEvent.click(continueBtn);
    // Should now be on review stage
    expect(screen.getByTestId('review-stage')).toBeTruthy();
  });

  it('review stage shows correct amounts', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    // Navigate to review: verify -> distribution -> review
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('choice-withholding'));
    fireEvent.click(screen.getByTestId('continue-button'));
    const review = screen.getByTestId('review-stage');
    // Total: $53,500
    expect(review.textContent).toContain('$53,500');
    // Net with 20% withheld: $42,800
    expect(review.textContent).toContain('$42,800');
  });

  it('acknowledge stage requires both checkboxes', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    // Navigate to acknowledge: verify -> distribution -> review -> acknowledge
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('choice-rollover'));
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('continue-button'));
    expect(screen.getByTestId('acknowledge-stage')).toBeTruthy();
    // Submit should be disabled with no checkboxes
    const submitBtn = screen.getByTestId('submit-refund');
    expect(submitBtn).toHaveProperty('disabled', true);
    // Check only one checkbox
    const ackForfeiture = screen.getByTestId('ack-forfeiture').querySelector('input');
    fireEvent.click(ackForfeiture!);
    expect(submitBtn).toHaveProperty('disabled', true);
  });

  it('submits when both acknowledgments checked', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    // Navigate to acknowledge
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('choice-rollover'));
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('continue-button'));
    // Check both
    const ackForfeiture = screen.getByTestId('ack-forfeiture').querySelector('input');
    const ackTax = screen.getByTestId('ack-tax').querySelector('input');
    fireEvent.click(ackForfeiture!);
    fireEvent.click(ackTax!);
    // Submit should be enabled
    const submitBtn = screen.getByTestId('submit-refund');
    expect(submitBtn).toHaveProperty('disabled', false);
    fireEvent.click(submitBtn);
    // Should now be on processing stage
    expect(screen.getByTestId('processing-stage')).toBeTruthy();
  });

  it('shows application ID in processing stage', () => {
    renderWithProviders(<RefundApplication memberId={10003} />);
    // Navigate to processing
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('choice-rollover'));
    fireEvent.click(screen.getByTestId('continue-button'));
    fireEvent.click(screen.getByTestId('continue-button'));
    const ackForfeiture = screen.getByTestId('ack-forfeiture').querySelector('input');
    const ackTax = screen.getByTestId('ack-tax').querySelector('input');
    fireEvent.click(ackForfeiture!);
    fireEvent.click(ackTax!);
    fireEvent.click(screen.getByTestId('submit-refund'));
    const processing = screen.getByTestId('processing-stage');
    expect(processing.textContent).toContain('REF-');
    expect(processing.textContent).toContain('Under Review');
  });
});
