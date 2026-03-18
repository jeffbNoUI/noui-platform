import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { getPlanProfile } from '@/lib/planProfile';
import GlossaryItem from './GlossaryItem';

interface ContextualHelpPanelProps {
  sectionId: string;
  memberTier?: string;
}

// Map section IDs to relevant glossary terms
const SECTION_TERMS: Record<string, string[]> = {
  calculator: [
    'AMS',
    'Vesting',
    'Purchased Service',
    'Early Retirement Reduction',
    'Rule of 75',
    'Rule of 85',
  ],
  profile: ['Vesting', 'AMS'],
  dashboard: ['Rule of 75', 'Rule of 85', 'Vesting'],
};

export default function ContextualHelpPanel({ sectionId, memberTier }: ContextualHelpPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const profile = getPlanProfile();
  const allTerms = profile.help_content.plan_specific_terms;

  // Filter terms relevant to this section and tier
  const relevantTermNames = SECTION_TERMS[sectionId] ?? [];
  const terms = allTerms.filter((t) => {
    if (!relevantTermNames.includes(t.term)) return false;
    if (t.applies_to_tiers && memberTier && !t.applies_to_tiers.includes(memberTier)) return false;
    return true;
  });

  if (terms.length === 0) return null;

  return (
    <div data-testid="contextual-help-panel">
      <button
        data-testid="help-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontFamily: BODY,
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          background: isOpen ? C.skyLight : 'transparent',
          color: isOpen ? C.navy : C.textSecondary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 16 }}>?</span>
        {isOpen ? 'Hide Help' : 'Help'}
      </button>

      {isOpen && (
        <div
          data-testid="help-content"
          style={{
            marginTop: 12,
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: '4px 16px',
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 12,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '12px 0 4px',
            }}
          >
            Key Terms
          </div>
          {terms.map((t) => (
            <GlossaryItem
              key={t.term}
              term={t.term}
              definition={t.definition}
              tierNote={
                t.applies_to_tiers
                  ? `Applies to: ${t.applies_to_tiers.map((tid) => tid.replace('_', ' ')).join(', ')}`
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
