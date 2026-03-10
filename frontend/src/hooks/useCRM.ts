import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmAPI } from '@/lib/crmApi';
import * as demo from '@/lib/crmDemoData';
import type {
  Contact,
  ContactTimeline,
  Conversation,
  Interaction,
  Note,
  Commitment,
  Outreach,
  Organization,
  PaginatedResponse,
  CreateInteractionRequest,
  CreateNoteRequest,
  CreateCommitmentRequest,
  UpdateCommitmentRequest,
  CreateConversationRequest,
  UpdateConversationRequest,
  CreateContactRequest,
  UpdateContactRequest,
  CreateOutreachRequest,
  UpdateOutreachRequest,
  CommitmentListParams,
  OutreachListParams,
  ConversationListParams,
  OrgListParams,
} from '@/types/CRM';
import type {
  CreatePortalMessageData,
  CreateConversationData,
  CreateStaffNoteData,
  CreateStructuredNoteData,
} from '@/lib/crmDemoData';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useContactSearch(query: string, enabled = true) {
  return useQuery<PaginatedResponse<Contact>>({
    queryKey: ['crm', 'contacts', 'search', query],
    queryFn: () => crmAPI.searchContacts({ query }),
    enabled: enabled && query.length > 0,
  });
}

export function useContact(contactId: string) {
  return useQuery<Contact>({
    queryKey: ['crm', 'contact', contactId],
    queryFn: () => crmAPI.getContact(contactId),
    enabled: contactId.length > 0,
  });
}

export function useContactByLegacyId(legacyMbrId: string) {
  return useQuery<Contact>({
    queryKey: ['crm', 'contact', 'legacy', legacyMbrId],
    queryFn: () => crmAPI.getContactByLegacyId(legacyMbrId),
    enabled: legacyMbrId.length > 0,
  });
}

export function useContactTimeline(contactId: string, limit?: number) {
  return useQuery<ContactTimeline>({
    queryKey: ['crm', 'timeline', contactId, limit],
    queryFn: () => crmAPI.getContactTimeline(contactId, limit),
    enabled: contactId.length > 0,
  });
}

export function useInteraction(interactionId: string) {
  return useQuery<Interaction>({
    queryKey: ['crm', 'interaction', interactionId],
    queryFn: () => crmAPI.getInteraction(interactionId),
    enabled: interactionId.length > 0,
  });
}

export function useConversations(params: ConversationListParams) {
  return useQuery<PaginatedResponse<Conversation>>({
    queryKey: ['crm', 'conversations', params],
    queryFn: () => crmAPI.listConversations(params),
    enabled: !!(params.contactId || params.assignedAgent || params.assignedTeam || params.status),
  });
}

export function useConversation(conversationId: string) {
  return useQuery<Conversation>({
    queryKey: ['crm', 'conversation', conversationId],
    queryFn: () => crmAPI.getConversation(conversationId),
    enabled: conversationId.length > 0,
  });
}

export function useCommitments(params: CommitmentListParams) {
  return useQuery<PaginatedResponse<Commitment>>({
    queryKey: ['crm', 'commitments', params],
    queryFn: () => crmAPI.listCommitments(params),
    enabled: !!(params.contactId || params.conversationId || params.ownerAgent || params.status),
  });
}

export function useOutreach(params: OutreachListParams) {
  return useQuery<PaginatedResponse<Outreach>>({
    queryKey: ['crm', 'outreach', params],
    queryFn: () => crmAPI.listOutreach(params),
    enabled: !!(params.contactId || params.assignedAgent || params.assignedTeam || params.status),
  });
}

export function useOrganizations(params: OrgListParams) {
  return useQuery<PaginatedResponse<Organization>>({
    queryKey: ['crm', 'organizations', params],
    queryFn: () => crmAPI.listOrganizations(params),
  });
}

