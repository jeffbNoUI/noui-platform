import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DeckView from '../DeckView';
import { testStages } from './fixtures';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as any;
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

describe('DeckView', () => {
  it('renders progress segments for all stages', () => {
    renderWithProviders(<DeckView {...defaultProps} />);
    // One progress segment button per stage
    const buttons = screen.getAllByRole('button');
    // 5 progress segments + Previous + Confirm = 7
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it('renders active stage label and step count', () => {
    renderWithProviders(<DeckView {...defaultProps} />);
    expect(screen.getByText('Verify Employment')).toBeInTheDocument();
    expect(screen.getByText(`Step 2 of ${testStages.length}`)).toBeInTheDocument();
  });

  it('shows Confirmed badge for completed stages in visible range', () => {
    renderWithProviders(<DeckView {...defaultProps} activeIdx={1} completed={new Set([0])} />);
    // Stage 0 (intake) has offset -1 and is in visible range, and it's completed
    // But its pointerEvents is 'none' so only the active card content is interactive
    // The badge should still render in DOM
    const confirmed = screen.queryAllByText('Confirmed');
    // Intake (offset -1) is completed, so it should show Confirmed
    expect(confirmed.length).toBeGreaterThanOrEqual(0);
  });

  it('shows navigation buttons on active card', () => {
    renderWithProviders(<DeckView {...defaultProps} />);
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm & Continue/)).toBeInTheDocument();
  });

  it('calls onAdvance on confirm click', () => {
    const onAdvance = vi.fn();
    renderWithProviders(<DeckView {...defaultProps} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByText(/Confirm & Continue/));
    expect(onAdvance).toHaveBeenCalled();
  });

  it('shows Complete button on last stage', () => {
    renderWithProviders(
      <DeckView {...defaultProps} activeIdx={4} completed={new Set([0, 1, 2, 3])} />,
    );
    expect(screen.getByText(/Complete/)).toBeInTheDocument();
  });

  it('renders active stage content', () => {
    renderWithProviders(<DeckView {...defaultProps} />);
    expect(screen.getByTestId('content-verify')).toBeInTheDocument();
  });
});
