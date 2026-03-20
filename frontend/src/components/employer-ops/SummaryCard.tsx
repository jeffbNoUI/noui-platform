import type { ReactNode } from 'react';

interface Metric {
  label: string;
  value: string | number;
  color?: string; // Tailwind text color class
}

interface SummaryCardProps {
  title: string;
  metrics: Metric[];
  linkLabel?: string;
  onLink?: () => void;
  comingSoon?: boolean;
  children?: ReactNode;
}

export default function SummaryCard({
  title,
  metrics,
  linkLabel,
  onLink,
  comingSoon,
  children,
}: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 min-h-[140px] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
          {comingSoon && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              Coming Soon
            </span>
          )}
        </div>

        {!comingSoon && (
          <ul className="space-y-1.5">
            {metrics.map((m) => (
              <li key={m.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{m.label}</span>
                <span
                  className={`text-sm font-semibold tabular-nums ${m.color ?? 'text-gray-900'}`}
                >
                  {m.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!comingSoon && (
        <div className="mt-3">
          {children}
          {linkLabel && onLink && (
            <button
              type="button"
              onClick={onLink}
              className="text-xs font-medium text-[#87A878] hover:text-[#6b8c5e] transition-colors"
            >
              {linkLabel} &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
