import { useState } from 'react';
import type { DemoCase } from '@/types/Rules';
import MemberProfile from './MemberProfile';
import CalculationTrace from './CalculationTrace';
import TestPoints from './TestPoints';

interface CaseDetailProps {
  demoCase: DemoCase;
  onBack: () => void;
  onNavigateToRule?: (ruleId: string) => void;
}

type TabId = 'profile' | 'calculation' | 'tests';

const tabs: { id: TabId; label: string }[] = [
  { id: 'profile', label: 'Member Profile' },
  { id: 'calculation', label: 'Calculation Trace' },
  { id: 'tests', label: 'Test Points' },
];

const tierColors: Record<string, string> = {
  '1': 'bg-blue-100 text-blue-700',
  '2': 'bg-green-100 text-green-700',
  '3': 'bg-amber-100 text-amber-700',
};

export default function CaseDetail({ demoCase, onBack, onNavigateToRule }: CaseDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const tier = String(demoCase.member.tier);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {demoCase.caseId
                .replace(/^case(\d+)-/, 'Case $1: ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
                .replace(/^Case (\d+): (\w)/, (_, n, c) => `Case ${n}: ${c.toUpperCase()}`)}
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColors[tier] ?? 'bg-gray-100 text-gray-700'}`}
            >
              T{tier}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Retirement: {demoCase.retirementDate}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-iw-sage text-iw-sage'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && <MemberProfile demoCase={demoCase} />}
        {activeTab === 'calculation' && (
          <CalculationTrace demoCase={demoCase} onNavigateToRule={onNavigateToRule} />
        )}
        {activeTab === 'tests' && <TestPoints testPoints={demoCase.testPoints} />}
      </div>
    </div>
  );
}
