import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import PersonalInfoTab from '../PersonalInfoTab';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockMember = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  middle_name: 'A',
  dob: '1968-07-15',
  gender: 'M',
  hire_date: '2000-03-15',
  tier_code: 1,
  status_code: 'A',
  marital_status: 'M',
  email: 'robert.martinez@example.com',
};

let memberData: typeof mockMember | undefined = mockMember;
let memberLoading = false;

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({ data: memberData, isLoading: memberLoading, error: null }),
}));

const mockCreate = vi.fn().mockResolvedValue({ id: 'cr-1', status: 'pending' });

vi.mock('@/lib/memberPortalApi', () => ({
  changeRequestAPI: { create: (...args: unknown[]) => mockCreate(...args) },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PersonalInfoTab', () => {
  beforeEach(() => {
    memberData = mockMember;
    memberLoading = false;
    mockCreate.mockClear();
  });

  it('renders all personal info fields', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    expect(screen.getByTestId('personal-info-tab')).toBeInTheDocument();
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Robert')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Martinez')).toBeInTheDocument();
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    memberLoading = true;
    memberData = undefined;
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    expect(screen.getByText('Loading personal information...')).toBeInTheDocument();
  });

  it('shows error state when no member data', () => {
    memberData = undefined;
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    expect(screen.getByText('Unable to load personal information.')).toBeInTheDocument();
  });

  it('shows Edit button for immediate-edit fields (email)', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    expect(screen.getByTestId('field-email-edit')).toBeInTheDocument();
  });

  it('shows Request Change button for staff-review fields (first_name)', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    expect(screen.getByTestId('field-first_name-request-change')).toBeInTheDocument();
  });

  it('does not show edit actions for readonly fields (hire_date)', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    expect(screen.queryByTestId('field-hire_date-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-hire_date-request-change')).not.toBeInTheDocument();
  });

  it('opens inline editor on Edit click', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('field-email-edit'));
    expect(screen.getByTestId('field-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('field-email-save')).toBeInTheDocument();
    expect(screen.getByTestId('field-email-cancel')).toBeInTheDocument();
  });

  it('cancels inline edit', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('field-email-edit'));
    fireEvent.click(screen.getByTestId('field-email-cancel'));
    expect(screen.queryByTestId('field-email-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-email-edit')).toBeInTheDocument();
  });

  it('opens change request form on Request Change click', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('field-first_name-request-change'));
    expect(screen.getByTestId('change-request-form')).toBeInTheDocument();
    expect(screen.getByText('Request Change: First Name')).toBeInTheDocument();
  });

  it('submits change request via API', async () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('field-first_name-request-change'));

    fireEvent.change(screen.getByTestId('change-request-proposed'), {
      target: { value: 'Roberto' },
    });
    fireEvent.change(screen.getByTestId('change-request-reason'), {
      target: { value: 'Legal name change' },
    });
    fireEvent.click(screen.getByTestId('change-request-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        member_id: 10001,
        field_name: 'first_name',
        current_value: 'Robert',
        proposed_value: 'Roberto',
        reason: 'Legal name change',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('change-request-success')).toBeInTheDocument();
    });
  });

  it('cancels change request form', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('field-first_name-request-change'));
    fireEvent.click(screen.getByTestId('change-request-cancel'));
    expect(screen.queryByTestId('change-request-form')).not.toBeInTheDocument();
  });

  it('disables submit when fields are empty', () => {
    renderWithProviders(<PersonalInfoTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('field-first_name-request-change'));
    const submitBtn = screen.getByTestId('change-request-submit');
    expect(submitBtn).toBeDisabled();
  });
});
