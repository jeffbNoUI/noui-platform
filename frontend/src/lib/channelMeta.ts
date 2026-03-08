import type {
  InteractionChannel,
  InteractionOutcome,
  CommitmentStatus,
  Direction,
} from '@/types/CRM';

export const CHANNEL_ICONS: Record<InteractionChannel | string, string> = {
  phone_inbound: '\ud83d\udcde',
  phone_outbound: '\ud83d\udcde',
  secure_message: '\ud83d\udcac',
  email_inbound: '\ud83d\udce7',
  email_outbound: '\ud83d\udce7',
  walk_in: '\ud83d\udeb6',
  portal_activity: '\ud83c\udf10',
  mail_inbound: '\u2709\ufe0f',
  mail_outbound: '\u2709\ufe0f',
  internal_handoff: '\ud83d\udd04',
  system_event: '\u2699\ufe0f',
  fax: '\ud83d\udce0',
};

export const CHANNEL_LABELS: Record<InteractionChannel | string, string> = {
  phone_inbound: 'Inbound Call',
  phone_outbound: 'Outbound Call',
  secure_message: 'Secure Message',
  email_inbound: 'Email Received',
  email_outbound: 'Email Sent',
  walk_in: 'Walk-in',
  portal_activity: 'Portal Activity',
  mail_inbound: 'Mail Received',
  mail_outbound: 'Mail Sent',
  internal_handoff: 'Internal Handoff',
  system_event: 'System Event',
  fax: 'Fax',
};

export const OUTCOME_STYLES: Record<InteractionOutcome | string, string> = {
  resolved: 'text-emerald-600',
  escalated: 'text-red-600',
  callback_scheduled: 'text-amber-600',
  info_provided: 'text-blue-600',
  in_progress: 'text-amber-600',
};

export const OUTCOME_LABELS: Record<InteractionOutcome | string, string> = {
  resolved: 'Resolved',
  escalated: 'Escalated',
  callback_scheduled: 'Callback Scheduled',
  info_provided: 'Info Provided',
  work_item_created: 'Work Item Created',
  transferred: 'Transferred',
  voicemail_left: 'Voicemail Left',
  no_answer: 'No Answer',
  in_progress: 'In Progress',
};

export const OUTCOME_BADGE_STYLES: Record<InteractionOutcome | string, string> = {
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  escalated: 'bg-red-50 text-red-700 border-red-200',
  callback_scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  info_provided: 'bg-blue-50 text-blue-700 border-blue-200',
  work_item_created: 'bg-purple-50 text-purple-700 border-purple-200',
  transferred: 'bg-gray-100 text-gray-600 border-gray-200',
  voicemail_left: 'bg-gray-100 text-gray-600 border-gray-200',
  no_answer: 'bg-gray-100 text-gray-600 border-gray-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const DIRECTION_BADGES: Record<Direction | string, { label: string; className: string }> = {
  inbound: { label: 'Inbound', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  outbound: { label: 'Outbound', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  internal: { label: 'Internal', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export const COMMITMENT_STATUS_STYLES: Record<CommitmentStatus | string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  fulfilled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const SENTIMENT_BADGES: Record<string, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-emerald-50 text-emerald-700' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-600' },
  negative: { label: 'Negative', className: 'bg-red-50 text-red-700' },
  frustrated: { label: 'Frustrated', className: 'bg-orange-50 text-orange-700' },
};
