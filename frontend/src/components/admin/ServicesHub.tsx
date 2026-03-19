import { useState } from 'react';
import {
  Heart,
  Database,
  ScrollText,
  BarChart3,
  Shield,
  AlertCircle,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import ServiceHealthDashboard from './ServiceHealthDashboard';
import DataQualityPanel from './DataQualityPanel';
import AuditTrailPanel from './AuditTrailPanel';
import OperationalMetricsPanel from './OperationalMetricsPanel';
import SecurityAccessPanel from './SecurityAccessPanel';
import IssueManagementPanel from './IssueManagementPanel';
import ConfigRulesPanel from './ConfigRulesPanel';

type HubTab = 'health' | 'dq' | 'audit' | 'metrics' | 'security' | 'issues' | 'config';

const TABS: { key: HubTab; label: string; icon: LucideIcon }[] = [
  { key: 'health', label: 'Health', icon: Heart },
  { key: 'dq', label: 'Data Quality', icon: Database },
  { key: 'audit', label: 'Audit Trail', icon: ScrollText },
  { key: 'metrics', label: 'Metrics', icon: BarChart3 },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'issues', label: 'Issues', icon: AlertCircle },
  { key: 'config', label: 'Config', icon: Settings },
];

export default function ServicesHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('health');

  return (
    <div className="space-y-4">
      <div
        className="bg-white rounded-lg border border-gray-200 px-2 overflow-x-auto"
        role="tablist"
      >
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                id={`hub-tab-${tab.key}`}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center whitespace-nowrap px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-iw-sage border-iw-sage'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline ml-1.5">{tab.label}</span>
              </button>
            );
          })}
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
