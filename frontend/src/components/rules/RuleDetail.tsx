import { useState } from 'react';
import type { RuleDefinition } from '@/types/Rules';
import RuleLogicRenderer from './RuleLogicRenderer';
import RuleInputsOutputs from './RuleInputsOutputs';
import RuleTestCases from './RuleTestCases';
import RuleGovernance from './RuleGovernance';

interface RuleDetailProps {
  rule: RuleDefinition;
  onBack: () => void;
  onNavigateToRule?: (ruleId: string) => void;
  onNavigateToDemoCase?: (caseId: string) => void;
}

type Tab = 'logic' | 'io' | 'tests' | 'governance';

const TABS: { key: Tab; label: string }[] = [
  { key: 'logic', label: 'Logic' },
  { key: 'io', label: 'Inputs/Outputs' },
  { key: 'tests', label: 'Tests' },
  { key: 'governance', label: 'Governance' },
];

export default function RuleDetail({
  rule,
  onBack,
  onNavigateToRule,
  onNavigateToDemoCase,
}: RuleDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('logic');

  const status = rule.testStatus;
  const allPassing = status && status.failing === 0 && status.total > 0;
  const hasFailing = status && status.failing > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-1 shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Back to list"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-gray-500">{rule.id}</span>
            <h2 className="text-lg font-semibold text-gray-900">{rule.name}</h2>
            {rule.appliesTo.tiers.map((tier) => (
              <span
                key={tier}
                className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              >
                {tier}
              </span>
            ))}
            {status && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  allPassing
                    ? 'bg-green-100 text-green-800'
                    : hasFailing
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {status.passing}/{status.total} passing
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
          <p className="text-xs text-gray-400 mt-1">
            Source: {rule.sourceReference.document} &mdash; {rule.sourceReference.section}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-iw-sage text-iw-sage'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'logic' && <RuleLogicRenderer logic={rule.logic} />}
        {activeTab === 'io' && <RuleInputsOutputs inputs={rule.inputs} output={rule.output} />}
        {activeTab === 'tests' && (
          <RuleTestCases
            testCases={rule.testCases}
            testStatus={rule.testStatus}
            onNavigateToDemoCase={onNavigateToDemoCase}
          />
        )}
        {activeTab === 'governance' && (
          <RuleGovernance
            governance={rule.governance}
            sourceReference={rule.sourceReference}
            dependencies={rule.dependencies}
            onNavigateToRule={onNavigateToRule}
          />
        )}
      </div>
    </div>
  );
}
