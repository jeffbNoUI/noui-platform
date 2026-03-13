import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailOverlay, MetadataGrid, Section, StatusBadge } from '@/components/DetailOverlay';

vi.mock('@/hooks/useSpawnAnimation', () => ({
  useSpawnAnimation: () => ({
    panelRef: { current: null },
    isVisible: true,
    phase: 'open',
    open: vi.fn(),
    close: vi.fn(),
    style: { transform: 'none', opacity: 1, transition: 'none' },
    DURATION_MS: 0,
  }),
}));

const sourceRect = new DOMRect(100, 200, 300, 40);

describe('DetailOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title and children', () => {
    render(
      <DetailOverlay sourceRect={sourceRect} onClose={vi.fn()} title="Test Title">
        <p>Body content</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        icon={<span data-testid="icon">IC</span>}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <DetailOverlay sourceRect={sourceRect} onClose={vi.fn()} title="Title" subtitle="Sub text">
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Sub text')).toBeInTheDocument();
  });

  it('renders statusBadge when provided', () => {
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        statusBadge={<span data-testid="badge">Active</span>}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        footer={<div>Footer content</div>}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('shows navigation arrows and counter when nav props provided', () => {
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        totalItems={5}
        currentIndex={2}
        onNavigate={vi.fn()}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
    expect(screen.getByTitle(/Previous/)).toBeInTheDocument();
    expect(screen.getByTitle(/Next/)).toBeInTheDocument();
  });

  it('does not show navigation when nav props missing', () => {
    render(
      <DetailOverlay sourceRect={sourceRect} onClose={vi.fn()} title="Title">
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.queryByTitle(/Previous/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Next/)).not.toBeInTheDocument();
  });

  it('disables prev button at first item', () => {
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        totalItems={3}
        currentIndex={0}
        onNavigate={vi.fn()}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByTitle(/Previous/)).toBeDisabled();
    expect(screen.getByTitle(/Next/)).not.toBeDisabled();
  });

  it('disables next button at last item', () => {
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        totalItems={3}
        currentIndex={2}
        onNavigate={vi.fn()}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    expect(screen.getByTitle(/Previous/)).not.toBeDisabled();
    expect(screen.getByTitle(/Next/)).toBeDisabled();
  });

  it('calls onNavigate on prev/next arrow clicks', () => {
    const onNavigate = vi.fn();
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        totalItems={5}
        currentIndex={2}
        onNavigate={onNavigate}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    fireEvent.click(screen.getByTitle(/Previous/));
    expect(onNavigate).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTitle(/Next/));
    expect(onNavigate).toHaveBeenCalledWith(3);
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    render(
      <DetailOverlay sourceRect={sourceRect} onClose={onClose} title="Title">
        <p>Body</p>
      </DetailOverlay>,
    );
    fireEvent.click(screen.getByTestId('detail-overlay-backdrop'));
    vi.advanceTimersByTime(400);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <DetailOverlay sourceRect={sourceRect} onClose={onClose} title="Title">
        <p>Body</p>
      </DetailOverlay>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    vi.advanceTimersByTime(400);
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates on ArrowLeft/ArrowRight keys', () => {
    const onNavigate = vi.fn();
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        totalItems={5}
        currentIndex={2}
        onNavigate={onNavigate}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(3);
  });

  it('does not navigate past bounds with keyboard', () => {
    const onNavigate = vi.fn();
    render(
      <DetailOverlay
        sourceRect={sourceRect}
        onClose={vi.fn()}
        title="Title"
        totalItems={3}
        currentIndex={0}
        onNavigate={onNavigate}
      >
        <p>Body</p>
      </DetailOverlay>,
    );
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('MetadataGrid', () => {
  it('renders label-value pairs', () => {
    render(
      <MetadataGrid
        fields={[
          { label: 'Name', value: 'Alice' },
          { label: 'Role', value: 'Admin' },
        ]}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('skips fields with null or undefined values', () => {
    render(
      <MetadataGrid
        fields={[
          { label: 'Name', value: 'Alice' },
          { label: 'Hidden', value: null },
          { label: 'Also Hidden', value: undefined },
        ]}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Also Hidden')).not.toBeInTheDocument();
  });
});

describe('Section', () => {
  it('renders title and children', () => {
    render(
      <Section title="Details">
        <p>Section content</p>
      </Section>,
    );
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders with color from colorMap', () => {
    const { container } = render(
      <StatusBadge status="active" colorMap={{ active: 'text-green-600 bg-green-50' }} />,
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.textContent).toBe('active');
    expect(badge.className).toContain('text-green-600');
    expect(badge.className).toContain('bg-green-50');
  });

  it('uses fallback gray for unknown status', () => {
    const { container } = render(
      <StatusBadge status="unknown" colorMap={{ active: 'text-green-600 bg-green-50' }} />,
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.textContent).toBe('unknown');
    expect(badge.className).toContain('text-gray-500');
    expect(badge.className).toContain('bg-gray-50');
  });
});
