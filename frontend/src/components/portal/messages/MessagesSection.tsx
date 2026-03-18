import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import ActivityTracker from '../activity/ActivityTracker';
import MessageList from './MessageList';
import ComposeMessage from './ComposeMessage';
import InteractionHistory from './InteractionHistory';
import type { ActivityItem } from '@/hooks/useActivityTracker';

interface MessagesSectionProps {
  memberId: string;
}

type SubTab = 'activity' | 'messages' | 'history';

const TABS: { key: SubTab; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'messages', label: 'Messages' },
  { key: 'history', label: 'History' },
];

export default function MessagesSection({ memberId }: MessagesSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('activity');
  const [composing, setComposing] = useState(false);

  const memberId_str = String(memberId);

  const handleActivityAction = (item: ActivityItem) => {
    if (item.source === 'conversation') {
      setActiveTab('messages');
    }
  };

  if (composing) {
    return (
      <div data-testid="messages-section">
        <ComposeMessage
          memberId={memberId_str}
          onSent={() => {
            setComposing(false);
            setActiveTab('messages');
          }}
          onCancel={() => setComposing(false)}
        />
      </div>
    );
  }

  return (
    <div data-testid="messages-section">
      {/* Section heading */}
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 24,
          fontWeight: 600,
          color: C.text,
          margin: '0 0 20px',
        }}
      >
        Messages & Activity
      </h2>

      {/* Sub-tab bar */}
      <div
        data-testid="messages-tabs"
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: `2px solid ${C.borderLight}`,
          marginBottom: 24,
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? C.sage : C.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === key ? `2px solid ${C.sage}` : '2px solid transparent',
              padding: '10px 20px',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'activity' && (
        <ActivityTracker memberId={memberId_str} onAction={handleActivityAction} />
      )}
      {activeTab === 'messages' && (
        <MessageList memberId={memberId_str} onCompose={() => setComposing(true)} />
      )}
      {activeTab === 'history' && <InteractionHistory memberId={memberId_str} />}
    </div>
  );
}
