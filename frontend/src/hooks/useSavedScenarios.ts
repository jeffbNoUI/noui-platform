import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scenarioAPI } from '@/lib/memberPortalApi';
import type { SavedScenario, ScenarioInputs, ScenarioResults } from '@/types/MemberPortal';

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSavedScenarios(memberId: number) {
  const queryClient = useQueryClient();
  const queryKey = ['saved-scenarios', memberId];

  const query = useQuery<SavedScenario[]>({
    queryKey,
    queryFn: () => scenarioAPI.list(memberId),
    enabled: memberId > 0,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      label,
      inputs,
      results,
      dataVersion,
    }: {
      label: string;
      inputs: ScenarioInputs;
      results: ScenarioResults;
      dataVersion: string;
    }) => scenarioAPI.save(memberId, label, inputs, results, dataVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scenarioId: string) => scenarioAPI.delete(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    scenarios: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    remove: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    refetch: query.refetch,
  };
}
