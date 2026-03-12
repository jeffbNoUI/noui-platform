import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { correspondenceAPI } from '@/lib/correspondenceApi';
import { crmAPI } from '@/lib/crmApi';
import type { Correspondence } from '@/types/Correspondence';

/** Fetch correspondence history for a specific member from the correspondence service. */
export function useCorrespondenceHistory(memberId: number) {
  return useQuery<Correspondence[]>({
    queryKey: ['correspondence', 'history', memberId],
    queryFn: () => correspondenceAPI.listHistory({ member_id: memberId }),
    enabled: memberId > 0,
  });
}

/** Fetch sent-only correspondence for portal display. */
export function useSentCorrespondence(memberId: number) {
  return useQuery<Correspondence[]>({
    queryKey: ['correspondence', 'sent', memberId],
    queryFn: () => correspondenceAPI.listHistory({ member_id: memberId, status: 'sent' }),
    enabled: memberId > 0,
  });
}

/** Fetch correspondence by contact_id (for employer portal). */
export function useContactCorrespondence(contactId: string) {
  return useQuery<Correspondence[]>({
    queryKey: ['correspondence', 'contact', contactId],
    queryFn: () => correspondenceAPI.listHistory({ contact_id: contactId, status: 'sent' }),
    enabled: contactId.length > 0,
  });
}

interface SendParams {
  correspondenceId: string;
  sentVia: string;
  deliveryAddress?: string;
  /** CRM contact ID for auto-logging the interaction. */
  contactId?: string;
  /** Subject for the CRM interaction summary. */
  subject?: string;
  /** Case ID to link the CRM interaction. */
  caseId?: string;
}

/**
 * Mutation: mark correspondence as "sent", then best-effort log to CRM.
 * If the CRM call fails, the correspondence is still marked sent.
 */
export function useCorrespondenceSend() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendParams) => {
      // 1. Update correspondence status to "sent"
      const updated = await correspondenceAPI.updateStatus(params.correspondenceId, {
        status: 'sent',
        sentVia: params.sentVia,
        deliveryAddress: params.deliveryAddress,
      });

      // 2. Best-effort CRM interaction log
      if (params.contactId) {
        try {
          const channel = params.sentVia === 'email' ? 'email_outbound' : 'mail_outbound';
          const caseSuffix = params.caseId ? ` (${params.caseId})` : '';
          await crmAPI.createInteraction({
            contactId: params.contactId,
            channel,
            interactionType: 'notification',
            direction: 'outbound',
            summary: `Correspondence sent: ${params.subject ?? 'Letter'}${caseSuffix}`,
            visibility: 'public',
          });
        } catch (err) {
          console.warn('[useCorrespondenceSend] CRM logging failed (non-blocking):', err);
        }
      }

      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['correspondence'] });
      qc.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}
