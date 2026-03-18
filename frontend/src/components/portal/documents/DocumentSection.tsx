import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import DocumentChecklist from './DocumentChecklist';
import DocumentArchive from './DocumentArchive';

interface DocumentSectionProps {
  memberId: string;
  memberStatus?: string;
  memberData?: Record<string, unknown>;
}

type SubTab = 'checklist' | 'archive';

const TABS: { key: SubTab; label: string }[] = [
  { key: 'checklist', label: 'My Checklist' },
  { key: 'archive', label: 'All Documents' },
];

export default function DocumentSection({
  memberId,
  memberStatus = 'ACTIVE',
  memberData = {},
}: DocumentSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('checklist');

  return (
    <div data-testid="documents-section">
      {/* Section heading */}
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 24,
          fontWeight: 600,
          color: C.text,
          margin: '0 0 20px',
        }}
      >
        Documents
      </h2>

      {/* Sub-tab bar */}
      <div
        data-testid="documents-tabs"
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: `2px solid ${C.borderLight}`,
          marginBottom: 24,
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? C.sage : C.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === key ? `2px solid ${C.sage}` : '2px solid transparent',
              padding: '10px 20px',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'checklist' && (
        <DocumentChecklist
          memberId={memberId}
          memberStatus={memberStatus}
          memberData={memberData}
        />
      )}
      {activeTab === 'archive' && <DocumentArchive memberId={memberId} />}
    </div>
  );
}
