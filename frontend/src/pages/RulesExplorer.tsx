import { useState, useMemo } from 'react';
import { useRuleDefinitions } from '@/hooks/useRuleDefinitions';
import { useTestReport } from '@/hooks/useTestReport';
import RulesSummaryBar from '@/components/rules/RulesSummaryBar';
import DomainFilter from '@/components/rules/DomainFilter';
import RulesList from '@/components/rules/RulesList';
import RuleDetail from '@/components/rules/RuleDetail';
import type { RuleDefinition } from '@/types/Rules';

interface RulesExplorerProps {
  onNavigateToRule?: (ruleId: string) => void;
  onNavigateToDemoCase?: (caseId: string) => void;
  initialRuleId?: string;
}

export default function RulesExplorer({
  onNavigateToRule,
  onNavigateToDemoCase,
  initialRuleId,
}: RulesExplorerProps) {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(initialRuleId ?? null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rules, isLoading, isError } = useRuleDefinitions(selectedDomain || undefined);
  const { data: testReport } = useTestReport();

  // Merge test status into rules
  const enrichedRules = useMemo(() => {
    if (!rules) return [];
    if (!testReport?.byRule) return rules;
    return rules.map((rule): RuleDefinition => {
      const summary = testReport.byRule[rule.id];
      if (!summary) return rule;
      return {
        ...rule,
        testStatus: {
          total: summary.total,
          passing: summary.passing,
          failing: summary.failing,
          skipped: summary.skipped,
          lastRun: testReport.lastRun,
        },
      };
    });
  }, [rules, testReport]);

  // Extract unique domains
  const domains = useMemo(() => {
    if (!enrichedRules) return [];
    const set = new Set(enrichedRules.map((r) => r.domain).filter(Boolean));
    return Array.from(set).sort();
  }, [enrichedRules]);

  // Aggregate summary
  const summary = useMemo(() => {
    const total = enrichedRules.length;
    const passing = enrichedRules.filter(
      (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
    ).length;
    const failing = enrichedRules.filter((r) => r.testStatus && r.testStatus.failing > 0).length;
    return { total, passing, failing };
  }, [enrichedRules]);

  // Selected rule for detail view
  const selectedRule = useMemo(
    () => enrichedRules.find((r) => r.id === selectedRuleId) ?? null,
    [enrichedRules, selectedRuleId],
  );

  const handleSelectRule = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    onNavigateToRule?.(ruleId);
  };

  const handleBack = () => {
    setSelectedRuleId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading rules...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-red-500">Failed to load rules. Please try again.</div>
      </div>
    );
  }

  // Detail view
  if (selectedRule) {
    return (
      <RuleDetail
        rule={selectedRule}
        onBack={handleBack}
        onNavigateToRule={handleSelectRule}
        onNavigateToDemoCase={onNavigateToDemoCase}
      />
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <RulesSummaryBar
        totalRules={summary.total}
        passingRules={summary.passing}
        failingRules={summary.failing}
        lastRun={testReport?.lastRun}
      />

      <div className="flex items-center gap-4 flex-wrap">
        <DomainFilter domains={domains} selected={selectedDomain} onSelect={setSelectedDomain} />
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search rules by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-iw-sage/30 focus:border-iw-sage"
          />
        </div>
      </div>

      <RulesList rules={enrichedRules} searchQuery={searchQuery} onSelectRule={handleSelectRule} />
    </div>
  );
}
