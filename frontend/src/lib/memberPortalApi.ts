import { fetchAPI, postAPI, putAPI, deleteAPI, patchAPI } from './apiClient';
import type {
  MemberPreferences,
  SavedScenario,
  ScenarioInputs,
  Notification,
  IdentityVerificationRequest,
  IdentityVerificationResult,
  PaymentRecord,
  TaxDocument,
  DocumentUpload,
  ChangeRequest,
} from '@/types/MemberPortal';

// Identity verification
export const memberAuthAPI = {
  verify: (req: IdentityVerificationRequest) =>
    postAPI<IdentityVerificationResult>('/api/v1/member-auth/verify', req),
};

// Preferences
export const memberPreferencesAPI = {
  get: (memberId: number) => fetchAPI<MemberPreferences>(`/api/v1/members/${memberId}/preferences`),
  update: (memberId: number, prefs: MemberPreferences) =>
    putAPI<MemberPreferences>(`/api/v1/members/${memberId}/preferences`, prefs),
};

// Saved scenarios
export const scenarioAPI = {
  list: (memberId: number) => fetchAPI<SavedScenario[]>(`/api/v1/scenarios?member_id=${memberId}`),
  get: (id: string) => fetchAPI<SavedScenario>(`/api/v1/scenarios/${id}`),
  save: (
    memberId: number,
    label: string,
    inputs: ScenarioInputs,
    results: unknown,
    dataVersion: string,
  ) =>
    postAPI<SavedScenario>('/api/v1/scenarios', {
      member_id: memberId,
      label,
      inputs,
      results,
      data_version: dataVersion,
    }),
  delete: (id: string) => deleteAPI<void>(`/api/v1/scenarios/${id}`),
};

// Notifications
export const notificationAPI = {
  list: (memberId: number) =>
    fetchAPI<Notification[]>(`/api/v1/notifications?member_id=${memberId}`),
  markRead: (id: string) => patchAPI<void>(`/api/v1/notifications/${id}/read`, {}),
};

// Payments (retirees)
export const paymentAPI = {
  list: (memberId: number) => fetchAPI<PaymentRecord[]>(`/api/v1/members/${memberId}/payments`),
  taxDocuments: (memberId: number) =>
    fetchAPI<TaxDocument[]>(`/api/v1/members/${memberId}/tax-documents`),
};

// Documents
export const documentAPI = {
  list: (memberId: number) => fetchAPI<DocumentUpload[]>(`/api/v1/members/${memberId}/documents`),
  upload: (issueId: string, memberId: number, file: File, documentType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return postAPI<DocumentUpload>(
      `/api/v1/issues/${issueId}/documents?member_id=${memberId}&document_type=${encodeURIComponent(documentType)}`,
      formData,
    );
  },
  download: (documentId: string) =>
    fetchAPI<{
      document_id: string;
      file_name: string;
      content_type: string;
      download_url: string;
    }>(`/api/v1/documents/${documentId}/download`),
};

// Change requests (uses issues service)
export const changeRequestAPI = {
  list: (memberId: number) =>
    fetchAPI<ChangeRequest[]>(
      `/api/v1/issues?member_id=${memberId}&type=profile_change,beneficiary_change,data_correction,direct_deposit_change`,
    ),
  create: (
    req: Omit<ChangeRequest, 'id' | 'status' | 'staff_note' | 'created_at' | 'resolved_at'>,
  ) => postAPI<ChangeRequest>('/api/v1/issues', { ...req, type: 'profile_change' }),
};

// Addresses
export interface Address {
  id: string;
  type: 'mailing' | 'residential';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export const addressAPI = {
  list: (memberId: number) => fetchAPI<Address[]>(`/api/v1/members/${memberId}/addresses`),
  update: (memberId: number, addressId: string, data: Partial<Address>) =>
    putAPI<Address>(`/api/v1/members/${memberId}/addresses/${addressId}`, data),
};

// Refund estimate (inactive members)
export const refundAPI = {
  estimate: (memberId: number) =>
    fetchAPI<{ employee_contributions: number; interest: number; total: number }>(
      `/api/v1/members/${memberId}/refund-estimate`,
    ),
};
