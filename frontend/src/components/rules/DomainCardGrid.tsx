// frontend/src/components/rules/DomainCardGrid.tsx
import { useMemo } from 'react';
import type { RuleDefinition } from '@/types/Rules';
import { getDomainForRule, DOMAIN_META, ALL_DOMAINS, type DomainKey } from '@/lib/domainMapping';
import DomainCard from './DomainCard';

interface DomainCardGridProps {
  rules: RuleDefinition[];
  onSelectDomain: (domain: DomainKey) => void;
}

interface DomainSummary {
  key: DomainKey;
  label: string;
  description: string;
  ruleCount: number;
  passingRules: number;
}

export default function DomainCardGrid({ rules, onSelectDomain }: DomainCardGridProps) {
  const domains = useMemo(() => {
    const grouped: Record<string, RuleDefinition[]> = {};
    for (const rule of rules) {
      const domain = getDomainForRule(rule.id);
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(rule);
    }

    const result: DomainSummary[] = [];
    for (const key of ALL_DOMAINS) {
      const domainRules = grouped[key];
      if (!domainRules || domainRules.length === 0) continue;
      const passing = domainRules.filter(
        (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
      ).length;
      result.push({
        key,
        label: DOMAIN_META[key].label,
        description: DOMAIN_META[key].description,
        ruleCount: domainRules.length,
        passingRules: passing,
      });
    }

    const generalRules = grouped['general'];
    if (generalRules && generalRules.length > 0) {
      const passing = generalRules.filter(
        (r) => r.testStatus && r.testStatus.failing === 0 && r.testStatus.total > 0,
      ).length;
      result.push({
        key: 'general',
        label: DOMAIN_META.general.label,
        description: DOMAIN_META.general.description,
        ruleCount: generalRules.length,
        passingRules: passing,
      });
    }

    return result;
  }, [rules]);

  if (domains.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">No rule domains available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {domains.map((d) => (
        <DomainCard
          key={d.key}
          domainKey={d.key}
          label={d.label}
          description={d.description}
          ruleCount={d.ruleCount}
          passingRules={d.passingRules}
          onClick={() => onSelectDomain(d.key)}
        />
      ))}
    </div>
  );
}
