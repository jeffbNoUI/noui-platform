import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentAPI } from '@/lib/memberPortalApi';
import { getDocumentChecklist } from '@/lib/planProfile';
import type { DocumentChecklistRule } from '@/types/PlanProfile';
import type { DocumentUpload } from '@/types/MemberPortal';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  rule: DocumentChecklistRule;
  status: 'outstanding' | 'received';
  upload?: DocumentUpload;
}

export interface UseDocumentChecklistResult {
  items: ChecklistItem[];
  outstanding: number;
  received: number;
  isLoading: boolean;
  error: Error | null;
  uploadDocument: (rule: DocumentChecklistRule, file: File) => void;
  uploadingType: string | null;
}

// ── Context Mapping ──────────────────────────────────────────────────────────

/**
 * Maps a member's status code to the plan profile context that drives their
 * document checklist.
 *
 * ACTIVE   → retirement_application (preparing to retire)
 * INACTIVE → refund_application (separated, wants contribution refund)
 * RETIRED  → '' (empty — all docs already submitted)
 * DECEASED → death_notification (staff/beneficiary uploading)
 *
 * Any other status returns empty string (no checklist applicable).
 */
export function statusToContext(memberStatus: string): string {
  switch (memberStatus.toUpperCase()) {
    case 'ACTIVE':
      return 'retirement_application';
    case 'INACTIVE':
      return 'refund_application';
    case 'DECEASED':
      return 'death_notification';
    default:
      return '';
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentChecklist(
  memberId: string,
  memberStatus: string,
  memberData: Record<string, unknown>,
) {
  const queryClient = useQueryClient();
  const numericId = Number(memberId);

  // Fetch existing uploads
  const {
    data: uploads = [],
    isLoading,
    error,
  } = useQuery<DocumentUpload[]>({
    queryKey: ['member-documents', memberId],
    queryFn: () => documentAPI.list(numericId),
    enabled: !!memberId,
  });

  // Get applicable rules from plan profile
  const context = statusToContext(memberStatus);
  const rules = context ? getDocumentChecklist(context, memberData) : [];

  // Merge rules with existing uploads
  const items: ChecklistItem[] = rules.map((rule) => {
    const match = uploads.find((u) => u.document_type === rule.document_type);
    return match
      ? { rule, status: 'received' as const, upload: match }
      : { rule, status: 'outstanding' as const };
  });

  const outstanding = items.filter((i) => i.status === 'outstanding').length;
  const received = items.filter((i) => i.status === 'received').length;

  // Upload mutation
  // Uses a placeholder issue ID — in production, this would come from the
  // member's active case/application. For now, we use 'general-upload'.
  const uploadMutation = useMutation({
    mutationFn: ({ documentType, file }: { documentType: string; file: File }) =>
      documentAPI.upload('general-upload', numericId, file, documentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-documents', memberId] });
    },
  });

  const uploadDocument = (rule: DocumentChecklistRule, file: File) => {
    uploadMutation.mutate({ documentType: rule.document_type, file });
  };

  const uploadingType = uploadMutation.isPending
    ? (uploadMutation.variables?.documentType ?? null)
    : null;

  return {
    items,
    outstanding,
    received,
    isLoading,
    error: error as Error | null,
    uploadDocument,
    uploadingType,
  };
}
