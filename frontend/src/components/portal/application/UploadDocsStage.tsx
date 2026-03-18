import { C, BODY } from '@/lib/designSystem';
import FileUpload from '@/components/portal/shared/FileUpload';
import type { RequiredDocument } from '@/types/RetirementApplication';

interface UploadDocsStageProps {
  documents: RequiredDocument[];
  onUpload: (documentType: string, file: File) => void;
  uploadStatuses: Record<string, 'idle' | 'uploading' | 'uploaded' | 'error'>;
  onComplete: () => void;
  bounceMessage?: string;
}

/** Accepted formats by document type (from plan profile) */
const ACCEPTED_FORMATS: Record<string, string[]> = {
  proof_of_age: ['pdf', 'jpg', 'png'],
  marriage_certificate: ['pdf', 'jpg', 'png'],
  direct_deposit_form: ['pdf'],
  tax_withholding: ['pdf'],
  divorce_decree: ['pdf'],
};

const MAX_SIZE: Record<string, number> = {
  divorce_decree: 20,
};

export default function UploadDocsStage({
  documents,
  onUpload,
  uploadStatuses,
  onComplete,
  bounceMessage,
}: UploadDocsStageProps) {
  const allUploaded = documents.filter((d) => d.required).every((d) => d.uploaded);
  const uploadedCount = documents.filter((d) => d.uploaded).length;

  return (
    <div data-testid="upload-docs-stage">
      {/* Stage header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: BODY,
            fontSize: 20,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 6px 0',
          }}
        >
          Upload Required Documents
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          Upload the documents needed for your retirement application. Required documents must be
          provided before you can proceed.
        </p>
      </div>

      {/* Bounce message */}
      {bounceMessage && (
        <div
          data-testid="bounce-message"
          style={{
            background: C.coralLight,
            border: `1px solid ${C.coral}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontFamily: BODY,
            fontSize: 14,
            color: C.coral,
          }}
        >
          <strong>Action needed:</strong> {bounceMessage}
        </div>
      )}

      {/* Document checklist */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {documents.map((doc, idx) => {
          const status = uploadStatuses[doc.document_type] || (doc.uploaded ? 'uploaded' : 'idle');
          const formats = ACCEPTED_FORMATS[doc.document_type] || ['pdf', 'jpg', 'png'];
          const maxSize = MAX_SIZE[doc.document_type] || 10;

          return (
            <div
              key={doc.document_type}
              data-testid={`doc-${doc.document_type}`}
              style={{
                padding: '14px 16px',
                borderBottom: idx < documents.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                background: doc.uploaded ? C.sageLight : 'transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: BODY,
                      fontSize: 15,
                      fontWeight: 600,
                      color: C.navy,
                    }}
                  >
                    {doc.label}
                  </span>
                  {doc.required && (
                    <span
                      data-testid={`required-badge-${doc.document_type}`}
                      style={{
                        fontFamily: BODY,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.coral,
                        marginLeft: 8,
                      }}
                    >
                      Required
                    </span>
                  )}
                </div>

                {doc.uploaded && (
                  <span
                    data-testid={`status-${doc.document_type}`}
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      fontWeight: 600,
                      color: doc.status === 'rejected' ? C.coral : C.sage,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: doc.status === 'rejected' ? C.coralLight : C.sageLight,
                    }}
                  >
                    {doc.status === 'rejected'
                      ? 'Rejected — re-upload'
                      : doc.status === 'processing'
                        ? 'Processing'
                        : 'Received'}
                  </span>
                )}
              </div>

              <FileUpload
                id={doc.document_type}
                label={doc.label}
                acceptedFormats={formats}
                maxSizeMb={maxSize}
                onFileSelected={(file) => onUpload(doc.document_type, file)}
                status={status}
                filename={doc.document_id ? `${doc.label} uploaded` : undefined}
                compact
              />
            </div>
          );
        })}
      </div>

      {/* Progress + continue */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
          padding: '16px 0',
          borderTop: `1px solid ${C.borderLight}`,
        }}
      >
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
          {uploadedCount} of {documents.length} documents uploaded
        </div>

        <button
          data-testid="continue-button"
          onClick={onComplete}
          disabled={!allUploaded}
          style={{
            fontFamily: BODY,
            fontSize: 15,
            fontWeight: 700,
            padding: '10px 28px',
            borderRadius: 8,
            border: 'none',
            background: allUploaded ? C.sage : C.borderLight,
            color: allUploaded ? '#FFFFFF' : C.textTertiary,
            cursor: allUploaded ? 'pointer' : 'default',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
