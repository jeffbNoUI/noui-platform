import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import CommunicationPreferences from './CommunicationPreferences';
import AccessibilityPreferences from './AccessibilityPreferences';
import SecurityPreferences from './SecurityPreferences';

interface PreferencesSectionProps {
  memberId: string;
}

type SubTab = 'communication' | 'accessibility' | 'security';

const TABS: { key: SubTab; label: string }[] = [
  { key: 'communication', label: 'Communication' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'security', label: 'Security' },
];

export default function PreferencesSection({ memberId }: PreferencesSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('communication');

  return (
    <div data-testid="preferences-section">
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 24,
          fontWeight: 600,
          color: C.text,
          margin: '0 0 20px',
        }}
      >
        Preferences
      </h2>

      {/* Sub-tab bar */}
      <div
        data-testid="preferences-tabs"
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
      {activeTab === 'communication' && <CommunicationPreferences memberId={memberId} />}
      {activeTab === 'accessibility' && <AccessibilityPreferences memberId={memberId} />}
      {activeTab === 'security' && <SecurityPreferences memberId={memberId} />}
    </div>
  );
}
