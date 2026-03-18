import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import SurvivorClaimView, { type SurvivorClaim } from '../SurvivorClaimView';

// ── Test Data ───────────────────────────────────────────────────────────────

const MOCK_CLAIM: SurvivorClaim = {
  id: 'sc-1',
  retiree_name: 'Robert Martinez',
  current_stage: 'documents',
  estimated_survivor_benefit: 3877,
  payment_option_label: '100% Joint & Survivor',
  submitted_at: '2026-03-12',
  required_documents: [
    { id: 'doc-1', label: 'Certified Death Certificate', required: true, status: 'received' },
    { id: 'doc-2', label: 'Photo ID', required: true, status: 'not_submitted' },
    { id: 'doc-3', label: 'Marriage Certificate', required: true, status: 'not_submitted' },
    { id: 'doc-4', label: 'Voided Check or Bank Letter', required: false, status: 'not_submitted' },
  ],
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('SurvivorClaimView', () => {
  it('renders claim heading with retiree name', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    expect(screen.getByText('Survivor Benefit Claim')).toBeInTheDocument();
    expect(screen.getAllByText(/Robert Martinez/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows estimated monthly survivor benefit', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    const benefitCard = screen.getByTestId('estimated-benefit');
    expect(benefitCard.textContent).toContain('$3,877');
    expect(benefitCard.textContent).toContain('100% Joint & Survivor');
  });

  it('renders all 5 stages in the tracker', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('stage-notify')).toBeInTheDocument();
    expect(screen.getByTestId('stage-documents')).toBeInTheDocument();
    expect(screen.getByTestId('stage-review')).toBeInTheDocument();
    expect(screen.getByTestId('stage-staff_review')).toBeInTheDocument();
    expect(screen.getByTestId('stage-payments_begin')).toBeInTheDocument();
  });

  it('marks completed stages with checkmark', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    // 'notify' stage is before 'documents', so it should be completed
    expect(screen.getByTestId('stage-notify').textContent).toContain('\u2713');
  });

  it('shows current stage with bold text', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    const currentStage = screen.getByTestId('stage-documents');
    expect(currentStage.textContent).toContain('Documents Required');
    // Not checking exact styling, just that it doesn't have checkmark
    expect(currentStage.textContent).not.toContain('\u2713');
  });

  it('renders all required documents', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('doc-doc-1')).toBeInTheDocument();
    expect(screen.getByTestId('doc-doc-2')).toBeInTheDocument();
    expect(screen.getByTestId('doc-doc-3')).toBeInTheDocument();
    expect(screen.getByTestId('doc-doc-4')).toBeInTheDocument();
  });

  it('shows document status for each document', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('doc-doc-1').textContent).toContain('received');
    expect(screen.getByTestId('doc-doc-2').textContent).toContain('not submitted');
  });

  it('marks required documents with label', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    // Required documents should show "Required" badge
    expect(screen.getByTestId('doc-doc-1').textContent).toContain('Required');
    // Optional document should not
    expect(screen.getByTestId('doc-doc-4').textContent).not.toContain('Required');
  });

  it('renders stage tracker heading', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    expect(screen.getByText('Claim Progress')).toBeInTheDocument();
  });

  it('uses compassionate language — says "passing" not "death"', () => {
    renderWithProviders(<SurvivorClaimView claim={MOCK_CLAIM} />);
    const view = screen.getByTestId('survivor-claim-view');
    expect(view.textContent).toContain('passing');
    expect(view.textContent).not.toMatch(/\bthe death\b/i);
  });
});
