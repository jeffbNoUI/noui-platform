import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { C, BODY } from '@/lib/designSystem';
import { documentAPI } from '@/lib/memberPortalApi';
import type { DocumentUpload } from '@/types/MemberPortal';

interface DocumentArchiveProps {
  memberId: string;
}

type DocCategory = 'uploaded' | 'from_plan' | 'dro';

interface CategorizedDocs {
  uploaded: DocumentUpload[];
  from_plan: DocumentUpload[];
  dro: DocumentUpload[];
}

/** Group documents into the three archive categories. */
function categorize(docs: DocumentUpload[]): CategorizedDocs {
  const result: CategorizedDocs = { uploaded: [], from_plan: [], dro: [] };
  for (const doc of docs) {
    if (doc.document_type.includes('dro') || doc.document_type.includes('divorce')) {
      result.dro.push(doc);
    } else if (doc.context === 'plan_generated' || doc.document_type.includes('1099')) {
      result.from_plan.push(doc);
    } else {
      result.uploaded.push(doc);
    }
  }
  return result;
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  uploaded: 'Documents You Uploaded',
  from_plan: 'Documents From Plan',
  dro: 'DRO Court Orders',
};

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'proof_of_age', label: 'Proof of Age' },
  { value: 'marriage_certificate', label: 'Marriage Certificate' },
  { value: 'direct_deposit_form', label: 'Direct Deposit' },
  { value: 'tax_withholding', label: 'Tax Withholding' },
  { value: 'divorce_decree', label: 'Divorce Decree / DRO' },
  { value: 'death_certificate', label: 'Death Certificate' },
];

export default function DocumentArchive({ memberId }: DocumentArchiveProps) {
  const [typeFilter, setTypeFilter] = useState('');

  const {
    data: allDocs = [],
    isLoading,
    error,
  } = useQuery<DocumentUpload[]>({
    queryKey: ['member-documents', memberId],
    queryFn: () => documentAPI.list(Number(memberId)),
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <div data-testid="archive-loading" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading documents...
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="archive-error" style={{ fontFamily: BODY, color: C.coral }}>
        Failed to load documents.
      </div>
    );
  }

  const filtered = typeFilter ? allDocs.filter((d) => d.document_type === typeFilter) : allDocs;
  const categorized = categorize(filtered);
  const categories: DocCategory[] = ['uploaded', 'from_plan', 'dro'];
  const hasAny = filtered.length > 0;

  return (
    <div data-testid="document-archive">
      {/* Filter bar */}
      <div style={{ marginBottom: 16 }}>
        <select
          data-testid="archive-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
            color: C.text,
          }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {!hasAny && (
        <div data-testid="archive-empty" style={{ fontFamily: BODY, color: C.textSecondary }}>
          No documents found.
        </div>
      )}

      {categories.map((cat) => {
        const docs = categorized[cat];
        if (docs.length === 0) return null;
        return (
          <div key={cat} data-testid={`archive-group-${cat}`} style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                margin: '0 0 10px',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {docs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} isDRO={cat === 'dro'} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

function DocumentRow({ doc, isDRO }: { doc: DocumentUpload; isDRO: boolean }) {
  const dateStr = new Date(doc.uploaded_at).toLocaleDateString();

  const handleDownload = async () => {
    try {
      const result = await documentAPI.download(doc.id);
      window.open(result.download_url, '_blank');
    } catch {
      // silently fail — user can retry
    }
  };

  return (
    <div
      data-testid={`archive-row-${doc.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 6,
        fontFamily: BODY,
        fontSize: 13,
      }}
    >
      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            color: C.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.filename}
        </div>
        <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
          {doc.document_type.replace(/_/g, ' ')} &middot; {dateStr}
        </div>
      </div>

      {/* Status badge */}
      <span
        data-testid={`status-${doc.id}`}
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 4,
          flexShrink: 0,
          ...(doc.status === 'received'
            ? { color: C.sage, background: 'rgba(92,131,116,0.12)' }
            : doc.status === 'rejected'
              ? { color: C.coral, background: 'rgba(229,115,115,0.12)' }
              : { color: C.textTertiary, background: C.borderLight }),
        }}
      >
        {doc.status}
      </span>

      {/* Action */}
      {isDRO ? (
        <button
          data-testid={`request-copy-${doc.id}`}
          style={{
            fontFamily: BODY,
            fontSize: 12,
            fontWeight: 600,
            color: C.sage,
            background: 'none',
            border: `1px solid ${C.sage}`,
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Request Copy
        </button>
      ) : (
        <button
          data-testid={`download-${doc.id}`}
          onClick={handleDownload}
          style={{
            fontFamily: BODY,
            fontSize: 12,
            fontWeight: 600,
            color: C.navy,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            flexShrink: 0,
          }}
        >
          Download
        </button>
      )}
    </div>
  );
}
