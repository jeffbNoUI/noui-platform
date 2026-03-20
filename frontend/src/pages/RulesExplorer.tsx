import { useState, useMemo } from 'react';
import { useRuleDefinitions } from '@/hooks/useRuleDefinitions';
import { useTestReport } from '@/hooks/useTestReport';
import RulesSummaryBar from '@/components/rules/RulesSummaryBar';
import DomainCardGrid from '@/components/rules/DomainCardGrid';
import RuleCardGrid from '@/components/rules/RuleCardGrid';
import RuleDetail from '@/components/rules/RuleDetail';
import Breadcrumb from '@/components/rules/Breadcrumb';
import type { BreadcrumbSegment } from '@/components/rules/Breadcrumb';
import type { RuleDefinition } from '@/types/Rules';
import type { ViewMode } from '@/types/auth';
import { getDomainForRule, DOMAIN_META, type DomainKey } from '@/lib/domainMapping';

interface RulesExplorerProps {
  onNavigateToRule?: (ruleId: string) => void;
  onNavigateToDemoCase?: (caseId: string) => void;
  onChangeView?: (mode: ViewMode) => void;
  initialRuleId?: string;
}

export default function RulesExplorer({
  onNavigateToRule,
  onNavigateToDemoCase,
  onChangeView,
  initialRuleId,
}: RulesExplorerProps) {
  const [selectedDomain, setSelectedDomain] = useState<DomainKey | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(initialRuleId ?? null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rules, isLoading, isError } = useRuleDefinitions();
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

  // Filter rules for current domain
  const domainRules = useMemo(() => {
    if (!selectedDomain) return enrichedRules;
    return enrichedRules.filter((r) => getDomainForRule(r.id) === selectedDomain);
  }, [enrichedRules, selectedDomain]);

  // Search filter (applies at current level)
  const filteredRules = useMemo(() => {
    if (!searchQuery) return domainRules;
    const q = searchQuery.toLowerCase();
    return domainRules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [domainRules, searchQuery]);

  // Summary stats scoped to current view
  const summary = useMemo(() => {
    const source = selectedDomain ? filteredRules : enrichedRules;
    const total = source.length;
    const passing = source.filter(
      (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
    ).length;
    const failing = source.filter((r) => r.testStatus && r.testStatus.failing > 0).length;
    return { total, passing, failing };
  }, [enrichedRules, filteredRules, selectedDomain]);

  // Selected rule for detail view
  const selectedRule = useMemo(
    () => enrichedRules.find((r) => r.id === selectedRuleId) ?? null,
    [enrichedRules, selectedRuleId],
  );

  // Navigation handlers
  const goToLevel1 = () => {
    setSelectedDomain(null);
    setSelectedRuleId(null);
    setSearchQuery('');
  };

  const goToLevel2 = (domain: DomainKey) => {
    setSelectedDomain(domain);
    setSelectedRuleId(null);
    setSearchQuery('');
  };

  const goToLevel3 = (ruleId: string) => {
    if (!selectedDomain) {
      setSelectedDomain(getDomainForRule(ruleId));
    }
    setSelectedRuleId(ruleId);
    onNavigateToRule?.(ruleId);
  };

  // Breadcrumb segments
  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [{ label: 'Rules Explorer', onClick: goToLevel1 }];
    if (selectedDomain) {
      segments.push({
        label: DOMAIN_META[selectedDomain].label,
        onClick: selectedRuleId ? () => goToLevel2(selectedDomain) : undefined,
      });
    }
    if (selectedRule) {
      segments.push({ label: selectedRule.id });
    }
    return segments;
  }, [selectedDomain, selectedRuleId, selectedRule]);

  const summaryLabel = selectedDomain ? `in ${DOMAIN_META[selectedDomain].label}` : undefined;

  const backToStaff = onChangeView && (
    <button
      onClick={() => onChangeView('staff')}
      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
    >
      <span>←</span> Back to Staff Portal
    </button>
  );

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

  // Level 3: Rule Detail
  if (selectedRule) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumb segments={breadcrumbs} />
          {backToStaff}
        </div>
        <RuleDetail
          rule={selectedRule}
          onBack={() => (selectedDomain ? goToLevel2(selectedDomain) : goToLevel1())}
          onNavigateToRule={goToLevel3}
          onNavigateToDemoCase={onNavigateToDemoCase}
        />
      </div>
    );
  }

  // Level 2: Rule Cards for selected domain
  if (selectedDomain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumb segments={breadcrumbs} />
          {backToStaff}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {DOMAIN_META[selectedDomain].label}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{DOMAIN_META[selectedDomain].description}</p>
        </div>

        <RulesSummaryBar
          totalRules={summary.total}
          passingRules={summary.passing}
          failingRules={summary.failing}
          lastRun={testReport?.lastRun}
          label={summaryLabel}
        />

        <div>
          <input
            type="text"
            placeholder="Search rules by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-iw-sage/30 focus:border-iw-sage"
          />
        </div>

        <RuleCardGrid rules={filteredRules} onSelectRule={goToLevel3} />
      </div>
    );
  }

  // Level 1: Domain Cards
  const filteredForDomainSearch = searchQuery
    ? enrichedRules.filter((r) => {
        const domain = getDomainForRule(r.id);
        const meta = DOMAIN_META[domain];
        const q = searchQuery.toLowerCase();
        return meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q);
      })
    : enrichedRules;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rules Explorer</h1>
          <p className="mt-1 text-sm text-gray-500">Business rule definitions with test status</p>
        </div>
        {backToStaff}
      </div>

      <RulesSummaryBar
        totalRules={summary.total}
        passingRules={summary.passing}
        failingRules={summary.failing}
        lastRun={testReport?.lastRun}
      />

      <div>
        <input
          type="text"
          placeholder="Search domains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-iw-sage/30 focus:border-iw-sage"
        />
      </div>

      <DomainCardGrid rules={filteredForDomainSearch} onSelectDomain={goToLevel2} />
    </div>
  );
}
