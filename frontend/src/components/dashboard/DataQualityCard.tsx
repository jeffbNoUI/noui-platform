import type { DemoDataQualityIssue } from '@/lib/demoData';

interface DataQualityCardProps {
  issues: DemoDataQualityIssue[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
};

export default function DataQualityCard({ issues }: DataQualityCardProps) {
  if (issues.length === 0) return null;

  const open = issues.filter((i) => i.status === 'open');
  if (open.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 shadow-sm">
      <div className="border-b border-amber-200 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-800">Data Quality</h3>
        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
          {open.length} issue{open.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-amber-100">
        {open.map((issue) => (
          <div key={issue.issueId} className="px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[issue.severity]}`}
              >
                {issue.severity}
              </span>
              <span className="text-xs font-mono text-gray-500">{issue.fieldName}</span>
            </div>
            <p className="text-xs text-gray-700">{issue.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
