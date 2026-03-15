import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ExpertView from '../ExpertView';
import { testStages } from './fixtures';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const defaultProps = {
  stages: testStages,
  activeIdx: 1,
  completed: new Set([0]),
  onNavigate: vi.fn(),
  onAdvance: vi.fn(),
  onPrevious: vi.fn(),
  renderStageContent: (id: string) => <div data-testid={`content-${id}`}>Content for {id}</div>,
};

describe('ExpertView', () => {
  it('renders all stage labels', () => {
    renderWithProviders(<ExpertView {...defaultProps} />);
    for (const stage of testStages) {
      expect(screen.getByText(stage.label)).toBeInTheDocument();
    }
  });

  it('renders content only for the active stage', () => {
    renderWithProviders(<ExpertView {...defaultProps} />);
    expect(screen.getByTestId('content-verify')).toBeInTheDocument();
    expect(screen.queryByTestId('content-intake')).not.toBeInTheDocument();
    expect(screen.queryByTestId('content-eligibility')).not.toBeInTheDocument();
  });

  it('shows navigation buttons for active stage', () => {
    renderWithProviders(<ExpertView {...defaultProps} />);
    expect(screen.getByText('← Previous')).toBeInTheDocument();
    expect(screen.getByText('Confirm & Continue ↓')).toBeInTheDocument();
  });

  it('shows Complete button on last stage', () => {
    renderWithProviders(
      <ExpertView {...defaultProps} activeIdx={4} completed={new Set([0, 1, 2, 3])} />,
    );
    expect(screen.getByText('Complete ✓')).toBeInTheDocument();
  });

  it('calls onAdvance when confirm button is clicked', () => {
    const onAdvance = vi.fn();
    renderWithProviders(<ExpertView {...defaultProps} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByText('Confirm & Continue ↓'));
    expect(onAdvance).toHaveBeenCalled();
  });

  it('applies reduced opacity to future stages', () => {
    const { container } = renderWithProviders(
      <ExpertView {...defaultProps} activeIdx={0} completed={new Set()} />,
    );
    // Future stages (idx > activeIdx) should have opacity-40 class
    const futureStages = container.querySelectorAll('.opacity-40');
    expect(futureStages.length).toBeGreaterThan(0);
  });
});
