import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { preferencesAPI } from '@/lib/api';
import type { UpsertPreferenceRequest } from '@/lib/api';
import { applyPreferences, computeContextKey } from '@/lib/preferenceOverrides';
import type { PanelPreference, ComposedStage } from '@/lib/preferenceOverrides';
import type { StageDescriptor, CaseFlags } from '@/lib/workflowComposition';

export function useUserPreferences(contextKey: string) {
  return useQuery<PanelPreference[]>({
    queryKey: ['preferences', contextKey],
    queryFn: () => preferencesAPI.getPreferences(contextKey),
    enabled: !!contextKey,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: UpsertPreferenceRequest) => preferencesAPI.upsertPreference(req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['preferences', variables.contextKey] });
    },
  });
}

export function useResetPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contextKey: string) => preferencesAPI.resetPreferences(contextKey),
    onSuccess: (_data, contextKey) => {
      queryClient.invalidateQueries({ queryKey: ['preferences', contextKey] });
    },
  });
}

export function useSuggestions(contextKey: string) {
  return useQuery({
    queryKey: ['suggestions', contextKey],
    queryFn: () => preferencesAPI.getSuggestions(contextKey),
    enabled: !!contextKey,
    staleTime: 60 * 60 * 1000,
  });
}

export function useRespondToSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, response }: { suggestionId: string; response: string }) =>
      preferencesAPI.respondToSuggestion(suggestionId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}

export function useComposedWorkspace(
  baseStages: StageDescriptor[],
  flags: CaseFlags,
): ComposedStage[] {
  const contextKey = useMemo(() => computeContextKey(flags), [flags]);
  const { data: preferences } = useUserPreferences(contextKey);
  return useMemo(() => applyPreferences(baseStages, preferences ?? []), [baseStages, preferences]);
}
