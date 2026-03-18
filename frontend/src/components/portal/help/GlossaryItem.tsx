import { C, BODY } from '@/lib/designSystem';

interface GlossaryItemProps {
  term: string;
  definition: string;
  tierNote?: string;
}

export default function GlossaryItem({ term, definition, tierNote }: GlossaryItemProps) {
  return (
    <div
      data-testid={`glossary-item-${term.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        padding: '12px 0',
        borderBottom: `1px solid ${C.borderLight}`,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontSize: 14,
          fontWeight: 700,
          color: C.navy,
          marginBottom: 4,
        }}
      >
        {term}
      </div>
      <div
        style={{
          fontFamily: BODY,
          fontSize: 13,
          color: C.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {definition}
      </div>
      {tierNote && (
        <div
          style={{
            fontFamily: BODY,
            fontSize: 12,
            color: C.textTertiary,
            marginTop: 4,
            fontStyle: 'italic',
          }}
        >
          {tierNote}
        </div>
      )}
    </div>
  );
}