export function useOrganization(orgId: string) {
  return useQuery<Organization>({
    queryKey: ['crm', 'organization', orgId],
    queryFn: () => crmAPI.getOrganization(orgId),
    enabled: orgId.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation<Contact, Error, CreateContactRequest>({
    mutationFn: (req) => crmAPI.createContact(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'contacts'] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation<Contact, Error, { contactId: string; req: UpdateContactRequest }>({
    mutationFn: ({ contactId, req }) => crmAPI.updateContact(contactId, req),
    onSuccess: (_data, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'contacts'] });
    },
  });
}

export function useCreateInteraction() {
  const queryClient = useQueryClient();
  return useMutation<Interaction, Error, CreateInteractionRequest>({
    mutationFn: (req) => crmAPI.createInteraction(req),
    onSuccess: (_data, req) => {
      if (req.contactId) {
        queryClient.invalidateQueries({ queryKey: ['crm', 'timeline', req.contactId] });
      }
      if (req.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['crm', 'conversation', req.conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['crm', 'conversations'] });
    },
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation<Note, Error, CreateNoteRequest>({
    mutationFn: (req) => crmAPI.createNote(req),
    onSuccess: (_data, req) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'interaction', req.interactionId] });
    },
  });
}

export function useCreateCommitment() {
  const queryClient = useQueryClient();
  return useMutation<Commitment, Error, CreateCommitmentRequest>({
    mutationFn: (req) => crmAPI.createCommitment(req),
    onSuccess: (_data, req) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'commitments'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'interaction', req.interactionId] });
      if (req.contactId) {
        queryClient.invalidateQueries({ queryKey: ['crm', 'timeline', req.contactId] });
      }
    },
  });
}

export function useUpdateCommitment() {
  const queryClient = useQueryClient();
  return useMutation<Commitment, Error, { commitmentId: string; req: UpdateCommitmentRequest }>({
    mutationFn: ({ commitmentId, req }) => crmAPI.updateCommitment(commitmentId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'commitments'] });
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation<Conversation, Error, CreateConversationRequest>({
    mutationFn: (req) => crmAPI.createConversation(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'conversations'] });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation<
    Conversation,
    Error,
    { conversationId: string; req: UpdateConversationRequest }
  >({
    mutationFn: ({ conversationId, req }) => crmAPI.updateConversation(conversationId, req),
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'conversations'] });
    },
  });
}

export function useCreateOutreach() {
  const queryClient = useQueryClient();
  return useMutation<Outreach, Error, CreateOutreachRequest>({
    mutationFn: (req) => crmAPI.createOutreach(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'outreach'] });
    },
  });
}

