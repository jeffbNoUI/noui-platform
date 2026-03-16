import { useState } from 'react';
import {
  useEmployerConversations,
  usePublicConversationInteractions,
  useCreatePortalMessage,
  useCreateNewConversation,
  usePortalOrganizations,
  usePortalOrganization,
} from '@/hooks/useCRM';
import { BODY } from '@/lib/designSystem';
import EmployerCorrespondenceTab from './EmployerCorrespondenceTab';
import EmployerPortalNav from './EmployerPortalNav';
import EmployerPortalOrgBanner from './EmployerPortalOrgBanner';
import EmployerPortalReporting from './EmployerPortalReporting';
import EmployerPortalEnrollment from './EmployerPortalEnrollment';
import EmployerPortalCommunications from './EmployerPortalCommunications';
import { EC, PortalTab, ViewMode } from './EmployerPortalConstants';

// ── Main component ──────────────────────────────────────────────────────────

interface EmployerPortalProps {
  onChangeView: (mode: ViewMode) => void;
}

export default function EmployerPortal({ onChangeView }: EmployerPortalProps) {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedConvId, setSelectedConvId] = useState('');
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [activeTab, setActiveTab] = useState<PortalTab>('communications');

  const { data: organizations } = usePortalOrganizations();
  const orgList = organizations ?? [];
  const effectiveOrgId = selectedOrgId || (orgList.length > 0 ? orgList[0].orgId : '');
  const { data: org } = usePortalOrganization(effectiveOrgId);
  const { data: conversations } = useEmployerConversations(effectiveOrgId);
  const sendMessage = useCreatePortalMessage();
  const createConv = useCreateNewConversation();

  const convList = conversations ?? [];
  const effectiveConvId = selectedConvId || (convList.length > 0 ? convList[0].conversationId : '');
  const { data: interactions } = usePublicConversationInteractions(effectiveConvId);

  const handleSend = (message: string) => {
    if (composing) {
      if (!newSubject.trim()) return;
      createConv.mutate(
        {
          anchorType: 'EMPLOYER',
          anchorId: effectiveOrgId,
          subject: newSubject.trim(),
          initialMessage: message,
          orgId: effectiveOrgId,
          direction: 'inbound',
        },
        {
          onSuccess: (result) => {
            setComposing(false);
            setNewSubject('');
            setSelectedConvId(result.conversation.conversationId);
          },
        },
      );
    } else if (effectiveConvId) {
      sendMessage.mutate({
        conversationId: effectiveConvId,
        orgId: effectiveOrgId,
        content: message,
        direction: 'inbound',
      });
    }
  };

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedConvId('');
  };

  const handleSelectConv = (convId: string) => {
    setSelectedConvId(convId);
    setComposing(false);
  };

  const handleStartCompose = () => {
    setComposing(true);
    setSelectedConvId('');
  };

  return (
    <div style={{ fontFamily: BODY, background: EC.bg, color: EC.text, minHeight: '100vh' }}>
      {/* ═══ TOP NAV ═══ */}
      <EmployerPortalNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onChangeView={onChangeView}
        effectiveOrgId={effectiveOrgId}
        orgList={orgList}
        onOrgChange={handleOrgChange}
      />

      {/* ═══ ORG INFO BANNER ═══ */}
      {org && <EmployerPortalOrgBanner org={org} />}

      {/* ═══ CONTENT AREA ═══ */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 60px' }}>
        {activeTab === 'reporting' && <EmployerPortalReporting />}

        {activeTab === 'enrollment' && <EmployerPortalEnrollment org={org} />}

        {activeTab === 'correspondence' && <EmployerCorrespondenceTab contactId={effectiveOrgId} />}

        {activeTab === 'communications' && (
          <EmployerPortalCommunications
            convList={convList}
            effectiveConvId={effectiveConvId}
            composing={composing}
            interactions={interactions ?? []}
            onSelectConv={handleSelectConv}
            onStartCompose={handleStartCompose}
            onSend={handleSend}
            onSubjectChange={setNewSubject}
          />
        )}
      </div>
    </div>
  );
}
