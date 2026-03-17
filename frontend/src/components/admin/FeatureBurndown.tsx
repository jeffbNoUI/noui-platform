import { useState } from 'react';
import {
  PLATFORM_SERVICES,
  getServicesByCategory,
  getOverallCompletion,
  getCategoryCompletion,
} from '@/data/platformServices';
import type { BuildStatus, Recommendation } from '@/data/platformServices';

const REC_STYLES: Record<Recommendation, string> = {
  BUILD: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HYBRID: 'bg-blue-50 text-blue-700 border-blue-200',
  BUY: 'bg-gray-50 text-gray-600 border-gray-200',
};

const STATUS_STYLES: Record<BuildStatus, string> = {
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'in-progress': 'bg-blue-50 text-blue-700 border-blue-200',
  planned: 'bg-amber-50 text-amber-700 border-amber-200',
  deferred: 'bg-gray-50 text-gray-500 border-gray-200',
};

function progressBarColor(pct: number): string {
  if (pct === 100) return 'bg-emerald-500';
  if (pct > 0) return 'bg-blue-500';
  return 'bg-gray-300';
}

function categoryBarColor(pct: number): string {
  if (pct === 100) return 'bg-emerald-500';
  if (pct > 0) return 'bg-blue-500';
  return 'bg-gray-300';
}

export default function FeatureBurndown() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const overallPct = getOverallCompletion();
  const categories = getServicesByCategory();

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Overall completion */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-700">Platform Completion</h3>
          <span className="text-2xl font-bold text-gray-900">{overallPct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          {PLATFORM_SERVICES.filter((s) => s.buildStatus === 'complete').length} of{' '}
          {PLATFORM_SERVICES.length} services complete
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">Category Breakdown</h3>
        </div>

        {Array.from(categories.entries()).map(([category, services]) => {
          const catPct = getCategoryCompletion(category);
          const isExpanded = expanded.has(category);

          return (
            <div key={category}>
              <button
                onClick={() => toggle(category)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  isExpanded ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{isExpanded ? '\u25bc' : '\u25b6'}</span>
                  <span className="text-sm font-semibold text-gray-700">{category}</span>
                  <span className="text-[10px] text-gray-400">({services.length})</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${categoryBarColor(catPct)}`}
                      style={{ width: `${catPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-8 text-right">
                    {catPct}%
                  </span>
                </div>
              </button>

              {isExpanded &&
                services.map((svc) => (
                  <div
                    key={svc.name}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 pl-10"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700">{svc.name}</div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${REC_STYLES[svc.rec]}`}
                    >
                      {svc.rec}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[svc.buildStatus]}`}
                    >
                      {svc.buildStatus}
                    </span>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressBarColor(svc.completionPct)}`}
                        style={{ width: `${svc.completionPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8 text-right">
                      {svc.completionPct}%
                    </span>
                    {svc.targetSprint && (
                      <span className="text-[9px] text-gray-400 w-10 text-right">
                        S{svc.targetSprint}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
