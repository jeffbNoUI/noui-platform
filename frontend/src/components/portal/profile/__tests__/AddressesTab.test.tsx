import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import AddressesTab from '../AddressesTab';
import type { Address } from '@/lib/memberPortalApi';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockAddresses: Address[] = [
  {
    id: 'addr-1',
    type: 'mailing',
    line1: '123 Main St',
    line2: 'Apt 4B',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
  },
  {
    id: 'addr-2',
    type: 'residential',
    line1: '456 Oak Ave',
    city: 'Boulder',
    state: 'CO',
    zip: '80301',
  },
];

let addressData: Address[] | undefined = mockAddresses;
let addressLoading = false;

const mockMutate = vi.fn();

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useAddresses', () => ({
  useAddresses: () => ({ data: addressData, isLoading: addressLoading }),
  useUpdateAddress: () => ({ mutate: mockMutate, isPending: false }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AddressesTab', () => {
  beforeEach(() => {
    addressData = mockAddresses;
    addressLoading = false;
    mockMutate.mockClear();
  });

  it('renders address cards for each address', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    expect(screen.getByTestId('addresses-tab')).toBeInTheDocument();
    expect(screen.getByTestId('address-card-mailing')).toBeInTheDocument();
    expect(screen.getByTestId('address-card-residential')).toBeInTheDocument();
  });

  it('displays address details', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('Apt 4B')).toBeInTheDocument();
    expect(screen.getByText('Denver, CO 80202')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    addressLoading = true;
    addressData = undefined;
    renderWithProviders(<AddressesTab memberId={10001} />);
    expect(screen.getByText('Loading addresses...')).toBeInTheDocument();
  });

  it('shows empty state when no addresses', () => {
    addressData = [];
    renderWithProviders(<AddressesTab memberId={10001} />);
    expect(screen.getByText('No addresses on file.')).toBeInTheDocument();
  });

  it('shows Mailing Address and Residential Address labels', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    expect(screen.getByText('Mailing Address')).toBeInTheDocument();
    expect(screen.getByText('Residential Address')).toBeInTheDocument();
  });

  it('opens edit form when Edit is clicked', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('address-edit-mailing'));
    expect(screen.getByTestId('address-form-mailing')).toBeInTheDocument();
    expect(screen.getByTestId('address-line1')).toHaveValue('123 Main St');
    expect(screen.getByTestId('address-city')).toHaveValue('Denver');
  });

  it('cancels edit', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('address-edit-mailing'));
    fireEvent.click(screen.getByTestId('address-cancel'));
    expect(screen.queryByTestId('address-form-mailing')).not.toBeInTheDocument();
  });

  it('validates required fields on save', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('address-edit-mailing'));
    // Clear required field
    fireEvent.change(screen.getByTestId('address-line1'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('address-save'));
    expect(screen.getByText('Street address is required')).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('validates ZIP format', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('address-edit-mailing'));
    fireEvent.change(screen.getByTestId('address-zip'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('address-save'));
    expect(screen.getByText('Invalid ZIP code format')).toBeInTheDocument();
  });

  it('calls mutate on valid save', () => {
    renderWithProviders(<AddressesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('address-edit-mailing'));
    fireEvent.change(screen.getByTestId('address-line1'), { target: { value: '789 New St' } });
    fireEvent.click(screen.getByTestId('address-save'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        addressId: 'addr-1',
        data: expect.objectContaining({ line1: '789 New St' }),
      }),
      expect.anything(),
    );
  });
});
