import type { DemoCase } from '@/types/Rules';
import CaseCard from './CaseCard';

interface CaseCardGridProps {
  cases: DemoCase[];
  onSelectCase: (caseId: string) => void;
}

export default function CaseCardGrid({ cases, onSelectCase }: CaseCardGridProps) {
  if (cases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">No demo cases available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cases.map((c) => (
        <CaseCard key={c.caseId} demoCase={c} onClick={() => onSelectCase(c.caseId)} />
      ))}
    </div>
  );
}
