import { useState } from 'react';
import SupervisorDashboard from '@/components/staff/SupervisorDashboard';
import MemberSearch from '@/components/staff/MemberSearch';
import ExecutiveDashboard from '@/components/staff/ExecutiveDashboard';
import CSRContextHub from '@/components/staff/CSRContextHub';
import ServiceHealthDashboard from '@/components/admin/ServiceHealthDashboard';
import DataQualityPanel from '@/components/admin/DataQualityPanel';
import CorrespondencePanel from '@/components/workflow/CorrespondencePanel';
import StaffPortalKPIStats from './StaffPortalKPIStats';
import StaffPortalWorkQueue from './StaffPortalWorkQueue';
import { useCases, useStages } from '@/hooks/useCaseManagement';
import type { ViewMode } from '@/types/auth';

interface StaffPortalProps {
  onOpenCase: (
    caseId: string,
    memberId: number,
    retDate: string,
    flags?: string[],
    droId?: number,
  ) => void;
  onViewMember: (memberId: number) => void;
  onChangeView: (mode: ViewMode) => void;
}

type StaffTab =
  | 'queue'
  | 'search'
  | 'supervisor'
  | 'executive'
  | 'csr'
  | 'service-map'
  | 'dq'
  | 'correspondence';

const SIDEBAR_NAV = [
  { key: 'queue' as StaffTab, label: 'Work Queue', icon: '\ud83d\udccb', shortcut: 'G Q' },
  { key: 'search' as StaffTab, label: 'Member Lookup', icon: '\ud83d\udd0d', shortcut: 'G M' },
  { key: 'supervisor' as StaffTab, label: 'Supervisor', icon: '\ud83d\udcca', shortcut: 'G S' },
  { key: 'executive' as StaffTab, label: 'Executive', icon: '\ud83d\udcc8', shortcut: 'G E' },
  { key: 'csr' as StaffTab, label: 'CSR Hub', icon: '\ud83d\udcde', shortcut: 'G C' },
  {
    key: 'service-map' as StaffTab,
    label: 'Platform Health',
    icon: '\ud83d\uddfa\ufe0f',
    shortcut: 'G P',
  },
  { key: 'dq' as StaffTab, label: 'Data Quality', icon: '\ud83d\udee1\ufe0f', shortcut: 'G D' },
  {
    key: 'correspondence' as StaffTab,
    label: 'Correspondence',
    icon: '\u2709\ufe0f',
    shortcut: 'G X',
  },
];

export default function StaffPortal({ onOpenCase, onViewMember, onChangeView }: StaffPortalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StaffTab>('queue');

  const { data: cases = [] } = useCases({ status: 'active' });
  const { data: stages = [] } = useStages();
  const stageCount = stages.length || 7;

  const filteredQueue = cases.filter((item) => {
    const q = searchQuery.toLowerCase();
    const name = item.caseType === 'DRO' ? `${item.name} (DRO)` : item.name;
    return (
      name.toLowerCase().includes(q) ||
      item.caseId.toLowerCase().includes(q) ||
      item.dept.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: cases.length,
    urgent: cases.filter((w) => w.priority === 'urgent').length,
    atRisk: cases.filter((w) => w.sla === 'at-risk' || w.sla === 'urgent').length,
    avgDays:
      cases.length > 0 ? Math.round(cases.reduce((a, w) => a + w.daysOpen, 0) / cases.length) : 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-iw-navy to-iw-navyLight flex items-center justify-center text-white font-bold text-sm font-display">
              N
            </div>
            <div>
              <div className="text-sm font-bold text-iw-navy font-display leading-none">NoUI</div>
              <div className="text-[9px] text-gray-400 tracking-widest uppercase font-semibold">
                Staff Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2">
          {SIDEBAR_NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                activeTab === item.key
                  ? 'bg-iw-sageLight/50 text-iw-sage border-r-2 border-iw-sage'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <kbd className="text-[9px] text-gray-300 font-mono">{item.shortcut}</kbd>
            </button>
          ))}

          <div className="h-px bg-gray-200 my-2 mx-4" />

          {/* Portal links */}
          {(
            [
              { key: 'portal', label: 'Member Portal', icon: '\ud83d\udc64' },
              { key: 'workspace', label: 'Agent Workspace', icon: '\ud83e\uddee' },
              { key: 'crm', label: 'CRM', icon: '\ud83d\udcac' },
              { key: 'employer', label: 'Employer Portal', icon: '\ud83c\udfe2' },
              { key: 'vendor', label: 'Vendor Portal', icon: '\ud83c\udfe5' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => onChangeView(item.key)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-iw-sageLight flex items-center justify-center text-xs font-bold text-iw-sage">
              SC
            </div>
            <div>
              <div className="text-xs font-medium text-gray-700">Sarah Chen</div>
              <div className="text-[10px] text-gray-400">Benefits Analyst</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        {/* Top bar with search */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-700">
            {
              {
                queue: 'My Work Queue',
                search: 'Member / Employer Lookup',
                supervisor: 'Supervisor Dashboard',
                executive: 'Executive Dashboard',
                csr: 'CSR Context Hub',
                'service-map': 'Platform Health',
                dq: 'Data Quality',
                correspondence: 'Correspondence',
              }[activeTab]
            }
          </h1>
          {activeTab === 'queue' && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter cases..."
              className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-iw-sage focus:ring-1 focus:ring-iw-sage outline-none"
            />
          )}
          <div className="text-[10px] text-gray-300 font-mono">⌘K command palette</div>
        </div>

        <main className="p-6">
          {/* Work Queue tab */}
          {activeTab === 'queue' && (
            <>
              <StaffPortalKPIStats
                total={stats.total}
                urgent={stats.urgent}
                atRisk={stats.atRisk}
                avgDays={stats.avgDays}
              />
              <StaffPortalWorkQueue
                cases={filteredQueue}
                stageCount={stageCount}
                onOpenCase={onOpenCase}
              />
            </>
          )}

          {/* Member Search tab */}
          {activeTab === 'search' && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Search for a member or employer
                </h2>
                <MemberSearch onSelect={onViewMember} />
              </div>
              <div className="text-xs text-gray-400 text-center">
                Try: 10001, Robert Martinez, Public Works, Jennifer Kim
              </div>
            </div>
          )}

          {/* Supervisor Dashboard tab */}
          {activeTab === 'supervisor' && <SupervisorDashboard />}

          {/* Executive Dashboard tab */}
          {activeTab === 'executive' && <ExecutiveDashboard />}

          {/* CSR Context Hub tab */}
          {activeTab === 'csr' && <CSRContextHub />}

          {/* Service Map tab */}
          {activeTab === 'service-map' && <ServiceHealthDashboard />}

          {/* Data Quality tab */}
          {activeTab === 'dq' && <DataQualityPanel />}

          {/* Correspondence tab */}
          {activeTab === 'correspondence' && <CorrespondencePanel />}

          <footer className="mt-6 rounded-lg bg-gray-100 px-6 py-4 text-center text-xs text-gray-500">
            <p className="font-medium">NoUI Staff Portal</p>
            <p>
              AI-composed workspace. Cases are routed and prioritized based on member context, SLA
              status, and case complexity.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
