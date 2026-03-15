import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PortalTimeline from '../PortalTimeline';
import { STAFF_THEME } from '../ConversationThread';
import type { TimelineEntry } from '@/types/CRM';

function makeEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    interactionId: 'tl-1',
    channel: 'phone_inbound',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: new Date().toISOString(),
    hasNotes: false,
    hasCommitments: false,
    visibility: 'public',
    ...overrides,
  };
}

describe('PortalTimeline', () => {
  it('shows empty state when no entries', () => {
    render(<PortalTimeline entries={[]} visibility="all" theme={STAFF_THEME} />);
    expect(screen.getByText('No interactions recorded.')).toBeInTheDocument();
  });

  it('renders channel labels and direction for entries', () => {
    const entries = [
      makeEntry({
        interactionId: 'tl-phone',
        channel: 'phone_inbound',
        direction: 'inbound',
        summary: 'Called about benefits',
      }),
      makeEntry({
        interactionId: 'tl-email',
        channel: 'email_outbound',
        direction: 'outbound',
        summary: 'Sent confirmation',
      }),
    ];
    render(<PortalTimeline entries={entries} visibility="all" theme={STAFF_THEME} />);
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Called about benefits')).toBeInTheDocument();
    expect(screen.getByText('Sent confirmation')).toBeInTheDocument();
  });

  it('filters internal entries when visibility is public', () => {
    const entries = [
      makeEntry({ interactionId: 'pub', visibility: 'public', summary: 'Public entry' }),
      makeEntry({ interactionId: 'priv', visibility: 'internal', summary: 'Internal entry' }),
    ];
    render(<PortalTimeline entries={entries} visibility="public" theme={STAFF_THEME} />);
    expect(screen.getByText('Public entry')).toBeInTheDocument();
    expect(screen.queryByText('Internal entry')).not.toBeInTheDocument();
  });

  it('calls onSelectEntry when an entry is clicked', () => {
    const onSelect = vi.fn();
    const entries = [makeEntry({ interactionId: 'click-me', summary: 'Clickable' })];
    render(
      <PortalTimeline
        entries={entries}
        visibility="all"
        theme={STAFF_THEME}
        onSelectEntry={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Clickable'));
    expect(onSelect).toHaveBeenCalledWith('click-me');
  });
});
