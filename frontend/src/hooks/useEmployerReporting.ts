import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerReportingAPI } from '@/lib/employerApi';
import type {
  ContributionFile,
  ContributionException,
  LateInterestAccrual,
  ManualEntryRecord,
} from '@/types/Employer';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useContributionFiles(orgId: string) {
  return useQuery({
    queryKey: ['reporting', 'files', orgId],
    queryFn: () => employerReportingAPI.listFiles(orgId),
    enabled: orgId.length > 0,
  });
}

export function useContributionFile(fileId: string) {
  return useQuery<ContributionFile>({
    queryKey: ['reporting', 'file', fileId],
    queryFn: () => employerReportingAPI.getFile(fileId),
    enabled: fileId.length > 0,
  });
}

export function useContributionRecords(fileId: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['reporting', 'records', fileId, limit, offset],
    queryFn: () => employerReportingAPI.getRecords(fileId, limit, offset),
    enabled: fileId.length > 0,
  });
}

export function useExceptions(orgId: string, status?: string) {
  return useQuery({
    queryKey: ['reporting', 'exceptions', orgId, status ?? ''],
    queryFn: () => employerReportingAPI.listExceptions(orgId, status),
    enabled: orgId.length > 0,
  });
}

export function useException(id: string) {
  return useQuery<ContributionException>({
    queryKey: ['reporting', 'exception', id],
    queryFn: () => employerReportingAPI.getException(id),
    enabled: id.length > 0,
  });
}

export function usePayments(orgId: string) {
  return useQuery({
    queryKey: ['reporting', 'payments', orgId],
    queryFn: () => employerReportingAPI.listPayments(orgId),
    enabled: orgId.length > 0,
  });
}

export function useLateInterest(orgId: string) {
  return useQuery<LateInterestAccrual[]>({
    queryKey: ['reporting', 'interest', orgId],
    queryFn: () => employerReportingAPI.getInterest(orgId),
    enabled: orgId.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useUploadManualEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orgId: string;
      periodStart: string;
      periodEnd: string;
      divisionCode: string;
      records: ManualEntryRecord[];
    }) => employerReportingAPI.submitManualEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'files'] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => employerReportingAPI.deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'files'] });
    },
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      employerReportingAPI.resolveException(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'exceptions'] });
    },
  });
}

export function useEscalateException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerReportingAPI.escalateException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'exceptions'] });
    },
  });
}

export function useSetupPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, method }: { fileId: string; method: string }) =>
      employerReportingAPI.setupPayment(fileId, method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['reporting', 'files'] });
    },
  });
}

export function useCancelPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => employerReportingAPI.cancelPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'payments'] });
    },
  });
}

export function useSubmitCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orgId: string;
      originalFileId: string;
      periodStart: string;
      periodEnd: string;
      divisionCode: string;
    }) => employerReportingAPI.submitCorrection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporting', 'files'] });
    },
  });
}
