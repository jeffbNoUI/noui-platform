import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortalShell from '../MemberPortalShell';

describe('MemberPortalShell', () => {
  it('renders the shell with main content area', () => {
    renderWithProviders(
      <MemberPortalShell>
        <div data-testid="test-content">Hello</div>
      </MemberPortalShell>,
    );
    expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('renders optional header slot', () => {
    renderWithProviders(
      <MemberPortalShell header={<div data-testid="custom-header">Header</div>}>
        <div>Content</div>
      </MemberPortalShell>,
    );
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
  });

  it('uses single-column layout without sidebar', () => {
    renderWithProviders(
      <MemberPortalShell>
        <div>Content</div>
      </MemberPortalShell>,
    );

    const shell = screen.getByTestId('member-portal-shell');
    // Should NOT use display:flex (old sidebar layout)
    expect(shell.style.display).not.toBe('flex');
  });

  it('constrains main content width', () => {
    renderWithProviders(
      <MemberPortalShell>
        <div>Content</div>
      </MemberPortalShell>,
    );

    const main = screen.getByRole('main');
    expect(main.style.maxWidth).toBe('1320px');
    expect(main.style.margin).toBe('0px auto');
  });
});
