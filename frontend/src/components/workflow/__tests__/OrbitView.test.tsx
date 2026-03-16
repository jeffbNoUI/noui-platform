import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import OrbitView from '../OrbitView';
import { testStages } from './fixtures';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

const defaultProps = {
  stages: testStages,
  activeIdx: 2,
  completed: new Set([0, 1]),
  onNavigate: vi.fn(),
  onAdvance: vi.fn(),
  onPrevious: vi.fn(),
  renderStageContent: (id: string) => <div data-testid={`content-${id}`}>Content for {id}</div>,
};

describe('OrbitView', () => {
  it('renders active stage content in center zone', () => {
    renderWithProviders(<OrbitView {...defaultProps} />);
    expect(screen.getByTestId('content-eligibility')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
  });

  it('shows step counter and description', () => {
    renderWithProviders(<OrbitView {...defaultProps} />);
    expect(screen.getByText(/Step 3 of 5/)).toBeInTheDocument();
    expect(screen.getByText(/Check eligibility criteria/)).toBeInTheDocument();
  });

  it('renders left rail with past stage icons as buttons', () => {
    renderWithProviders(<OrbitView {...defaultProps} />);
    // Past stages (intake, verify) should appear as icon buttons in left rail
    // Completed stages show \u2713, not the icon
    const checkmarks = screen.getAllByText('\u2713');
    expect(checkmarks.length).toBeGreaterThanOrEqual(2);
  });

  it('navigates to past stage when left rail button is clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<OrbitView {...defaultProps} onNavigate={onNavigate} />);
    // Click the first left rail button (Intake at index 0)
    const leftRailButtons = screen.getAllByTitle('Intake');
    fireEvent.click(leftRailButtons[0]);
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it('renders right rail with upcoming stages', () => {
    renderWithProviders(<OrbitView {...defaultProps} />);
    expect(screen.getByText('Coming Up (2)')).toBeInTheDocument();
    expect(screen.getByText('DRO Division')).toBeInTheDocument();
    expect(screen.getByText('Election')).toBeInTheDocument();
  });

  it('shows navigation buttons', () => {
    renderWithProviders(<OrbitView {...defaultProps} />);
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm & Continue/)).toBeInTheDocument();
  });

  it('calls onAdvance and onPrevious', () => {
    const onAdvance = vi.fn();
    const onPrevious = vi.fn();
    renderWithProviders(
      <OrbitView {...defaultProps} onAdvance={onAdvance} onPrevious={onPrevious} />,
    );
    fireEvent.click(screen.getByText(/Confirm & Continue/));
    expect(onAdvance).toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Previous/));
    expect(onPrevious).toHaveBeenCalled();
  });

  it('shows Complete button on last stage', () => {
    renderWithProviders(
      <OrbitView {...defaultProps} activeIdx={4} completed={new Set([0, 1, 2, 3])} />,
    );
    expect(screen.getByText(/Complete/)).toBeInTheDocument();
  });
});
