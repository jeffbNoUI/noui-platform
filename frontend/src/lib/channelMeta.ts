import type { InteractionChannel, InteractionOutcome } from '@/types/CRM';

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
  work_item_created: 'text-purple-600',
  transferred: 'text-gray-600',
  voicemail_left: 'text-gray-500',
  no_answer: 'text-gray-400',
};

export const OUTCOME_LABELS: Record<InteractionOutcome | string, string> = {
  resolved: 'Resolved',
  escalated: 'Escalated',
  callback_scheduled: 'Callback Scheduled',
  info_provided: 'Info Provided',
  in_progress: 'In Progress',
  work_item_created: 'Work Item Created',
  transferred: 'Transferred',
  voicemail_left: 'Voicemail Left',
  no_answer: 'No Answer',
};
