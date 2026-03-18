import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityPreferences from '../SecurityPreferences';

describe('SecurityPreferences', () => {
  it('renders all security sections', () => {
    render(<SecurityPreferences memberId="123" />);
    expect(screen.getByTestId('security-password')).toBeInTheDocument();
    expect(screen.getByTestId('security-2fa')).toBeInTheDocument();
    expect(screen.getByTestId('security-sessions')).toBeInTheDocument();
    expect(screen.getByTestId('security-last-login')).toBeInTheDocument();
  });

  it('renders Change Password link', () => {
    render(<SecurityPreferences memberId="123" />);
    const btn = screen.getByTestId('change-password-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('href', '/user');
  });

  it('renders Manage 2FA link', () => {
    render(<SecurityPreferences memberId="123" />);
    const btn = screen.getByTestId('manage-2fa-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('href', '/user');
  });

  it('shows current session indicator', () => {
    render(<SecurityPreferences memberId="123" />);
    expect(screen.getByTestId('current-session')).toBeInTheDocument();
    expect(screen.getByText('Current Session')).toBeInTheDocument();
  });

  it('renders account activity section', () => {
    render(<SecurityPreferences memberId="123" />);
    expect(screen.getByText('Account Activity')).toBeInTheDocument();
  });
});