export function useUpdateOutreach() {
  const queryClient = useQueryClient();
  return useMutation<Outreach, Error, { outreachId: string; req: UpdateOutreachRequest }>({
    mutationFn: ({ outreachId, req }) => crmAPI.updateOutreach(outreachId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'outreach'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Portal-specific hooks — use in-memory demo data for cross-portal demos.
// These hooks power the member message center, staff journal, and employer
// communications views. They share the same mutable data store so mutations
// in one portal are immediately visible in the others via query invalidation.
// ═══════════════════════════════════════════════════════════════════════════════

export function useContactByMemberId(memberId: string) {
  return useQuery<Contact | undefined>({
    queryKey: ['crm', 'portal', 'contact-by-member', memberId],
    queryFn: () => crmAPI.getContactByLegacyId(memberId),
    enabled: memberId.length > 0,
  });
}

/** Resolve any identifier (contactId, legacyMemberId, name) to a demo contact. */
export function useResolveDemoContact(identifier: string) {
  return useQuery<Contact | undefined>({
    queryKey: ['crm', 'portal', 'resolve-contact', identifier],
    queryFn: () => demo.resolveDemoContact(identifier),
    enabled: identifier.length > 0,
  });
}

export function usePublicTimeline(contactId: string) {
  return useQuery<ContactTimeline>({
    queryKey: ['crm', 'portal', 'public-timeline', contactId],
    queryFn: () => demo.getPublicTimeline(contactId),
    enabled: contactId.length > 0,
  });
}

export function useFullTimeline(contactId: string) {
  return useQuery<ContactTimeline>({
    queryKey: ['crm', 'portal', 'full-timeline', contactId],
    queryFn: () => crmAPI.getContactTimeline(contactId),
    enabled: contactId.length > 0,
  });
}

export function useMemberConversations(contactId: string) {
  return useQuery<Conversation[]>({
    queryKey: ['crm', 'portal', 'member-conversations', contactId],
    queryFn: () => demo.getMemberConversations(contactId),
    enabled: contactId.length > 0,
  });
}

export function usePublicConversationInteractions(conversationId: string) {
  return useQuery<Interaction[]>({
    queryKey: ['crm', 'portal', 'public-interactions', conversationId],
    queryFn: () => demo.getPublicConversationInteractions(conversationId),
    enabled: conversationId.length > 0,
  });
}

export function useAllConversationInteractions(conversationId: string) {
  return useQuery<Interaction[]>({
    queryKey: ['crm', 'portal', 'all-interactions', conversationId],
    queryFn: () => demo.getAllConversationInteractions(conversationId),
    enabled: conversationId.length > 0,
  });
}

export function useEmployerConversations(orgId: string) {
  return useQuery<Conversation[]>({
    queryKey: ['crm', 'portal', 'employer-conversations', orgId],
    queryFn: () => demo.getEmployerConversations(orgId),
    enabled: orgId.length > 0,
  });
}

export function useDemoConversation(conversationId: string) {
  return useQuery<Conversation | undefined>({
    queryKey: ['crm', 'portal', 'conversation', conversationId],
    queryFn: () => demo.getConversation(conversationId),
    enabled: conversationId.length > 0,
  });
}

export function useDemoInteraction(interactionId: string) {
  return useQuery<Interaction | undefined>({
    queryKey: ['crm', 'portal', 'interaction', interactionId],
    queryFn: () => demo.getDemoInteraction(interactionId),
    enabled: interactionId.length > 0,
  });
}

export function useContactCommitments(contactId: string) {
  return useQuery<Commitment[]>({
    queryKey: ['crm', 'portal', 'commitments', contactId],
    queryFn: () => crmAPI.listCommitments({ contactId }) as unknown as Promise<Commitment[]>,
    enabled: contactId.length > 0,
  });
}

export function useDemoOrganization(orgId: string) {
  return useQuery<Organization | undefined>({
    queryKey: ['crm', 'portal', 'organization', orgId],
    queryFn: () => demo.getOrganization(orgId),
    enabled: orgId.length > 0,
  });
}

export function useDemoOrganizations() {
  return useQuery<Organization[]>({
    queryKey: ['crm', 'portal', 'organizations'],
    queryFn: () => demo.getAllOrganizations(),
  });
}

export function useCreatePortalMessage() {
  const queryClient = useQueryClient();
  return useMutation<Interaction, Error, CreatePortalMessageData>({
    mutationFn: (data) => Promise.resolve(demo.createPortalMessage(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'portal'] });
    },
  });
}

export function useCreateNewConversation() {
  const queryClient = useQueryClient();
  return useMutation<
    { conversation: Conversation; interaction: Interaction },
    Error,
    CreateConversationData
  >({
    mutationFn: (data) => Promise.resolve(demo.createNewConversation(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'portal'] });
    },
  });
}

export function useCreateStaffNote() {
  const queryClient = useQueryClient();
  return useMutation<Interaction, Error, CreateStaffNoteData>({
    mutationFn: (data) => Promise.resolve(demo.createStaffNote(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'portal'] });
    },
  });
}

export function useCreateStructuredNote() {
  const queryClient = useQueryClient();
  return useMutation<Interaction, Error, CreateStructuredNoteData>({
    mutationFn: (data) => Promise.resolve(demo.createStructuredStaffNote(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'portal'] });
    },
  });
}
