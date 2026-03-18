import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommunicationPreferences from '../CommunicationPreferences';

// Mock the member preferences hook
const mockUpdatePreferences = vi.fn();
vi.mock('@/hooks/useMemberPreferences', () => ({
  useMemberPreferences: () => ({
    preferences: {
      communication: {
        application_received: { email: true, sms: false },
        application_status_change: { email: true, sms: true },
        document_needed: { email: true, sms: false },
      },
      sms_number: '5551234567',
      accessibility: { text_size: 'standard', high_contrast: false, reduce_motion: false },
      tour_completed: false,
      tour_version: 1,
    },
    isLoading: false,
    updatePreferences: mockUpdatePreferences,
    isSaving: false,
  }),
}));

// Mock plan profile to return known notification config
vi.mock('@/lib/planProfile', () => ({
  getPlanProfile: () => ({
    notifications: {
      channels_available: ['in_portal', 'email', 'sms'],
      always_on: ['in_portal'],
      default_email: true,
      default_sms: false,
      legally_required: ['application_status_change', 'benefit_amount_final', 'payment_issue'],
    },
    notification_templates: {
      application_received: { in_portal_title: 'Application Received' },
      application_status_change: { in_portal_title: 'Application Update' },
      document_needed: { in_portal_title: 'Document Needed' },
      benefit_amount_final: { in_portal_title: 'Benefit Finalized' },
      payment_issue: { in_portal_title: 'Payment Issue' },
    },
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('CommunicationPreferences', () => {
  beforeEach(() => {
    mockUpdatePreferences.mockClear();
  });

  it('renders the notification matrix with all template rows', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    expect(screen.getByTestId('notification-matrix')).toBeInTheDocument();
    expect(screen.getByTestId('notif-row-application_received')).toBeInTheDocument();
    expect(screen.getByTestId('notif-row-application_status_change')).toBeInTheDocument();
    expect(screen.getByTestId('notif-row-document_needed')).toBeInTheDocument();
    expect(screen.getByTestId('notif-row-benefit_amount_final')).toBeInTheDocument();
    expect(screen.getByTestId('notif-row-payment_issue')).toBeInTheDocument();
  });

  it('marks legally required items with a Required badge', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    expect(screen.getByTestId('required-badge-application_status_change')).toBeInTheDocument();
    expect(screen.getByTestId('required-badge-benefit_amount_final')).toBeInTheDocument();
    expect(screen.getByTestId('required-badge-payment_issue')).toBeInTheDocument();
    // Non-required items should not have the badge
    expect(screen.queryByTestId('required-badge-application_received')).not.toBeInTheDocument();
  });

  it('disables checkboxes for legally required notification types', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    const emailToggle = screen.getByTestId('toggle-application_status_change-email');
    const smsToggle = screen.getByTestId('toggle-application_status_change-sms');
    expect(emailToggle).toBeDisabled();
    expect(smsToggle).toBeDisabled();
  });

  it('enables checkboxes for non-required notification types', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    const emailToggle = screen.getByTestId('toggle-application_received-email');
    expect(emailToggle).not.toBeDisabled();
  });

  it('calls updatePreferences when toggling a non-required email channel', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    const emailToggle = screen.getByTestId('toggle-application_received-email');
    fireEvent.click(emailToggle);
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      communication: expect.objectContaining({
        application_received: { email: false, sms: false },
      }),
    });
  });

  it('renders SMS opt-in section with saved number', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    expect(screen.getByTestId('sms-opt-in')).toBeInTheDocument();
    expect(screen.getByTestId('sms-number-input')).toBeInTheDocument();
  });

  it('saves SMS number when changed and save clicked', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    const input = screen.getByTestId('sms-number-input');
    fireEvent.change(input, { target: { value: '5559876543' } });
    const saveBtn = screen.getByTestId('sms-save-btn');
    fireEvent.click(saveBtn);
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ sms_number: '5559876543' });
  });

  it('in-portal checkboxes are always checked and disabled', () => {
    renderWithQuery(<CommunicationPreferences memberId="123" />);
    const inPortalCheckboxes = screen.getAllByRole('checkbox', { name: /in-portal/i });
    inPortalCheckboxes.forEach((cb) => {
      expect(cb).toBeChecked();
      expect(cb).toBeDisabled();
    });
  });
});
