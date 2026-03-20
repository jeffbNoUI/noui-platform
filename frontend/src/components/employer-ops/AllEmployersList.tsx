import { useMemo } from 'react';
import type { EmployerAlert, AlertSeverity } from '../../types/EmployerOps';

interface Org {
  orgId: string;
  name: string;
}

interface AllEmployersListProps {
  orgs: Org[];
  alerts: EmployerAlert[];
  onSelectEmployer: (orgId: string) => void;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const BADGE_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
};

interface OrgAlertInfo {
  count: number;
  worstSeverity: AlertSeverity | null;
}

export default function AllEmployersList({
  orgs,
  alerts,
  onSelectEmployer,
}: AllEmployersListProps) {
  const alertsByOrg = useMemo(() => {
    const map = new Map<string, OrgAlertInfo>();
    for (const alert of alerts) {
      const existing = map.get(alert.orgId);
      if (existing) {
        existing.count += 1;
        if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[existing.worstSeverity!]) {
          existing.worstSeverity = alert.severity;
        }
      } else {
        map.set(alert.orgId, { count: 1, worstSeverity: alert.severity });
      }
    }
    return map;
  }, [alerts]);

  const sorted = useMemo(() => [...orgs].sort((a, b) => a.name.localeCompare(b.name)), [orgs]);

  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        All Employers ({orgs.length})
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white max-h-64 overflow-y-auto divide-y divide-slate-100">
        {sorted.map((org) => {
          const info = alertsByOrg.get(org.orgId);
          return (
            <button
              key={org.orgId}
              onClick={() => onSelectEmployer(org.orgId)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
            >
              <span className="text-slate-700 truncate">{org.name}</span>
              {info && info.count > 0 && (
                <span
                  className={`ml-2 flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.worstSeverity!]}`}
                >
                  {info.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
