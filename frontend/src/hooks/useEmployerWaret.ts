import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerWaretAPI } from '@/lib/employerApi';
import type { WaretDesignation, WaretYTDSummary } from '@/types/Employer';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useDesignations(orgId: string, year?: number, status?: string) {
  return useQuery({
    queryKey: ['waret', 'designations', orgId, year ?? '', status ?? ''],
    queryFn: () => employerWaretAPI.listDesignations(orgId, year, status),
    enabled: orgId.length > 0,
  });
}

export function useDesignation(id: string) {
  return useQuery<WaretDesignation>({
    queryKey: ['waret', 'designation', id],
    queryFn: () => employerWaretAPI.getDesignation(id),
    enabled: id.length > 0,
  });
}

export function useWaretTracking(designationId: string) {
  return useQuery({
    queryKey: ['waret', 'tracking', designationId],
    queryFn: () => employerWaretAPI.listTracking(designationId),
    enabled: designationId.length > 0,
  });
}

export function useYTDSummary(designationId: string) {
  return useQuery<WaretYTDSummary>({
    queryKey: ['waret', 'summary', designationId],
    queryFn: () => employerWaretAPI.getYTDSummary(designationId),
    enabled: designationId.length > 0,
  });
}

export function useWaretPenalties(designationId: string) {
  return useQuery({
    queryKey: ['waret', 'penalties', designationId],
    queryFn: () => employerWaretAPI.listPenalties(designationId),
    enabled: designationId.length > 0,
  });
}

export function useWaretDisclosures(ssnHash: string, year?: number) {
  return useQuery({
    queryKey: ['waret', 'disclosures', ssnHash, year ?? ''],
    queryFn: () => employerWaretAPI.listDisclosures(ssnHash, year),
    enabled: ssnHash.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreateDesignation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerWaretAPI.createDesignation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'designations'] });
    },
  });
}

export function useApproveDesignation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerWaretAPI.approveDesignation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'designations'] });
      queryClient.invalidateQueries({ queryKey: ['waret', 'designation'] });
    },
  });
}

export function useRevokeDesignation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      employerWaretAPI.revokeDesignation(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'designations'] });
      queryClient.invalidateQueries({ queryKey: ['waret', 'designation'] });
    },
  });
}

export function useRecordWorkDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerWaretAPI.recordWorkDay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'tracking'] });
      queryClient.invalidateQueries({ queryKey: ['waret', 'summary'] });
    },
  });
}

export function useAssessPenalty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerWaretAPI.assessPenalty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'penalties'] });
    },
  });
}

export function useAppealPenalty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      employerWaretAPI.appealPenalty(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'penalties'] });
    },
  });
}

export function useWaivePenalty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      employerWaretAPI.waivePenalty(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'penalties'] });
    },
  });
}

export function useCreateDisclosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerWaretAPI.createDisclosure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'disclosures'] });
    },
  });
}

export function useCheckPERACare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hasActiveSubsidy }: { id: string; hasActiveSubsidy: boolean }) =>
      employerWaretAPI.checkPERACare(id, hasActiveSubsidy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'designation'] });
    },
  });
}

export function useResolvePERACare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerWaretAPI.resolvePERACare(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waret', 'designation'] });
    },
  });
}
