import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DocumentSection from '../DocumentSection';

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

    expect(screen.getByTestId('document-checklist-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('document-archive-placeholder')).not.toBeInTheDocument();
  });

  it('switches to All Documents tab', () => {
    renderWithProviders(<DocumentSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-archive'));

    expect(screen.getByTestId('document-archive-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('document-checklist-placeholder')).not.toBeInTheDocument();
  });

  it('switches back to My Checklist tab', () => {
    renderWithProviders(<DocumentSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-archive'));
    expect(screen.getByTestId('document-archive-placeholder')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-checklist'));
    expect(screen.getByTestId('document-checklist-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('document-archive-placeholder')).not.toBeInTheDocument();
  });
});
