import { useQuery } from '@tanstack/react-query';
import { rulesAPI } from '@/lib/rulesApi';
import type { RuleDefinition } from '@/types/Rules';

export function useRuleDefinitions(domain?: string) {
  return useQuery<RuleDefinition[]>({
    queryKey: ['rules', 'definitions', domain],
    queryFn: () => rulesAPI.listDefinitions(domain),
    staleTime: 5 * 60_000,
  });
}

export function useRuleDefinition(ruleId: string) {
  return useQuery<RuleDefinition>({
    queryKey: ['rules', 'definitions', ruleId],
    queryFn: () => rulesAPI.getDefinition(ruleId),
    enabled: ruleId.length > 0,
    staleTime: 5 * 60_000,
  });
}
