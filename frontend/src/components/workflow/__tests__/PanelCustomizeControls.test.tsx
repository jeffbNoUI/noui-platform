import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PanelCustomizeControls from '../PanelCustomizeControls';

describe('PanelCustomizeControls', () => {
  const defaultProps = {
    panelId: 'eligibility',
    isMandatory: false,
    isCustomizing: true,
    visibility: 'visible' as const,
    defaultState: 'collapsed' as const,
    onVisibilityChange: vi.fn(),
    onDefaultStateChange: vi.fn(),
  };

  it('renders controls when customizing', () => {
    render(<PanelCustomizeControls {...defaultProps} />);
    expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expansion/i)).toBeInTheDocument();
  });

  it('hides controls when not customizing', () => {
    render(<PanelCustomizeControls {...defaultProps} isCustomizing={false} />);
    expect(screen.queryByLabelText(/visibility/i)).not.toBeInTheDocument();
  });

  it('disables hide for mandatory stages', () => {
    render(<PanelCustomizeControls {...defaultProps} isMandatory={true} />);
    const visBtn = screen.getByLabelText(/visibility/i);
    fireEvent.click(visBtn);
    expect(defaultProps.onVisibilityChange).toHaveBeenCalledWith('pinned');
  });

  it('allows hide for conditional stages', () => {
    const onChange = vi.fn();
    render(
      <PanelCustomizeControls
        {...defaultProps}
        visibility="pinned"
        onVisibilityChange={onChange}
      />,
    );
    const visBtn = screen.getByLabelText(/visibility/i);
    fireEvent.click(visBtn);
    expect(onChange).toHaveBeenCalledWith('hidden');
  });

  it('toggles expansion state', () => {
    const onChange = vi.fn();
    render(<PanelCustomizeControls {...defaultProps} onDefaultStateChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/expansion/i));
    expect(onChange).toHaveBeenCalledWith('expanded');
  });
});
