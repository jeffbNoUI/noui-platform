import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberCorrespondenceTab from '../MemberCorrespondenceTab';

// Mock the correspondence hook
vi.mock('@/hooks/useCorrespondence', () => ({
  useSentCorrespondence: vi.fn(),
}));

import { useSentCorrespondence } from '@/hooks/useCorrespondence';
const mockUseSentCorrespondence = vi.mocked(useSentCorrespondence);

describe('MemberCorrespondenceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseSentCorrespondence.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<MemberCorrespondenceTab memberId={10001} />);
    expect(screen.getByText(/Loading correspondence/)).toBeInTheDocument();
  });

  it('shows empty state when no correspondence', () => {
    mockUseSentCorrespondence.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<MemberCorrespondenceTab memberId={10001} />);
    expect(screen.getByText('No correspondence on file')).toBeInTheDocument();
  });

  it('renders Letters & Notices header and item list', () => {
    mockUseSentCorrespondence.mockReturnValue({
      data: [
        {
          correspondenceId: 'm-1',
          subject: 'Benefit Estimate',
          sentAt: '2026-03-01',
          createdAt: '2026-02-28',
          sentVia: 'email',
          bodyRendered: 'Your estimated benefit...',
        },
        {
          correspondenceId: 'm-2',
          subject: 'Election Confirmation',
          sentAt: '2026-03-10',
          createdAt: '2026-03-09',
          sentVia: 'mail',
          bodyRendered: 'Your election has been confirmed.',
        },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<MemberCorrespondenceTab memberId={10001} />);
    expect(screen.getByText('Letters & Notices')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('Benefit Estimate')).toBeInTheDocument();
    expect(screen.getByText('Election Confirmation')).toBeInTheDocument();
  });

  it('expands and collapses item body on click', () => {
    mockUseSentCorrespondence.mockReturnValue({
      data: [
        {
          correspondenceId: 'm-1',
          subject: 'Welcome Letter',
          sentAt: '2026-01-15',
          createdAt: '2026-01-15',
          sentVia: 'email',
          bodyRendered: 'Welcome to DERP, your pension fund.',
        },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<MemberCorrespondenceTab memberId={10001} />);

    expect(screen.queryByText('Welcome to DERP, your pension fund.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Welcome Letter'));
    expect(screen.getByText('Welcome to DERP, your pension fund.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Welcome Letter'));
    expect(screen.queryByText('Welcome to DERP, your pension fund.')).not.toBeInTheDocument();
  });
});
