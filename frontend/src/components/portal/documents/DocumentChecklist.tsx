import { C, BODY } from '@/lib/designSystem';
import { useDocumentChecklist } from '@/hooks/useDocumentChecklist';
import FileUpload from '@/components/portal/shared/FileUpload';
import type { ChecklistItem } from '@/hooks/useDocumentChecklist';

interface DocumentChecklistProps {
  memberId: string;
  memberStatus: string;
  memberData: Record<string, unknown>;
}

export default function DocumentChecklist({
  memberId,
  memberStatus,
  memberData,
}: DocumentChecklistProps) {
  const { items, outstanding, received, isLoading, error, uploadDocument, uploadingType } =
    useDocumentChecklist(memberId, memberStatus, memberData);

  if (isLoading) {
    return (
      <div data-testid="checklist-loading" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading checklist...
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="checklist-error" style={{ fontFamily: BODY, color: C.coral }}>
        Failed to load document checklist.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-testid="checklist-empty" style={{ fontFamily: BODY, color: C.textSecondary }}>
        No documents are currently required.
      </div>
    );
  }

  const outstandingItems = items.filter((i) => i.status === 'outstanding');
  const receivedItems = items.filter((i) => i.status === 'received');

  return (
    <div data-testid="document-checklist">
      {/* Summary bar */}
      <div
        data-testid="checklist-summary"
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 20,
          fontFamily: BODY,
          fontSize: 13,
        }}
      >
        <span style={{ color: outstanding > 0 ? C.coral : C.sage, fontWeight: 600 }}>
          {outstanding} outstanding
        </span>
        <span style={{ color: C.sage, fontWeight: 600 }}>{received} received</span>
      </div>

      {/* Outstanding documents */}
      {outstandingItems.length > 0 && (
        <div data-testid="outstanding-section" style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              margin: '0 0 12px',
            }}
          >
            Documents Needed
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {outstandingItems.map((item) => (
              <OutstandingCard
                key={item.rule.document_type}
                item={item}
                isUploading={uploadingType === item.rule.document_type}
                onFileSelected={(file) => uploadDocument(item.rule, file)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Received documents */}
      {receivedItems.length > 0 && (
        <div data-testid="received-section">
          <h3
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              margin: '0 0 12px',
            }}
          >
            Received
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {receivedItems.map((item) => (
              <ReceivedRow key={item.rule.document_type} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function OutstandingCard({
  item,
  isUploading,
  onFileSelected,
}: {
  item: ChecklistItem;
  isUploading: boolean;
  onFileSelected: (file: File) => void;
}) {
  return (
    <div
      data-testid={`checklist-item-${item.rule.document_type}`}
      style={{
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: 16,
        background: C.cardBg,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>
          {item.rule.label}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
          Accepted: {item.rule.accepted_formats.map((f) => f.toUpperCase()).join(', ')} &middot; Max{' '}
          {item.rule.max_size_mb}MB
        </div>
      </div>
      <FileUpload
        id={item.rule.document_type}
        label={item.rule.label}
        acceptedFormats={item.rule.accepted_formats}
        maxSizeMb={item.rule.max_size_mb}
        onFileSelected={onFileSelected}
        status={isUploading ? 'uploading' : 'idle'}
        compact
      />
    </div>
  );
}

function ReceivedRow({ item }: { item: ChecklistItem }) {
  const uploadDate = item.upload?.uploaded_at
    ? new Date(item.upload.uploaded_at).toLocaleDateString()
    : '';

  return (
    <div
      data-testid={`checklist-item-${item.rule.document_type}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: C.sageLight,
        borderRadius: 6,
        fontFamily: BODY,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.sage, fontSize: 16, flexShrink: 0 }}>&#10003;</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: C.text }}>{item.rule.label}</div>
        {item.upload && (
          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 1 }}>
            {item.upload.filename} &middot; {uploadDate}
          </div>
        )}
      </div>
      {item.upload && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.sage,
            background: 'rgba(92,131,116,0.12)',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {item.upload.status}
        </span>
      )}
    </div>
  );
}
