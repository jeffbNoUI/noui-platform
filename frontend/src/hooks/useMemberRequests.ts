import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI, patchAPI } from '@/lib/apiClient';
import type { ChangeRequest } from '@/types/MemberPortal';

// ── Types ────────────────────────────────────────────────────────────────────

export type RequestPriority = 'urgent' | 'high' | 'standard';
export type ResolutionAction = 'approved' | 'rejected' | 'escalated';

export interface MemberRequestItem extends ChangeRequest {
  member_name?: string;
  priority: RequestPriority;
}

export interface ResolvePayload {
  action: ResolutionAction;
  staff_note: string;
}

// ── Priority derivation ──────────────────────────────────────────────────────

export function derivePriority(req: ChangeRequest): RequestPriority {
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceCreation > 7) return 'urgent';
  if (daysSinceCreation > 3) return 'high';
  return 'standard';
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useMemberRequests() {
  return useQuery({
    queryKey: ['member-requests'],
    queryFn: async () => {
      const raw = await fetchAPI<(ChangeRequest & { member_name?: string })[]>(
        '/api/v1/issues?type=profile_change,beneficiary_change,data_correction,direct_deposit_change&status=pending',
      );
      return raw
        .map((r) => ({ ...r, priority: derivePriority(r) }))
        .sort((a, b) => {
          const order: Record<RequestPriority, number> = { urgent: 0, high: 1, standard: 2 };
          return order[a.priority] - order[b.priority];
        });
    },
  });
}

export function useResolveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: ResolvePayload }) =>
      patchAPI<ChangeRequest>(`/api/v1/issues/${requestId}/resolve`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-requests'] });
    },
  });
}
