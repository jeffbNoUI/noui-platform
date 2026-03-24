import { useState, useEffect, useRef } from 'react';
import { useContact, useConversations, useContactByLegacyId } from '@/hooks/useCRM';
import { useMember } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import type { Contact } from '@/types/CRM';

import ContactSearch from '@/components/ContactSearch';
import InteractionTimeline from '@/components/InteractionTimeline';
import type { TimelineSelectData } from '@/components/InteractionTimeline';
import ConversationDetailOverlay from '@/components/ConversationDetailOverlay';
import MemberBanner from '@/components/MemberBanner';
import BenefitCalculationPanel from '@/components/BenefitCalculationPanel';
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel';
import CaseJournalPanel from '@/components/CaseJournalPanel';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import CRMWorkspaceContactBanner from '@/components/CRMWorkspaceContactBanner';
import CRMWorkspaceConversationList from '@/components/CRMWorkspaceConversationList';
import CRMWorkspaceRightColumn from '@/components/CRMWorkspaceRightColumn';

interface CRMWorkspaceProps {
  initialMemberId?: number;
  onBack?: () => void;
}

export default function CRMWorkspace({ initialMemberId, onBack }: CRMWorkspaceProps) {
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedInteractionId, setSelectedInteractionId] = useState('');
  const [interactionOverlay, setInteractionOverlay] = useState<TimelineSelectData | null>(null);
  const [conversationOverlay, setConversationOverlay] = useState<{
    conversationId: string;
    sourceRect: DOMRect;
    index: number;
  } | null>(null);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const convRowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const legacyLookupId = initialMemberId ? String(initialMemberId) : '';
  const { data: initialContact } = useContactByLegacyId(legacyLookupId);
  const didAutoSelect = useRef(false);
  const { data: contact } = useContact(selectedContactId);
  const { data: conversations } = useConversations({
    contactId: selectedContactId || undefined,
  });
  const legacyId = contact?.legacyMemberId;
  const memberId = legacyId ? parseInt(legacyId, 10) : 0;
  const { data: member } = useMember(memberId > 0 ? memberId : 0);
  const { data: calculation } = useBenefitCalculation(
    memberId > 0 ? memberId : 0,
    new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
  );

  const handleContactSelect = (c: Contact) => {
    setSelectedContactId(c.contactId);
    setSelectedConversationId('');
    setSelectedInteractionId('');
    setShowNoteEditor(false);
  };

  useEffect(() => {
    if (initialContact && !didAutoSelect.current) {
      didAutoSelect.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from async data, guarded by ref
      handleContactSelect(initialContact);
    }
  }, [initialContact]);

  const handleSelectConversation = (convId: string, index: number) => {
    setSelectedConversationId(convId);
    const el = convRowRefs.current.get(convId);
    if (el) {
      setConversationOverlay({
        conversationId: convId,
        sourceRect: el.getBoundingClientRect(),
        index,
      });
    }
  };

  const handleNavigateConversation = (newIndex: number) => {
    const conv = conversationList[newIndex];
    if (!conv) return;
    setSelectedConversationId(conv.conversationId);
    setConversationOverlay((prev) =>
      prev ? { ...prev, conversationId: conv.conversationId, index: newIndex } : null,
    );
  };

  const handleSelectInteraction = (data: TimelineSelectData) => {
    setSelectedInteractionId(data.interactionId);
    setInteractionOverlay(data);
    setShowNoteEditor(false);
  };

  const handleNavigateInteraction = (newIndex: number) => {
    if (!interactionOverlay) return;
    const entry = interactionOverlay.entries[newIndex];
    if (!entry) return;
    setSelectedInteractionId(entry.interactionId);
    setInteractionOverlay({
      ...interactionOverlay,
      interactionId: entry.interactionId,
      entry,
      index: newIndex,
    });
  };

  const conversationList = conversations?.items ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <>
                  <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <span className="text-lg leading-none">&larr;</span>
                    <span>Back</span>
                  </button>
                  <div className="h-5 w-px bg-gray-200" />
                </>
              )}
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

        {contact && (
          <div className={showJournal ? 'grid grid-cols-[1fr_380px] gap-6' : ''}>
            <div className="space-y-6">
              <CRMWorkspaceContactBanner contact={contact} />
              {contact.contactType === 'member' && member && (
                <CollapsibleSection title="Pension Data" badge={`Member ${member.member_id}`}>
                  <div className="space-y-4 -mx-5 -my-4 px-5 py-4">
                    <MemberBanner member={member} />
                    {calculation && <BenefitCalculationPanel calculation={calculation} />}
                  </div>
                </CollapsibleSection>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  <InteractionTimeline
                    contactId={selectedContactId}
                    onSelectInteraction={handleSelectInteraction}
                  />
                  <CRMWorkspaceConversationList
                    conversations={conversationList}
                    selectedConversationId={selectedConversationId}
                    convRowRefs={convRowRefs}
                    onSelectConversation={handleSelectConversation}
                  />
                </div>
                <CRMWorkspaceRightColumn
                  contactId={selectedContactId}
                  selectedInteractionId={selectedInteractionId}
                  showNoteEditor={showNoteEditor}
                  onShowNoteEditor={() => setShowNoteEditor(true)}
                  onNoteSaved={() => setShowNoteEditor(false)}
                  onNoteCancel={() => setShowNoteEditor(false)}
                />
              </div>
            </div>

            {showJournal && (
              <div className="sticky top-4 self-start">
                <CaseJournalPanel contactId={selectedContactId} memberId={contact.legacyMemberId} />
              </div>
            )}
          </div>
        )}
      </main>

      {interactionOverlay && (
        <InteractionDetailPanel
          interactionId={interactionOverlay.interactionId}
          entry={interactionOverlay.entry}
          sourceRect={interactionOverlay.sourceRect}
          onClose={() => setInteractionOverlay(null)}
          entries={interactionOverlay.entries}
          currentIndex={interactionOverlay.index}
          onNavigate={handleNavigateInteraction}
        />
      )}

      {conversationOverlay && (
        <ConversationDetailOverlay
          conversationId={conversationOverlay.conversationId}
          sourceRect={conversationOverlay.sourceRect}
          onClose={() => setConversationOverlay(null)}
          conversations={conversationList}
          currentIndex={conversationOverlay.index}
          onNavigate={handleNavigateConversation}
        />
      )}
    </div>
  );
}
