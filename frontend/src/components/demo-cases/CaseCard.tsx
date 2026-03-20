import type { DemoCase } from '@/types/Rules';

interface CaseCardProps {
  demoCase: DemoCase;
  onClick: () => void;
}

const tierColors: Record<string, string> = {
  '1': 'bg-blue-100 text-blue-700',
  '2': 'bg-green-100 text-green-700',
  '3': 'bg-amber-100 text-amber-700',
};

export default function CaseCard({ demoCase, onClick }: CaseCardProps) {
  const tier = String(demoCase.member.tier);
  const themes = demoCase.description
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md hover:border-iw-sage transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {demoCase.member.firstName} {demoCase.member.lastName}
        </h3>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${tierColors[tier] ?? 'bg-gray-100 text-gray-700'}`}
        >
          T{tier}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3">{demoCase.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {themes.map((theme, idx) => (
          <span
            key={idx}
            className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
          >
            {theme}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Retirement: {demoCase.retirementDate}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-700 font-medium">
          {demoCase.testPoints.length} tests
        </span>
      </div>
    </button>
  );
}
