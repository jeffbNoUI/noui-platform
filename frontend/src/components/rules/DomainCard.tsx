// frontend/src/components/rules/DomainCard.tsx
import ProgressRing from './ProgressRing';
import type { DomainKey } from '@/lib/domainMapping';

interface DomainCardProps {
  domainKey: DomainKey;
  label: string;
  description: string;
  ruleCount: number;
  passingRules: number;
  onClick: () => void;
}

export default function DomainCard({
  label,
  description,
  ruleCount,
  passingRules,
  onClick,
}: DomainCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md hover:border-iw-sage hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        <ProgressRing passing={passingRules} total={ruleCount} />
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <span className="text-xs text-gray-500">
        {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
      </span>
    </button>
  );
}
