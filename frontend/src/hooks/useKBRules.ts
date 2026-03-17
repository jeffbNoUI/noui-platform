import { useQuery } from '@tanstack/react-query';
import { kbAPI } from '@/lib/kbApi';
import type { KBRuleReference } from '@/types/KnowledgeBase';

export function useKBRules(domain?: string) {
  return useQuery<KBRuleReference[]>({
    queryKey: ['kb', 'rules', domain],
    queryFn: () => kbAPI.listRules(domain),
    staleTime: 5 * 60_000,
  });
}
