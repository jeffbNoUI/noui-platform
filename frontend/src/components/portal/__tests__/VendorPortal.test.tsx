import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import VendorPortal from '../VendorPortal';

describe('VendorPortal', () => {
  it('renders header with Vendor Portal title', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Vendor Portal')).toBeInTheDocument();
  });

  it('renders three stats cards', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Pending Enrollments')).toBeInTheDocument();
    expect(screen.getByText('Enrolled This Month')).toBeInTheDocument();
    expect(screen.getByText('Avg IPR Benefit')).toBeInTheDocument();
  });

  it('renders enrollment queue with Coming Soon placeholder', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Enrollment Queue')).toBeInTheDocument();
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(screen.getByText(/enrollment processing is coming soon/i)).toBeInTheDocument();
  });

  it('renders footer with vendor identifier', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText(/Kaiser Permanente/)).toBeInTheDocument();
  });

  it('calls onChangeView when back button clicked', () => {
    const onChangeView = vi.fn();
    renderWithProviders(<VendorPortal onChangeView={onChangeView} />);
    const backBtn = screen.getByText(/Back to Staff/);
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onChangeView).toHaveBeenCalledWith('staff');
  });

  it('does not show back button when onChangeView is not provided', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.queryByText(/Back to Staff/)).not.toBeInTheDocument();
  });

  it('renders user avatar with initials', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('JP')).toBeInTheDocument();
    expect(screen.getByText('James Park')).toBeInTheDocument();
  });
});
