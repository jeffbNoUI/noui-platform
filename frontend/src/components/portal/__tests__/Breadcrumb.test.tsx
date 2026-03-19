import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import Breadcrumb from '../Breadcrumb';

describe('Breadcrumb', () => {
  it('does not render when trail has only Home', () => {
    renderWithProviders(
      <Breadcrumb trail={[{ section: 'dashboard', label: 'Home' }]} onNavigate={vi.fn()} />,
    );

    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
  });

  it('renders when trail has 2+ entries', () => {
    renderWithProviders(
      <Breadcrumb
        trail={[
          { section: 'dashboard', label: 'Home' },
          { section: 'profile', label: 'My Profile' },
        ]}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders Home as clickable button', () => {
    renderWithProviders(
      <Breadcrumb
        trail={[
          { section: 'dashboard', label: 'Home' },
          { section: 'profile', label: 'My Profile' },
        ]}
        onNavigate={vi.fn()}
      />,
    );

    const homeBtn = screen.getByTestId('breadcrumb-dashboard');
    expect(homeBtn.tagName).toBe('BUTTON');
  });

  it('renders last segment as plain text with aria-current', () => {
    renderWithProviders(
      <Breadcrumb
        trail={[
          { section: 'dashboard', label: 'Home' },
          { section: 'profile', label: 'My Profile' },
        ]}
        onNavigate={vi.fn()}
      />,
    );

    const lastSegment = screen.getByText('My Profile');
    expect(lastSegment).toHaveAttribute('aria-current', 'page');
    expect(lastSegment.tagName).toBe('SPAN');
  });

  it('calls onNavigate with correct index when segment clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <Breadcrumb
        trail={[
          { section: 'dashboard', label: 'Home' },
          { section: 'documents', label: 'Documents' },
          { section: 'tax-forms', label: 'Tax Forms' },
        ]}
        onNavigate={onNavigate}
      />,
    );

    // Click Home (index 0)
    fireEvent.click(screen.getByTestId('breadcrumb-dashboard'));
    expect(onNavigate).toHaveBeenCalledWith(0);

    // Click Documents (index 1)
    fireEvent.click(screen.getByTestId('breadcrumb-documents'));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('has navigation landmark with Breadcrumb aria-label', () => {
    renderWithProviders(
      <Breadcrumb
        trail={[
          { section: 'dashboard', label: 'Home' },
          { section: 'profile', label: 'My Profile' },
        ]}
        onNavigate={vi.fn()}
      />,
    );

    const nav = screen.getByTestId('breadcrumb');
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    expect(nav.tagName).toBe('NAV');
  });

  it('renders separator between segments', () => {
    renderWithProviders(
      <Breadcrumb
        trail={[
          { section: 'dashboard', label: 'Home' },
          { section: 'profile', label: 'My Profile' },
        ]}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('›')).toBeInTheDocument();
  });
});
