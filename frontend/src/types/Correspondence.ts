/** Side-effect that fires when correspondence status changes to 'sent'. */
export interface SendEffect {
  type: 'advance_stage' | 'create_commitment';
  description?: string;
  targetDays?: number;
}

/** Correspondence template with merge field definitions. */
export interface CorrespondenceTemplate {
  templateId: string;
  tenantId: string;
  templateCode: string;
  templateName: string;
  description?: string;
  category: string;
  stageCategory?: string;
  onSendEffects: SendEffect[];
  bodyTemplate: string;
  mergeFields: MergeField[];
  outputFormat: 'text' | 'html' | 'pdf';
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/** Merge field definition within a template. */
export interface MergeField {
  name: string;
  type: 'string' | 'date' | 'currency' | 'number';
  required: boolean;
  description: string;
}

/** Generated correspondence record. */
export interface Correspondence {
  correspondenceId: string;
  tenantId: string;
  templateId: string;
  memberId?: number;
  caseId?: string;
  contactId?: string;
  subject: string;
  bodyRendered: string;
  mergeData: Record<string, string>;
  status: 'draft' | 'final' | 'sent' | 'void';
  generatedBy: string;
  sentAt?: string;
  sentVia?: string;
  deliveryAddress?: string;
  createdAt: string;
  updatedAt: string;
}

/** Request to generate a letter from a template. */
export interface GenerateCorrespondenceRequest {
  templateId: string;
  memberId?: number;
  caseId?: string;
  contactId?: string;
  mergeData: Record<string, string>;
}
