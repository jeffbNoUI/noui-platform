import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UploadDocsStage from '../UploadDocsStage';
import type { RequiredDocument } from '@/types/RetirementApplication';

const SAMPLE_DOCS: RequiredDocument[] = [
  { document_type: 'proof_of_age', label: 'Proof of Age', required: true, uploaded: false },
  {
    document_type: 'direct_deposit_form',
    label: 'Direct Deposit Authorization',
    required: true,
    uploaded: false,
  },
  {
    document_type: 'tax_withholding',
    label: 'Tax Withholding Election (W-4P)',
    required: true,
    uploaded: false,
  },
  {
    document_type: 'marriage_certificate',
    label: 'Marriage Certificate',
    required: false,
    uploaded: false,
  },
];

function defaultProps(overrides: Partial<Parameters<typeof UploadDocsStage>[0]> = {}) {
  return {
    documents: SAMPLE_DOCS,
    onUpload: vi.fn(),
    uploadStatuses: {} as Record<string, 'idle' | 'uploading' | 'uploaded' | 'error'>,
    onComplete: vi.fn(),
    ...overrides,
  };
}

describe('UploadDocsStage', () => {
  it('renders all documents with labels', () => {
    render(<UploadDocsStage {...defaultProps()} />);

    expect(screen.getByTestId('doc-proof_of_age')).toHaveTextContent('Proof of Age');
    expect(screen.getByTestId('doc-direct_deposit_form')).toHaveTextContent('Direct Deposit');
    expect(screen.getByTestId('doc-tax_withholding')).toHaveTextContent('Tax Withholding');
    expect(screen.getByTestId('doc-marriage_certificate')).toHaveTextContent(
      'Marriage Certificate',
    );
  });

  it('shows required badge for required documents', () => {
    render(<UploadDocsStage {...defaultProps()} />);

    expect(screen.getByTestId('required-badge-proof_of_age')).toBeInTheDocument();
    expect(screen.getByTestId('required-badge-direct_deposit_form')).toBeInTheDocument();
    expect(screen.queryByTestId('required-badge-marriage_certificate')).not.toBeInTheDocument();
  });

  it('disables continue when required docs are not uploaded', () => {
    render(<UploadDocsStage {...defaultProps()} />);

    expect(screen.getByTestId('continue-button')).toBeDisabled();
  });

  it('enables continue when all required docs are uploaded', () => {
    const uploadedDocs = SAMPLE_DOCS.map((d) =>
      d.required ? { ...d, uploaded: true, document_id: 'doc-123' } : d,
    );
    render(<UploadDocsStage {...defaultProps({ documents: uploadedDocs })} />);

    expect(screen.getByTestId('continue-button')).not.toBeDisabled();
  });

  it('calls onComplete when continue is clicked', () => {
    const onComplete = vi.fn();
    const uploadedDocs = SAMPLE_DOCS.map((d) =>
      d.required ? { ...d, uploaded: true, document_id: 'doc-123' } : d,
    );
    render(<UploadDocsStage {...defaultProps({ documents: uploadedDocs, onComplete })} />);

    fireEvent.click(screen.getByTestId('continue-button'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows upload progress count', () => {
    const partialDocs = SAMPLE_DOCS.map((d, idx) =>
      idx === 0 ? { ...d, uploaded: true, document_id: 'doc-123' } : d,
    );
    render(<UploadDocsStage {...defaultProps({ documents: partialDocs })} />);

    expect(screen.getByText('1 of 4 documents uploaded')).toBeInTheDocument();
  });

  it('shows received status for uploaded documents', () => {
    const uploadedDocs = SAMPLE_DOCS.map((d) =>
      d.document_type === 'proof_of_age'
        ? { ...d, uploaded: true, document_id: 'doc-123', status: 'received' as const }
        : d,
    );
    render(<UploadDocsStage {...defaultProps({ documents: uploadedDocs })} />);

    expect(screen.getByTestId('status-proof_of_age')).toHaveTextContent('Received');
  });

  it('shows rejected status with re-upload prompt', () => {
    const rejectedDocs = SAMPLE_DOCS.map((d) =>
      d.document_type === 'proof_of_age'
        ? { ...d, uploaded: true, document_id: 'doc-123', status: 'rejected' as const }
        : d,
    );
    render(<UploadDocsStage {...defaultProps({ documents: rejectedDocs })} />);

    expect(screen.getByTestId('status-proof_of_age')).toHaveTextContent('Rejected');
  });

  it('shows bounce-back message when provided', () => {
    render(
      <UploadDocsStage
        {...defaultProps({ bounceMessage: 'Birth certificate was illegible. Please re-upload.' })}
      />,
    );

    expect(screen.getByTestId('bounce-message')).toHaveTextContent('illegible');
  });

  it('renders upload button for each document', () => {
    render(<UploadDocsStage {...defaultProps()} />);

    expect(screen.getByTestId('upload-btn-proof_of_age')).toBeInTheDocument();
    expect(screen.getByTestId('upload-btn-direct_deposit_form')).toBeInTheDocument();
  });
});
