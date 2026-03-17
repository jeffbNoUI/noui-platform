import { useQuery } from '@tanstack/react-query';
import { auditAPI } from '@/lib/auditApi';
import type { AuditListParams } from '@/types/Audit';

export function useAuditLog(params?: AuditListParams) {
  return useQuery({
    queryKey: ['audit', 'log', params],
    queryFn: () => auditAPI.listEntries(params),
    staleTime: 30_000,
  });
}
