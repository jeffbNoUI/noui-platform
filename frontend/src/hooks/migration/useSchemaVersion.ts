import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  SchemaVersion,
  CreateSchemaVersionRequest,
  SchemaVersionDiff,
} from '@/types/Migration';

export function useSchemaVersions(tenantId: string | undefined) {
  return useQuery<SchemaVersion[]>({
    queryKey: ['migration', 'schema-versions', tenantId],
    queryFn: () => migrationAPI.getSchemaVersions(tenantId!),
    enabled: !!tenantId,
  });
}

export function useSchemaVersion(versionId: string | undefined) {
  return useQuery<SchemaVersion>({
    queryKey: ['migration', 'schema-version', versionId],
    queryFn: () => migrationAPI.getSchemaVersion(versionId!),
    enabled: !!versionId,
  });
}

export function useCreateSchemaVersion() {
  const queryClient = useQueryClient();
  return useMutation<SchemaVersion, Error, { tenantId: string; req: CreateSchemaVersionRequest }>({
    mutationFn: ({ tenantId, req }) => migrationAPI.createSchemaVersion(tenantId, req),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'schema-versions', tenantId] });
    },
  });
}

export function useActivateSchemaVersion() {
  const queryClient = useQueryClient();
  return useMutation<SchemaVersion, Error, { versionId: string; tenantId: string }>({
    mutationFn: ({ versionId }) => migrationAPI.activateSchemaVersion(versionId),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'schema-versions', tenantId] });
    },
  });
}

export function useSchemaVersionDiff(
  versionId1: string | undefined,
  versionId2: string | undefined,
) {
  return useQuery<SchemaVersionDiff>({
    queryKey: ['migration', 'schema-diff', versionId1, versionId2],
    queryFn: () => migrationAPI.getSchemaVersionDiff(versionId1!, versionId2!),
    enabled: !!versionId1 && !!versionId2,
  });
}
