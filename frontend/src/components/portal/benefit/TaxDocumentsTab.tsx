import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useTaxDocuments } from '@/hooks/usePayments';
import { changeRequestAPI } from '@/lib/memberPortalApi';

// ── Props ───────────────────────────────────────────────────────────────────

interface TaxDocumentsTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TaxDocumentsTab({ memberId }: TaxDocumentsTabProps) {
  const { data: documents, isLoading, error } = useTaxDocuments(memberId);
  const [paperRequested, setPaperRequested] = useState<Set<number>>(new Set());
  const [requesting, setRequesting] = useState(false);

  if (isLoading) {
    return (
      <div data-testid="tax-documents-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading tax documents…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="tax-documents-tab" style={{ fontFamily: BODY, color: C.coral }}>
        Unable to load tax documents. Please try again later.
      </div>
    );
  }

  const sortedDocs = [...(documents ?? [])].sort((a, b) => b.tax_year - a.tax_year);

  async function handleRequestPaperCopy(taxYear: number) {
    setRequesting(true);
    try {
      await changeRequestAPI.create({
        member_id: memberId,
        field_name: 'paper_1099r',
        current_value: '',
        proposed_value: `Paper 1099-R for ${taxYear}`,
        reason: `Member requested paper copy of ${taxYear} 1099-R`,
      });
      setPaperRequested((prev) => new Set(prev).add(taxYear));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div
      data-testid="tax-documents-tab"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <div>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 8px',
          }}
        >
          1099-R Tax Forms
        </h2>
        <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary, margin: '0 0 16px' }}>
          Download your 1099-R forms for tax filing. Forms are typically available by January 31
          each year.
        </p>
      </div>

      {sortedDocs.length === 0 ? (
        <div
          data-testid="no-tax-documents"
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            background: C.cardBgWarm,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: 24,
            textAlign: 'center',
          }}
        >
          No tax documents available yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedDocs.map((doc) => (
            <div
              key={doc.id}
              data-testid={`tax-doc-${doc.tax_year}`}
              style={{
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 10,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 16,
                    fontWeight: 600,
                    color: C.navy,
                    marginBottom: 2,
                  }}
                >
                  {doc.tax_year} 1099-R
                </div>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 13,
                    color: C.textSecondary,
                  }}
                >
                  {doc.available
                    ? 'Available for download'
                    : 'Not yet available — check back after January 31'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {doc.available && doc.download_url && (
                  <a
                    href={doc.download_url}
                    download
                    data-testid={`download-${doc.tax_year}`}
                    style={{
                      fontFamily: BODY,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.cardBg,
                      background: C.sage,
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Download PDF
                  </a>
                )}
                {doc.available && (
                  <button
                    data-testid={`request-paper-${doc.tax_year}`}
                    onClick={() => handleRequestPaperCopy(doc.tax_year)}
                    disabled={requesting || paperRequested.has(doc.tax_year)}
                    style={{
                      fontFamily: BODY,
                      fontSize: 13,
                      fontWeight: 500,
                      color: paperRequested.has(doc.tax_year) ? C.textTertiary : C.sage,
                      background: 'none',
                      border: `1px solid ${paperRequested.has(doc.tax_year) ? C.borderLight : C.sage}`,
                      borderRadius: 6,
                      padding: '8px 16px',
                      cursor: paperRequested.has(doc.tax_year) ? 'default' : 'pointer',
                    }}
                  >
                    {paperRequested.has(doc.tax_year) ? 'Requested' : 'Request Paper Copy'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
