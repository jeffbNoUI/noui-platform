import { useState } from 'react';
import { useContact, useConversations } from '@/hooks/useCRM';
import { useMember } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import type { Contact } from '@/types/CRM';

import ContactSearch from '@/components/ContactSearch';
import InteractionTimeline from '@/components/InteractionTimeline';
import ConversationPanel from '@/components/ConversationPanel';
import CommitmentTracker from '@/components/CommitmentTracker';
import OutreachQueue from '@/components/OutreachQueue';
import NoteEditor from '@/components/NoteEditor';
import MemberBanner from '@/components/MemberBanner';
import BenefitCalculationPanel from '@/components/BenefitCalculationPanel';
import CaseJournalPanel from '@/components/CaseJournalPanel';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

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

export default function CRMWorkspace() {
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedInteractionId, setSelectedInteractionId] = useState('');
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  // Contact data
  const { data: contact } = useContact(selectedContactId);

  // Conversations for this contact
  const { data: conversations } = useConversations({
    contactId: selectedContactId || undefined,
  });

  // If this is a member contact, load pension data
  const legacyId = contact?.legacyMemberId;
  const memberId = legacyId ? parseInt(legacyId, 10) : 0;
  const { data: member } = useMember(memberId > 0 ? memberId : 0);
  const { data: calculation } = useBenefitCalculation(
    memberId > 0 ? memberId : 0,
    // Default to a reasonable retirement date
    new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
  );

  const handleContactSelect = (c: Contact) => {
    setSelectedContactId(c.contactId);
    setSelectedConversationId('');
    setSelectedInteractionId('');
    setShowNoteEditor(false);
  };

  const handleSelectConversation = (convId: string) => {
    setSelectedConversationId(convId);
  };

  const handleSelectInteraction = (intId: string) => {
    setSelectedInteractionId(intId);
    setShowNoteEditor(false);
  };

  const conversationList = conversations?.items ?? [];
  const badge = contact ? contactTypeBadge[contact.contactType] : null;
  const secFlag = contact?.securityFlag ? securityFlagConfig[contact.securityFlag] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CRM sub-header with search */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500">Contact Relationship Management</p>
              {selectedContactId && (
                <button
                  onClick={() => setShowJournal((v) => !v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    showJournal
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {showJournal ? 'Hide Journal' : 'Case Journal'}
                </button>
              )}
            </div>
            <ContactSearch onSelect={handleContactSelect} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* No contact selected */}
        {!selectedContactId && (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h2 className="mt-4 text-lg font-medium text-gray-900">Search for a contact</h2>
            <p className="mt-1 text-sm text-gray-500">
              Use the search bar above to find a member, beneficiary, or other contact.
            </p>
          </div>
        )}

        {/* Contact loaded */}
        {contact && (
          <div className={showJournal ? 'grid grid-cols-[1fr_380px] gap-6' : ''}>
            <div className="space-y-6">
              {/* Contact banner */}
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
                        {contact.legacyMemberId && (
                          <> &middot; Legacy ID: {contact.legacyMemberId}</>
                        )}
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
                    <p className="font-medium capitalize">
                      {contact.preferredChannel.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Language</span>
                    <p className="font-medium">{contact.preferredLanguage}</p>
                  </div>
                </div>
              </div>

              {/* Member pension integration (shown only for member contacts) */}
              {contact.contactType === 'member' && member && (
                <CollapsibleSection title="Pension Data" badge={`Member ${member.member_id}`}>
                  <div className="space-y-4 -mx-5 -my-4 px-5 py-4">
                    <MemberBanner member={member} />
                    {calculation && <BenefitCalculationPanel calculation={calculation} />}
                  </div>
                </CollapsibleSection>
              )}

              {/* Two-column layout */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left column: Timeline + Conversations */}
                <div className="space-y-6">
                  <InteractionTimeline
                    contactId={selectedContactId}
                    onSelectInteraction={handleSelectInteraction}
                  />

                  {/* Conversation list */}
                  <CollapsibleSection
                    title="Conversations"
                    badge={conversationList.length || undefined}
                  >
                    {conversationList.length === 0 ? (
                      <p className="text-center text-sm text-gray-500 py-4">No conversations.</p>
                    ) : (
                      <ul className="space-y-2">
                        {conversationList.map((conv) => {
                          const isSelected = conv.conversationId === selectedConversationId;
                          const statusColors: Record<string, string> = {
                            open: 'bg-blue-100 text-blue-800',
                            pending: 'bg-yellow-100 text-yellow-800',
                            resolved: 'bg-green-100 text-green-800',
                            closed: 'bg-gray-100 text-gray-600',
                            reopened: 'bg-orange-100 text-orange-800',
                          };
                          return (
                            <li key={conv.conversationId}>
                              <button
                                type="button"
                                onClick={() => handleSelectConversation(conv.conversationId)}
                                className={`w-full rounded-md border p-3 text-left transition-colors ${
                                  isSelected
                                    ? 'border-brand-300 bg-brand-50'
                                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-800 truncate">
                                    {conv.subject || 'Untitled'}
                                  </span>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[conv.status] || 'bg-gray-100 text-gray-600'}`}
                                  >
                                    {conv.status}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                                  <span>
                                    {conv.interactionCount} interaction
                                    {conv.interactionCount !== 1 ? 's' : ''}
                                  </span>
                                  {conv.slaBreached && (
                                    <span className="font-medium text-red-600">SLA Breached</span>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CollapsibleSection>

                  {/* Selected conversation detail */}
                  {selectedConversationId && (
                    <ConversationPanel
                      conversationId={selectedConversationId}
                      onSelectInteraction={handleSelectInteraction}
                    />
                  )}
                </div>

                {/* Right column: Commitments + Outreach + Note Editor */}
                <div className="space-y-6">
                  <CommitmentTracker contactId={selectedContactId} />

                  <OutreachQueue contactId={selectedContactId} />

                  {/* Note editor (shown when an interaction is selected) */}
                  {selectedInteractionId && (
                    <>
                      {!showNoteEditor ? (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                Interaction selected:{' '}
                                <span className="font-mono text-xs text-gray-500">
                                  {selectedInteractionId}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowNoteEditor(true)}
                              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                            >
                              Add Note
                            </button>
                          </div>
                        </div>
                      ) : (
                        <NoteEditor
                          interactionId={selectedInteractionId}
                          onSaved={() => setShowNoteEditor(false)}
                          onCancel={() => setShowNoteEditor(false)}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Case Journal (right sidebar when toggled) */}
            {showJournal && (
              <div className="sticky top-4 self-start">
                <CaseJournalPanel contactId={selectedContactId} memberId={contact.legacyMemberId} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
