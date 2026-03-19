import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import TourProvider from '../TourProvider';

// ── Mock DOM element for spotlight targeting ─────────────────────────────────

const mockRect = {
  top: 100,
  left: 200,
  bottom: 140,
  right: 400,
  width: 200,
  height: 40,
  x: 200,
  y: 100,
  toJSON: () => ({}),
};

let mockEl: HTMLDivElement | null = null;

beforeEach(() => {
  // Provide a mock target element for spotlight to find
  mockEl = document.createElement('div');
  mockEl.setAttribute('data-tour-id', 'card-grid');
  mockEl.getBoundingClientRect = () => mockRect as DOMRect;
  document.body.appendChild(mockEl);
});

afterEach(() => {
  if (mockEl && mockEl.parentNode) {
    mockEl.parentNode.removeChild(mockEl);
  }
  mockEl = null;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TourProvider', () => {
  const defaultProps = {
    persona: 'active' as const,
    tourCompleted: false,
    tourVersion: 0,
    onTourComplete: vi.fn(),
    autoStart: false,
  };

  it('renders children without tour overlay when not started', () => {
    renderWithProviders(
      <TourProvider {...defaultProps}>
        <div data-testid="child-content">Hello</div>
      </TourProvider>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  it('auto-starts when autoStart=true and tour not completed', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-tooltip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('auto-starts when tour version is outdated', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} tourCompleted={true} tourVersion={0} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-tooltip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('does NOT auto-start when tour completed and version current', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} tourCompleted={true} tourVersion={3} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    // Wait a bit and confirm no tooltip appeared
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  it('shows step counter in tooltip', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-tooltip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Active persona has 4 common steps + 4 active steps = 8 total
    expect(screen.getByText(/1 of 8/)).toBeInTheDocument();
  });

  it('navigates to next step on Next click', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-next')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // First step is "Your Dashboard" (card-grid)
    expect(screen.getByText('Your Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tour-next'));

    // Second step is "Your Documents" (nav-documents, a common step)
    expect(screen.getByText('Your Documents')).toBeInTheDocument();
    expect(screen.getByText(/2 of 8/)).toBeInTheDocument();
  });

  it('navigates back on Back click', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-next')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Go forward
    fireEvent.click(screen.getByTestId('tour-next'));
    expect(screen.getByText(/2 of 8/)).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByTestId('tour-prev'));
    expect(screen.getByText(/1 of 8/)).toBeInTheDocument();
  });

  it('calls onTourComplete when skipping', async () => {
    const onComplete = vi.fn();
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart onTourComplete={onComplete}>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-skip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    fireEvent.click(screen.getByTestId('tour-skip'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  it('calls onTourComplete when finishing last step', async () => {
    const onComplete = vi.fn();
    renderWithProviders(
      <TourProvider {...defaultProps} persona="retiree" autoStart onTourComplete={onComplete}>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-next')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Retiree has 7 steps (4 common + 3 retiree). Navigate through all.
    expect(screen.getByText(/1 of 7/)).toBeInTheDocument();

    // Click through to the last step
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId('tour-next'));
    }
    expect(screen.getByText(/7 of 7/)).toBeInTheDocument();

    // Last step shows "Done" instead of "Next"
    expect(screen.getByText('Done')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tour-next'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  it('renders spotlight overlay when tour is active', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(screen.getByTestId('tour-overlay')).toBeInTheDocument();
  });

  it('shows persona-specific steps for each persona', async () => {
    // Beneficiary gets common (4) + beneficiary (2) = 6 steps
    renderWithProviders(
      <TourProvider {...defaultProps} persona="beneficiary" autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/1 of 6/)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });
});
