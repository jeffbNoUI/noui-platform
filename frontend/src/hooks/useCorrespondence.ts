import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { correspondenceAPI } from '@/lib/correspondenceApi';
import { crmAPI } from '@/lib/crmApi';
import type { Correspondence, SendEffect } from '@/types/Correspondence';

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

/** Fetch correspondence by case_id (for case-scoped views). */
export function useCaseCorrespondence(caseId: string) {
  return useQuery<Correspondence[]>({
    queryKey: ['correspondence', 'case', caseId],
    queryFn: () => correspondenceAPI.listHistory({ case_id: caseId }),
    enabled: caseId.length > 0,
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
  /** Template-defined side-effects to execute after send. */
  onSendEffects?: SendEffect[];
}

/** Result from the send mutation, includes which effects were executed. */
export interface SendResult {
  correspondence: Correspondence;
  /** Effects that were triggered (caller can act on advance_stage). */
  executedEffects: SendEffect[];
}

/**
 * Mutation: mark correspondence as "sent", then best-effort log to CRM
 * and execute template-defined side-effects (commitments, notifications).
 * If CRM or effect calls fail, the correspondence is still marked sent.
 */
export function useCorrespondenceSend() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendParams): Promise<SendResult> => {
      const executedEffects: SendEffect[] = [];

      // 1. Update correspondence status to "sent"
      const updated = await correspondenceAPI.updateStatus(params.correspondenceId, {
        status: 'sent',
        sentVia: params.sentVia,
        deliveryAddress: params.deliveryAddress,
      });

      // 2. Best-effort CRM interaction log — capture interaction ID for commitments
      let interactionId: string | undefined;
      if (params.contactId) {
        try {
          const channel = params.sentVia === 'email' ? 'email_outbound' : 'mail_outbound';
          const caseSuffix = params.caseId ? ` (${params.caseId})` : '';
          const interaction = await crmAPI.createInteraction({
            contactId: params.contactId,
            channel,
            interactionType: 'notification',
            direction: 'outbound',
            summary: `Correspondence sent: ${params.subject ?? 'Letter'}${caseSuffix}`,
            visibility: 'public',
          });
          interactionId = interaction?.interactionId;
        } catch (err) {
          console.warn('[useCorrespondenceSend] CRM logging failed (non-blocking):', err);
        }
      }

      // 3. Execute template-defined on_send_effects (best-effort)
      if (params.onSendEffects && params.onSendEffects.length > 0) {
        for (const effect of params.onSendEffects) {
          try {
            if (effect.type === 'create_commitment' && interactionId && params.contactId) {
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() + (effect.targetDays ?? 7));
              await crmAPI.createCommitment({
                interactionId,
                contactId: params.contactId,
                description: effect.description ?? 'Follow-up from correspondence',
                targetDate: targetDate.toISOString().slice(0, 10),
                ownerAgent: 'system',
              });
              executedEffects.push(effect);
            } else if (effect.type === 'advance_stage') {
              // Notification only — caller should show a toast.
              // The actual stage advance is handled by the workflow engine.
              executedEffects.push(effect);
            }
          } catch (err) {
            console.warn(
              `[useCorrespondenceSend] Effect '${effect.type}' failed (non-blocking):`,
              err,
            );
          }
        }
      }

      return { correspondence: updated, executedEffects };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['correspondence'] });
      qc.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}
