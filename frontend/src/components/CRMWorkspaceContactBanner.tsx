import type { Contact } from '@/types/CRM';

// ── Contact type badge config ───────────────────────────────────────────────

const contactTypeBadge: Record<string, { label: string; color: string }> = {
  member: { label: 'Member', color: 'bg-blue-100 text-blue-800' },
  beneficiary: { label: 'Beneficiary', color: 'bg-purple-100 text-purple-800' },
  alternate_payee: { label: 'Alt Payee', color: 'bg-amber-100 text-amber-800' },
  external: { label: 'External', color: 'bg-gray-100 text-gray-700' },
};

const securityFlagConfig: Record<string, { label: string; color: string }> = {
  fraud_alert: { label: 'Fraud Alert', color: 'bg-red-100 border-red-300 text-red-800' },
  pending_divorce: {
    label: 'Pending Divorce',
    color: 'bg-orange-100 border-orange-300 text-orange-800',
  },
  suspected_death: { label: 'Suspected Death', color: 'bg-red-100 border-red-300 text-red-800' },
  legal_hold: { label: 'Legal Hold', color: 'bg-red-100 border-red-300 text-red-800' },
  restricted_access: {
    label: 'Restricted Access',
    color: 'bg-red-100 border-red-300 text-red-800',
  },
};

interface CRMWorkspaceContactBannerProps {
  contact: Contact;
}

export default function CRMWorkspaceContactBanner({ contact }: CRMWorkspaceContactBannerProps) {
  const badge = contactTypeBadge[contact.contactType] ?? null;
  const secFlag = contact.securityFlag ? securityFlagConfig[contact.securityFlag] : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
            {contact.firstName[0]}
            {contact.lastName[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {contact.firstName}
              {contact.middleName ? ` ${contact.middleName}` : ''} {contact.lastName}
              {contact.suffix ? ` ${contact.suffix}` : ''}
            </h1>
            <p className="text-sm text-gray-500">
              Contact ID: {contact.contactId}
              {contact.legacyMemberId && <> &middot; Legacy ID: {contact.legacyMemberId}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {badge && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
          )}
          {contact.identityVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Security flag warning */}
      {secFlag && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${secFlag.color}`}
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {secFlag.label}
          {contact.securityFlagNote && (
            <span className="font-normal"> &mdash; {contact.securityFlagNote}</span>
          )}
        </div>
      )}

      {/* Contact details */}
      <div className="mt-3 grid grid-cols-4 gap-4 border-t border-gray-100 pt-3 text-sm">
        <div>
          <span className="text-gray-500">Phone</span>
          <p className="font-medium">{contact.primaryPhone || 'Not on file'}</p>
        </div>
        <div>
          <span className="text-gray-500">Email</span>
          <p className="font-medium truncate">{contact.primaryEmail || 'Not on file'}</p>
        </div>
        <div>
          <span className="text-gray-500">Preferred Channel</span>
          <p className="font-medium capitalize">{contact.preferredChannel.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <span className="text-gray-500">Language</span>
          <p className="font-medium">{contact.preferredLanguage}</p>
        </div>
      </div>
    </div>
  );
}
