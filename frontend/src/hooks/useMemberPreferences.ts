import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI, putAPI } from '@/lib/apiClient';
import type { MemberPreferences } from '@/types/MemberPortal';

const CONNECTOR_URL = import.meta.env.VITE_CONNECTOR_URL || '/api';

const MEMBER_PREFS_KEY = 'member-preferences';

function memberPrefsUrl(memberId: string) {
  return `${CONNECTOR_URL}/v1/members/${memberId}/preferences`;
}

/**
 * Fetches and manages a member's personal preferences (communication, accessibility, tour state).
 * Distinct from the workspace panel preferences in usePreferences.ts — these are member-level settings.
 */
export function useMemberPreferences(memberId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<MemberPreferences>({
    queryKey: [MEMBER_PREFS_KEY, memberId],
    queryFn: () => fetchAPI<MemberPreferences>(memberPrefsUrl(memberId)),
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (prefs: Partial<MemberPreferences>) =>
      putAPI<MemberPreferences>(memberPrefsUrl(memberId), prefs),
    onSuccess: (updated) => {
      queryClient.setQueryData([MEMBER_PREFS_KEY, memberId], updated);
    },
  });

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    updatePreferences: mutation.mutate,
    updatePreferencesAsync: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
