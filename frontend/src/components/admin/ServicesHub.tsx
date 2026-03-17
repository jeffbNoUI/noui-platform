import { useState } from 'react';
import ServiceHealthDashboard from './ServiceHealthDashboard';
import DataQualityPanel from './DataQualityPanel';
import AuditTrailPanel from './AuditTrailPanel';
import OperationalMetricsPanel from './OperationalMetricsPanel';
import SecurityAccessPanel from './SecurityAccessPanel';
import IssueManagementPanel from './IssueManagementPanel';
import ConfigRulesPanel from './ConfigRulesPanel';

type HubTab = 'health' | 'dq' | 'audit' | 'metrics' | 'security' | 'issues' | 'config';

const TABS: { key: HubTab; label: string }[] = [
  { key: 'health', label: 'Health' },
  { key: 'dq', label: 'Data Quality' },
  { key: 'audit', label: 'Audit Trail' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'security', label: 'Security' },
  { key: 'issues', label: 'Issues' },
  { key: 'config', label: 'Config' },
];

export default function ServicesHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('health');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 px-2" role="tablist">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={`hub-tab-${tab.key}`}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'text-iw-sage border-iw-sage'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-labelledby={`hub-tab-${activeTab}`}>
        {activeTab === 'health' && <ServiceHealthDashboard />}
        {activeTab === 'dq' && <DataQualityPanel />}
        {activeTab === 'audit' && <AuditTrailPanel />}
        {activeTab === 'metrics' && <OperationalMetricsPanel />}
        {activeTab === 'security' && <SecurityAccessPanel />}
        {activeTab === 'issues' && <IssueManagementPanel />}
        {activeTab === 'config' && <ConfigRulesPanel />}
      </div>
    </div>
  );
}
