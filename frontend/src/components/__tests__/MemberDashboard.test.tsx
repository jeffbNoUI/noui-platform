import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberDashboard from '@/components/dashboard/MemberDashboard';

const noop = vi.fn();

describe('MemberDashboard', () => {
  it('renders header with back button', () => {
    renderWithProviders(
      <MemberDashboard memberId={10001} onBack={noop} onOpenCase={noop} onChangeView={noop} />,
    );
    expect(screen.getByText('Member Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Staff Portal')).toBeInTheDocument();
  });

  it('renders Open CRM button', () => {
    renderWithProviders(
      <MemberDashboard memberId={10001} onBack={noop} onOpenCase={noop} onChangeView={noop} />,
    );
    expect(screen.getByText('Open CRM')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderWithProviders(
      <MemberDashboard memberId={10001} onBack={noop} onOpenCase={noop} onChangeView={noop} />,
    );
    expect(screen.getByText('Loading member data...')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    renderWithProviders(
      <MemberDashboard memberId={10001} onBack={onBack} onOpenCase={noop} onChangeView={noop} />,
    );
    screen.getByText('Staff Portal').click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onChangeView when CRM button is clicked', () => {
    const onChangeView = vi.fn();
    renderWithProviders(
      <MemberDashboard
        memberId={10001}
        onBack={noop}
        onOpenCase={noop}
        onChangeView={onChangeView}
      />,
    );
    screen.getByText('Open CRM').click();
    expect(onChangeView).toHaveBeenCalledWith('crm', { memberId: 10001 });
  });
});
