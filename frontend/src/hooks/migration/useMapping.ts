import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  FieldMapping,
  CodeMapping,
  GenerateMappingsRequest,
  GenerateMappingsSummary,
  UpdateMappingRequest,
} from '@/types/Migration';

export function useMappings(engagementId: string, params?: { status?: string; approval?: string }) {
  return useQuery<FieldMapping[]>({
    queryKey: ['migration', 'mappings', engagementId, params],
    queryFn: () => migrationAPI.listMappings(engagementId, params),
    enabled: !!engagementId,
  });
}

export function useCodeMappings(engagementId: string) {
  return useQuery<CodeMapping[]>({
    queryKey: ['migration', 'code-mappings', engagementId],
    queryFn: () => migrationAPI.listCodeMappings(engagementId),
    enabled: !!engagementId,
  });
}

export function useGenerateMappings() {
  const queryClient = useQueryClient();
  return useMutation<
    GenerateMappingsSummary,
    Error,
    { engagementId: string; req: GenerateMappingsRequest }
  >({
    mutationFn: ({ engagementId, req }) => migrationAPI.generateMappings(engagementId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'mappings', engagementId] });
    },
  });
}

export function useUpdateMapping() {
  const queryClient = useQueryClient();
  return useMutation<
    FieldMapping,
    Error,
    { engagementId: string; mappingId: string; req: UpdateMappingRequest }
  >({
    mutationFn: ({ engagementId, mappingId, req }) =>
      migrationAPI.updateMapping(engagementId, mappingId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'mappings', engagementId] });
    },
  });
}

export function useAcknowledgeWarning() {
  const queryClient = useQueryClient();
  return useMutation<
    { mapping_id: string; acknowledged: boolean },
    Error,
    { engagementId: string; mappingId: string }
  >({
    mutationFn: ({ engagementId, mappingId }) =>
      migrationAPI.acknowledgeWarning(engagementId, mappingId),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'mappings', engagementId] });
    },
  });
}

export function useMappingCorpusContext(engagementId: string, mappingId: string) {
  return useQuery<import('@/types/Migration').CorpusContext>({
    queryKey: ['migration', 'corpus', engagementId, mappingId],
    queryFn: () => migrationAPI.getMappingCorpusContext(engagementId, mappingId),
    enabled: !!engagementId && !!mappingId,
    staleTime: 60_000,
  });
}
