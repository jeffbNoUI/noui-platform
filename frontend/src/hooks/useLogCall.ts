import { useCreateInteraction } from '@/hooks/useCRM';

/**
 * Thin mutation hook that wraps useCreateInteraction to create
 * phone call CRM interactions. Used by the CSR Context Hub "Log Call" button.
 */
export function useLogCall() {
  const mutation = useCreateInteraction();

  const logCall = (contactId: string, summary: string) =>
    mutation.mutateAsync({
      contactId,
      summary,
      channel: 'phone_inbound',
      interactionType: 'inquiry',
      direction: 'inbound',
      visibility: 'internal',
    });

  return {
    logCall,
    isLogging: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  };
}
