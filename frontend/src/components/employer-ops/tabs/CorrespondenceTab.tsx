import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useEmployerTemplates } from '@/hooks/useEmployerOps';
import type { CorrespondenceTemplate } from '@/types/Correspondence';
import GenerateLetterDialog from '../actions/GenerateLetterDialog';

interface CorrespondenceTabProps {
  orgId: string;
}

const categoryColors: Record<string, { bg: string; fg: string }> = {
  onboarding: { bg: C.sageLight, fg: C.sage },
  compliance: { bg: C.coralMuted, fg: C.coral },
  reporting: { bg: '#E8F4FD', fg: C.sky },
  general: { bg: '#F0F0F0', fg: C.textSecondary },
};

function getCategoryStyle(category: string) {
  return categoryColors[category.toLowerCase()] ?? categoryColors.general;
}

export default function CorrespondenceTab({ orgId }: CorrespondenceTabProps) {
  const { data, isLoading } = useEmployerTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<CorrespondenceTemplate | null>(null);

  const templates = data?.items ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: 24, color: C.textTertiary, fontSize: 14 }}>Loading templates...</div>
    );
  }

  if (templates.length === 0) {
    return (
      <div style={{ padding: 24, color: C.textTertiary, fontSize: 14 }}>
        No correspondence templates available.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {templates.map((tpl) => {
          const catStyle = getCategoryStyle(tpl.category);
          return (
            <div
              key={tpl.templateId}
              style={{
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Template name */}
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.navy,
                }}
              >
                {tpl.templateName}
              </div>

              {/* Description */}
              {tpl.description && (
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4 }}>
                  {tpl.description}
                </div>
              )}

              {/* Category badge + merge field count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: catStyle.fg,
                    background: catStyle.bg,
                    borderRadius: 10,
                    padding: '2px 8px',
                    textTransform: 'capitalize',
                  }}
                >
                  {tpl.category}
                </span>
                <span style={{ fontSize: 12, color: C.textTertiary }}>
                  {tpl.mergeFields.length} merge field{tpl.mergeFields.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Generate button */}
              <button
                onClick={() => setSelectedTemplate(tpl)}
                style={{
                  marginTop: 'auto',
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: BODY,
                  color: '#fff',
                  background: C.sage,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                Generate
              </button>
            </div>
          );
        })}
      </div>

      {selectedTemplate && (
        <GenerateLetterDialog
          orgId={orgId}
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </>
  );
}
