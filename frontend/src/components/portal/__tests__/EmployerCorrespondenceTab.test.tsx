import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import EmployerCorrespondenceTab from '../EmployerCorrespondenceTab';

// Mock the correspondence hook
vi.mock('@/hooks/useCorrespondence', () => ({
  useContactCorrespondence: vi.fn(),
}));

import { useContactCorrespondence } from '@/hooks/useCorrespondence';
const mockUseContactCorrespondence = vi.mocked(useContactCorrespondence);

describe('EmployerCorrespondenceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseContactCorrespondence.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<EmployerCorrespondenceTab contactId="contact-1" />);
    expect(screen.getByText(/Loading correspondence/)).toBeInTheDocument();
  });

  it('shows empty state when no correspondence', () => {
    mockUseContactCorrespondence.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<EmployerCorrespondenceTab contactId="contact-1" />);
    expect(screen.getByText('No correspondence on file')).toBeInTheDocument();
    expect(screen.getByText(/Letters and notices will appear here/)).toBeInTheDocument();
  });

  it('renders correspondence list with subjects and item count', () => {
    mockUseContactCorrespondence.mockReturnValue({
      data: [
        {
          correspondenceId: 'c-1',
          subject: 'Enrollment Confirmation',
          sentAt: '2026-02-15',
          createdAt: '2026-02-14',
          sentVia: 'email',
          bodyRendered: 'Body text here',
        },
        {
          correspondenceId: 'c-2',
          subject: 'Contribution Notice',
          sentAt: null,
          createdAt: '2026-03-01',
          sentVia: 'mail',
          bodyRendered: 'Another body',
        },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<EmployerCorrespondenceTab contactId="contact-1" />);
    expect(screen.getByText('Correspondence')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('Enrollment Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Contribution Notice')).toBeInTheDocument();
  });

  it('expands item body on click', () => {
    mockUseContactCorrespondence.mockReturnValue({
      data: [
        {
          correspondenceId: 'c-1',
          subject: 'Test Letter',
          sentAt: '2026-01-10',
          createdAt: '2026-01-10',
          sentVia: 'email',
          bodyRendered: 'Dear employer, this is a test.',
        },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<EmployerCorrespondenceTab contactId="contact-1" />);

    // Body should not be visible initially
    expect(screen.queryByText('Dear employer, this is a test.')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Test Letter'));
    expect(screen.getByText('Dear employer, this is a test.')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByText('Test Letter'));
    expect(screen.queryByText('Dear employer, this is a test.')).not.toBeInTheDocument();
  });
});
