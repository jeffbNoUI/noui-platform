import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import GuidedView from '../GuidedView';
import { testStages } from './fixtures';

const defaultProps = {
  stages: testStages,
  activeIdx: 1,
  completed: new Set([0]),
  onNavigate: vi.fn(),
  onAdvance: vi.fn(),
  onPrevious: vi.fn(),
  renderStageContent: (id: string) => <div data-testid={`content-${id}`}>Content for {id}</div>,
};

describe('GuidedView', () => {
  it('renders active stage content', () => {
    renderWithProviders(<GuidedView {...defaultProps} />);
    expect(screen.getByTestId('content-verify')).toBeInTheDocument();
  });

  it('shows Confirm & Continue button', () => {
    renderWithProviders(<GuidedView {...defaultProps} />);
    expect(screen.getByText('Confirm & Continue →')).toBeInTheDocument();
  });

  it('shows Complete button on last stage', () => {
    renderWithProviders(
      <GuidedView {...defaultProps} activeIdx={4} completed={new Set([0, 1, 2, 3])} />,
    );
    expect(screen.getByText('Complete ✓')).toBeInTheDocument();
  });

  it('disables Previous on first stage', () => {
    renderWithProviders(<GuidedView {...defaultProps} activeIdx={0} completed={new Set()} />);
    const prevBtn = screen.getByText('← Previous');
    expect(prevBtn).toBeDisabled();
  });

  it('calls onAdvance when Confirm button is clicked', () => {
    const onAdvance = vi.fn();
    renderWithProviders(<GuidedView {...defaultProps} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByText('Confirm & Continue →'));
    expect(onAdvance).toHaveBeenCalled();
  });

  it('calls onPrevious when Previous button is clicked', () => {
    const onPrevious = vi.fn();
    renderWithProviders(<GuidedView {...defaultProps} onPrevious={onPrevious} />);
    fireEvent.click(screen.getByText('← Previous'));
    expect(onPrevious).toHaveBeenCalled();
  });

  it('shows completed stages summary when activeIdx > 0', () => {
    renderWithProviders(<GuidedView {...defaultProps} />);
    expect(screen.getByText('Completed (1)')).toBeInTheDocument();
  });

  it('renders help panel when provided', () => {
    renderWithProviders(<GuidedView {...defaultProps} helpPanel={<div>Help content here</div>} />);
    expect(screen.getByText('Help content here')).toBeInTheDocument();
  });
});
