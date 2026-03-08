import type { Beneficiary } from '@/types/Member';

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
  // Only show active beneficiaries (no end_date)
  const active = beneficiaries?.filter((b) => !b.end_date) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Beneficiaries</h3>
      </div>

      {isLoading && <div className="px-5 py-6 text-center text-sm text-gray-400">Loading...</div>}

      {!isLoading && active.length === 0 && (
        <div className="px-5 py-6 text-center text-sm text-amber-600">
          No beneficiary designations on file
        </div>
      )}

      {active.length > 0 && (
        <div className="divide-y divide-gray-100">
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
    </div>
  );
}
