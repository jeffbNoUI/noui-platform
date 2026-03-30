import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditExportFilters,
  AuditExportCountResult,
  RetentionPolicy,
  SetRetentionPolicyRequest,
  MigrationReport,
  ReportType,
} from '@/types/Migration';

export function useAuditLog(engagementId: string, filters?: AuditLogFilters) {
  return useQuery<{ entries: AuditLogEntry[]; total: number }>({
    queryKey: ['migration', 'audit', engagementId, filters],
    queryFn: () => migrationAPI.getAuditLog(engagementId, filters),
    enabled: !!engagementId,
  });
}

export function useAuditExportCount(engagementId: string, filters: AuditExportFilters) {
  return useQuery<AuditExportCountResult>({
    queryKey: ['migration', 'audit-export-count', engagementId, filters],
    queryFn: () => migrationAPI.getAuditExportCount(engagementId, filters),
    enabled: !!engagementId,
  });
}

export function useExportAuditUrl(
  engagementId: string,
  filters: AuditExportFilters,
  format: 'csv' | 'json',
) {
  return migrationAPI.exportAuditUrl(engagementId, filters, format);
}

export function useRetentionPolicy(engagementId: string) {
  return useQuery<RetentionPolicy>({
    queryKey: ['migration', 'retention-policy', engagementId],
    queryFn: () => migrationAPI.getRetentionPolicy(engagementId),
    enabled: !!engagementId,
  });
}

export function useSetRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation<
    RetentionPolicy,
    Error,
    { engagementId: string; req: SetRetentionPolicyRequest }
  >({
    mutationFn: ({ engagementId, req }) => migrationAPI.setRetentionPolicy(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'retention-policy', engagementId] });
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation<MigrationReport, Error, { engagementId: string; reportType: ReportType }>({
    mutationFn: ({ engagementId, reportType }) =>
      migrationAPI.generateReport(engagementId, reportType),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'reports', engagementId] });
    },
  });
}

export function useReportStatus(engagementId: string, reportId: string | undefined) {
  return useQuery<MigrationReport>({
    queryKey: ['migration', 'report-status', engagementId, reportId],
    queryFn: () => migrationAPI.getReportStatus(engagementId, reportId!),
    enabled: !!engagementId && !!reportId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'GENERATING') return 3_000;
      return false;
    },
  });
}

export function useReports(engagementId: string) {
  return useQuery<MigrationReport[]>({
    queryKey: ['migration', 'reports', engagementId],
    queryFn: () => migrationAPI.listReports(engagementId),
    enabled: !!engagementId,
  });
}

export function useDownloadReportUrl(engagementId: string, reportId: string) {
  return migrationAPI.downloadReportUrl(engagementId, reportId);
}
