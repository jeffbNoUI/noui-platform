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

  it('renders enrollment queue with 4 records', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    expect(screen.getByText('David Washington')).toBeInTheDocument();
    expect(screen.getByText('Patricia Morales')).toBeInTheDocument();
    expect(screen.getByText('James Butler')).toBeInTheDocument();
  });

  it('displays IPR amounts formatted as currency', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('$359.38')).toBeInTheDocument();
    expect(screen.getByText('$169.75')).toBeInTheDocument();
  });

  it('renders status badges with correct text', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Pending Verification')).toBeInTheDocument();
    expect(screen.getAllByText('Enrolled')).toHaveLength(2);
    expect(screen.getByText('Pending Docs')).toBeInTheDocument();
  });

  it('renders enrollment IDs and plan names', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText(/ENR-2026-0041/)).toBeInTheDocument();
    expect(screen.getAllByText(/Kaiser HMO/)).toHaveLength(3);
    expect(screen.getByText(/Cigna PPO/)).toBeInTheDocument();
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
