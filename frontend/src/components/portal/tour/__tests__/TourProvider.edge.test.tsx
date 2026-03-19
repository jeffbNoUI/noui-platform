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
  mockEl = document.createElement('div');
  mockEl.setAttribute('data-tour-id', 'sidebar-nav');
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

describe('TourProvider — Edge Cases', () => {
  const defaultProps = {
    persona: 'active' as const,
    tourCompleted: false,
    tourVersion: 0,
    onTourComplete: vi.fn(),
    autoStart: false,
  };

  // ── Inactive persona step count ───────────────────────────────────────────

  it('shows correct step count for inactive persona', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} persona="inactive" autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-tooltip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Inactive: 4 common + 2 inactive-specific = 6 steps
    expect(screen.getByText(/1 of 6/)).toBeInTheDocument();
  });

  // ── autoStart=false prevents tour ─────────────────────────────────────────

  it('does not auto-start when autoStart=false even if tour not completed', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart={false} tourCompleted={false}>
        <div>Content</div>
      </TourProvider>,
    );

    // Wait and confirm no tooltip
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  // ── Version bump re-triggers ──────────────────────────────────────────────

  it('re-triggers tour when tourVersion is below CURRENT_TOUR_VERSION', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} tourCompleted={true} tourVersion={1} autoStart>
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

  // ── Rapid next clicking ───────────────────────────────────────────────────

  it('handles rapid next-clicking without crashing', async () => {
    const onComplete = vi.fn();
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart onTourComplete={onComplete}>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-next')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Active persona has 8 steps — click next 15 times (more than total)
    for (let i = 0; i < 15; i++) {
      const nextBtn = screen.queryByTestId('tour-next');
      if (nextBtn) {
        fireEvent.click(nextBtn);
      }
    }

    // Tour should have completed (onComplete called) and tooltip should be gone
    expect(onComplete).toHaveBeenCalled();
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  // ── Last step shows "Done" for each persona ──────────────────────────────

  it('shows "Done" on last step for beneficiary persona (6 steps)', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} persona="beneficiary" autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-next')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Navigate to last step (6 total, click next 5 times)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('tour-next'));
    }

    expect(screen.getByText(/6 of 6/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows "Done" on last step for inactive persona (6 steps)', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} persona="inactive" autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-next')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('tour-next'));
    }

    expect(screen.getByText(/6 of 6/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  // ── Tour overlay is present when active ───────────────────────────────────

  it('renders spotlight overlay when tour is active', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-overlay')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument();
  });

  // ── Skip on first step ────────────────────────────────────────────────────

  it('skip button is available on every step', async () => {
    renderWithProviders(
      <TourProvider {...defaultProps} autoStart>
        <div>Content</div>
      </TourProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tour-skip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Navigate to step 3 and check skip is still there
    fireEvent.click(screen.getByTestId('tour-next'));
    fireEvent.click(screen.getByTestId('tour-next'));
    expect(screen.getByText(/3 of 8/)).toBeInTheDocument();
    expect(screen.getByTestId('tour-skip')).toBeInTheDocument();
  });
});
