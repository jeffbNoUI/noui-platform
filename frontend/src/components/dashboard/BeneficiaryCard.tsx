import type { Beneficiary } from '@/types/Member';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

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
          {active.map((b) => (
            <div key={b.bene_id} className="px-5 py-3 flex items-center justify-between">
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
    </CollapsibleSection>
  );
}
