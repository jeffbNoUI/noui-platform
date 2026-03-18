import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DocumentSection from '../DocumentSection';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock child components to isolate DocumentSection tab-switching logic
vi.mock('../DocumentChecklist', () => ({
  default: () => <div data-testid="document-checklist">Checklist content</div>,
}));

vi.mock('../DocumentArchive', () => ({
  default: () => <div data-testid="document-archive">Archive content</div>,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DocumentSection', () => {
  it('renders with two tabs', () => {
    renderWithProviders(<DocumentSection memberId="10001" />);

    expect(screen.getByTestId('documents-section')).toBeInTheDocument();
    expect(screen.getByTestId('tab-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('tab-archive')).toBeInTheDocument();
  });

  it('defaults to My Checklist tab', () => {
    renderWithProviders(<DocumentSection memberId="10001" />);

    expect(screen.getByTestId('document-checklist')).toBeInTheDocument();
    expect(screen.queryByTestId('document-archive')).not.toBeInTheDocument();
  });

  it('switches to All Documents tab', () => {
    renderWithProviders(<DocumentSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-archive'));

    expect(screen.getByTestId('document-archive')).toBeInTheDocument();
    expect(screen.queryByTestId('document-checklist')).not.toBeInTheDocument();
  });

  it('switches back to My Checklist tab', () => {
    renderWithProviders(<DocumentSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-archive'));
    expect(screen.getByTestId('document-archive')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-checklist'));
    expect(screen.getByTestId('document-checklist')).toBeInTheDocument();
    expect(screen.queryByTestId('document-archive')).not.toBeInTheDocument();
  });

  it('passes memberStatus and memberData to checklist', () => {
    // This is an integration-level smoke test — we verify DocumentSection
    // renders without errors when memberStatus and memberData are provided
    renderWithProviders(
      <DocumentSection
        memberId="10001"
        memberStatus="ACTIVE"
        memberData={{ marital_status: 'married' }}
      />,
    );

    expect(screen.getByTestId('document-checklist')).toBeInTheDocument();
  });
});
