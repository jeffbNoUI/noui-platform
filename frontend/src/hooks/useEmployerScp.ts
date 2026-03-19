import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerScpAPI } from '@/lib/employerApi';
import type { SCPRequest } from '@/types/Employer';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useCostFactors(tier?: string) {
  return useQuery({
    queryKey: ['scp', 'cost-factors', tier ?? ''],
    queryFn: () => employerScpAPI.listCostFactors(tier),
  });
}

export function useSCPRequest(id: string) {
  return useQuery<SCPRequest>({
    queryKey: ['scp', 'request', id],
    queryFn: () => employerScpAPI.getRequest(id),
    enabled: id.length > 0,
  });
}

export function useSCPRequests(orgId: string, status?: string) {
  return useQuery({
    queryKey: ['scp', 'requests', orgId, status ?? ''],
    queryFn: () => employerScpAPI.listRequests(orgId, status),
    enabled: orgId.length > 0,
  });
}

export function useEligibilityCheck(serviceType: string, tier: string) {
  return useQuery({
    queryKey: ['scp', 'eligibility', serviceType, tier],
    queryFn: () => employerScpAPI.checkEligibility(serviceType, tier),
    enabled: serviceType.length > 0 && tier.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreateSCPRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerScpAPI.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp', 'requests'] });
    },
  });
}

export function useGenerateQuote() {
  return useMutation({
    mutationFn: employerScpAPI.generateQuote,
  });
}

export function useApplyQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      costFactorId: string;
      costFactor: string;
      annualSalary: string;
      totalCost: string;
      quoteDate: string;
      quoteExpires: string;
    }) => employerScpAPI.applyQuote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp'] });
    },
  });
}

export function useSubmitDocumentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerScpAPI.submitDocumentation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp'] });
    },
  });
}

export function useApproveSCPRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerScpAPI.approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp'] });
    },
  });
}

export function useDenySCPRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      employerScpAPI.denyRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      amount,
      paymentMethod,
    }: {
      id: string;
      amount: string;
      paymentMethod: string;
    }) => employerScpAPI.recordPayment(id, amount, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp'] });
    },
  });
}

export function useCancelSCPRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerScpAPI.cancelRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scp'] });
    },
  });
}
