import { useState } from 'react';
import SupervisorDashboard from '@/components/staff/SupervisorDashboard';
import MemberSearch from '@/components/staff/MemberSearch';
import ExecutiveDashboard from '@/components/staff/ExecutiveDashboard';
import CSRContextHub from '@/components/staff/CSRContextHub';
import ServiceMap from '@/components/admin/ServiceMap';
import DataQualityPanel from '@/components/admin/DataQualityPanel';
import CorrespondencePanel from '@/components/workflow/CorrespondencePanel';
import { useCases, useStages } from '@/hooks/useCaseManagement';

interface StaffPortalProps {
  onOpenCase: (
    caseId: string,
    memberId: number,
    retDate: string,
    flags?: string[],
    droId?: number,
  ) => void;
  onViewMember: (memberId: number) => void;
  onChangeView: (mode: string) => void;
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

const PRIORITY_STYLES = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  standard: 'bg-gray-50 text-gray-600 border-gray-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
};

const SLA_STYLES = {
  'on-track': { label: 'On Track', className: 'bg-emerald-50 text-emerald-700' },
  'at-risk': { label: 'At Risk', className: 'bg-amber-50 text-amber-700' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-700' },
};

const TIER_STYLES: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const SIDEBAR_NAV = [
  { key: 'queue' as StaffTab, label: 'Work Queue', icon: '\ud83d\udccb', shortcut: 'G Q' },
  { key: 'search' as StaffTab, label: 'Member Lookup', icon: '\ud83d\udd0d', shortcut: 'G M' },
  { key: 'supervisor' as StaffTab, label: 'Supervisor', icon: '\ud83d\udcca', shortcut: 'G S' },
  { key: 'executive' as StaffTab, label: 'Executive', icon: '\ud83d\udcc8', shortcut: 'G E' },
  { key: 'csr' as StaffTab, label: 'CSR Hub', icon: '\ud83d\udcde', shortcut: 'G C' },
  {
    key: 'service-map' as StaffTab,
    label: 'Service Map',
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

  // For DRO cases, append "(DRO)" to the name for display
  const displayName = (c: { name: string; caseType: string }) =>
    c.caseType === 'DRO' ? `${c.name} (DRO)` : c.name;

  const filteredQueue = cases.filter(
    (item) =>
      displayName(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dept.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const stats = {
    total: cases.length,
    urgent: cases.filter((w) => w.priority === 'urgent').length,
    atRisk: cases.filter((w) => w.sla === 'at-risk' || w.sla === 'urgent').length,
    avgDays:
      cases.length > 0 ? Math.round(cases.reduce((a, w) => a + w.daysOpen, 0) / cases.length) : 0,
  };

  const handleMemberSelect = (memberId: number) => {
    onViewMember(memberId);
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
          {[
            { key: 'portal', label: 'Member Portal', icon: '\ud83d\udc64' },
            { key: 'workspace', label: 'Agent Workspace', icon: '\ud83e\uddee' },
            { key: 'crm', label: 'CRM', icon: '\ud83d\udcac' },
            { key: 'employer', label: 'Employer Portal', icon: '\ud83c\udfe2' },
            { key: 'vendor', label: 'Vendor Portal', icon: '\ud83c\udfe5' },
          ].map((item) => (
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
                'service-map': 'Platform Service Map',
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
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    Active Cases
                  </div>
                  <div className="text-2xl font-bold text-iw-navy mt-1">{stats.total}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    Urgent
                  </div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{stats.urgent}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    SLA At Risk
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{stats.atRisk}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    Avg Days Open
                  </div>
                  <div className="text-2xl font-bold text-gray-700 mt-1">{stats.avgDays}</div>
                </div>
              </div>

              {/* Queue table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">Priority</div>
                  <div className="col-span-2">Case ID</div>
                  <div className="col-span-3">Member</div>
                  <div className="col-span-2">Current Stage</div>
                  <div className="col-span-1">SLA</div>
                  <div className="col-span-1">Days</div>
                  <div className="col-span-2">Flags</div>
                </div>

                {filteredQueue.map((item) => (
                  <div
                    key={item.caseId}
                    onClick={() =>
                      onOpenCase(item.caseId, item.memberId, item.retDate, item.flags, item.droId)
                    }
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 hover:bg-iw-sageLight/30 cursor-pointer transition-colors items-center"
                  >
                    <div className="col-span-1">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[item.priority]}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-mono font-semibold text-iw-navy">
                        {item.caseId}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_STYLES[item.tier]}`}
                        >
                          T{item.tier}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {displayName(item)}
                          </div>
                          <div className="text-xs text-gray-500">{item.dept}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-700">{item.stage}</div>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: stageCount }, (_, idx) => (
                          <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full ${
                              idx < item.stageIdx
                                ? 'bg-iw-sage'
                                : idx === item.stageIdx
                                  ? 'bg-iw-sage animate-pulse'
                                  : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SLA_STYLES[item.sla].className}`}
                      >
                        {SLA_STYLES[item.sla].label}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm text-gray-600">{item.daysOpen}d</span>
                    </div>
                    <div className="col-span-2">
                      <div className="flex flex-wrap gap-1">
                        {item.flags.map((flag) => (
                          <span
                            key={flag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredQueue.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    No cases match your search.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Member Search tab */}
          {activeTab === 'search' && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Search for a member or employer
                </h2>
                <MemberSearch onSelect={handleMemberSelect} />
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
          {activeTab === 'service-map' && <ServiceMap />}

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
