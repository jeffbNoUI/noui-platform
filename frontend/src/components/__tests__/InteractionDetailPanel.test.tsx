import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel';

const mockRect = {
  top: 200,
  left: 100,
  width: 600,
  height: 50,
  right: 700,
  bottom: 250,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect;

describe('InteractionDetailPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    const { container } = renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5001" sourceRect={null} onClose={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows interaction content after opening', async () => {
    renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5003" sourceRect={mockRect} onClose={() => {}} />,
    );

    // Advance through measuring → spawning → open
    await act(async () => {
      vi.advanceTimersByTime(0); // rAF
      vi.advanceTimersByTime(350); // duration
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // INT-5003 has a note with category 'retirement'
    expect(screen.getByText('retirement')).toBeInTheDocument();
  });

  it('shows summary text', async () => {
    renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5001" sourceRect={mockRect} onClose={() => {}} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(350);
    });

    // INT-5001 is a secure message about retirement timeline
    expect(screen.getByText(/retirement/i)).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5001" sourceRect={mockRect} onClose={onClose} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    // Close animation takes 350ms
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5001" sourceRect={mockRect} onClose={onClose} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(350);
    });

    // Click the backdrop (first child of the fixed container)
    const backdrop = document.querySelector('.fixed.inset-0.z-50 > .absolute.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows notes section when interaction has notes', async () => {
    renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5003" sourceRect={mockRect} onClose={() => {}} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText(/Notes \(1\)/)).toBeInTheDocument();
  });

  it('does not show notes section when interaction has no notes', async () => {
    renderWithProviders(
      <InteractionDetailPanel interactionId="INT-5001" sourceRect={mockRect} onClose={() => {}} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByText(/Notes \(/)).not.toBeInTheDocument();
  });
});
