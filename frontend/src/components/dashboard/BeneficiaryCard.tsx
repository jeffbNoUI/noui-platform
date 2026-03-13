import { useState, useRef } from 'react';
import type { Beneficiary } from '@/types/Member';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import BeneficiaryDetail from '@/components/detail/BeneficiaryDetail';

interface BeneficiaryCardProps {
  beneficiaries?: Beneficiary[];
  isLoading: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  PRIMARY: 'Primary',
  CONTINGENT: 'Contingent',
  DEATH_BENEFIT: 'Death Benefit',
};

export default function BeneficiaryCard({ beneficiaries, isLoading }: BeneficiaryCardProps) {
  const active = beneficiaries?.filter((b) => !b.end_date) ?? [];
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleRowClick = (idx: number) => {
    const el = rowRefs.current.get(idx);
    if (el) {
      setSourceRect(el.getBoundingClientRect());
      setSelectedIdx(idx);
    }
  };

  return (
    <CollapsibleSection
      title="Beneficiaries"
      badge={isLoading ? undefined : active.length || undefined}
    >
      {isLoading && <div className="text-center text-sm text-gray-400">Loading...</div>}

      {!isLoading && active.length === 0 && (
        <div className="text-center text-sm text-amber-600">
          No beneficiary designations on file
        </div>
      )}

      {active.length > 0 && (
        <div className="-mx-5 -my-4 divide-y divide-gray-100">
          {active.map((b, idx) => (
            <div
              key={b.bene_id}
              ref={(el) => {
                if (el) rowRefs.current.set(idx, el);
                else rowRefs.current.delete(idx);
              }}
              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleRowClick(idx)}
            >
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {b.first_name} {b.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  {b.relationship || 'Relationship not specified'} &middot;{' '}
                  {TYPE_LABELS[b.bene_type] || b.bene_type}
                </div>
              </div>
              <span className="text-sm font-semibold text-iw-navy">{b.alloc_pct}%</span>
            </div>
          ))}
        </div>
      )}

      {selectedIdx !== null && sourceRect && (
        <BeneficiaryDetail
          item={active[selectedIdx]}
          sourceRect={sourceRect}
          onClose={() => setSelectedIdx(null)}
          items={active}
          currentIndex={selectedIdx}
          onNavigate={(newIdx) => {
            setSelectedIdx(newIdx);
          }}
        />
      )}
    </CollapsibleSection>
  );
}
