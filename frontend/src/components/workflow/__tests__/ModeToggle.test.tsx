import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ModeToggle from '../ModeToggle';

describe('ModeToggle', () => {
  it('renders Guided and Expert buttons', () => {
    renderWithProviders(<ModeToggle mode="guided" onToggle={() => {}} />);
    expect(screen.getByText('Guided')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('highlights the active mode', () => {
    renderWithProviders(<ModeToggle mode="guided" onToggle={() => {}} />);
    const guidedBtn = screen.getByText('Guided');
    const expertBtn = screen.getByText('Expert');
    expect(guidedBtn.className).toContain('bg-white');
    expect(expertBtn.className).not.toContain('bg-white');
  });

  it('calls onToggle with the clicked mode', () => {
    const onToggle = vi.fn();
    renderWithProviders(<ModeToggle mode="guided" onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Expert'));
    expect(onToggle).toHaveBeenCalledWith('expert');
  });

  it('calls onToggle when clicking the already-active mode', () => {
    const onToggle = vi.fn();
    renderWithProviders(<ModeToggle mode="expert" onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Expert'));
    expect(onToggle).toHaveBeenCalledWith('expert');
  });
});
