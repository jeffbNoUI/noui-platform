import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConversationThread, { MEMBER_THEME, STAFF_THEME } from '../ConversationThread';
import type { Interaction } from '@/types/CRM';

function makeInteraction(overrides: Partial<Interaction> = {}): Interaction {
  return {
    interactionId: 'int-1',
    tenantId: 'tenant-1',
    channel: 'secure_message',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: new Date().toISOString(),
    visibility: 'public',
    summary: 'Hello, I have a question',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    ...overrides,
  };
}

describe('ConversationThread', () => {
  it('shows empty state when no interactions', () => {
    render(<ConversationThread interactions={[]} visibility="all" theme={MEMBER_THEME} />);
    expect(screen.getByText('No messages in this conversation yet.')).toBeInTheDocument();
  });

  it('renders message summaries', () => {
    const interactions = [
      makeInteraction({ interactionId: 'int-1', summary: 'First message' }),
      makeInteraction({ interactionId: 'int-2', summary: 'Second message' }),
    ];
    render(
      <ConversationThread interactions={interactions} visibility="all" theme={MEMBER_THEME} />,
    );
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('renders system events as centered pills', () => {
    const interactions = [
      makeInteraction({
        interactionId: 'sys-1',
        channel: 'system_event',
        interactionType: 'process_event',
        summary: 'Case advanced to Eligibility',
      }),
    ];
    render(<ConversationThread interactions={interactions} visibility="all" theme={STAFF_THEME} />);
    expect(screen.getByText('Case advanced to Eligibility')).toBeInTheDocument();
  });

  it('shows Internal badge for internal messages when visibility is all', () => {
    const interactions = [
      makeInteraction({
        interactionId: 'int-internal',
        visibility: 'internal',
        agentId: 'agent-sarah',
        direction: 'outbound',
        summary: 'Internal staff note',
      }),
    ];
    render(<ConversationThread interactions={interactions} visibility="all" theme={STAFF_THEME} />);
    expect(screen.getByText('Internal')).toBeInTheDocument();
    expect(screen.getByText('Internal staff note')).toBeInTheDocument();
  });

  it('filters out internal messages when visibility is public', () => {
    const interactions = [
      makeInteraction({ interactionId: 'pub-1', visibility: 'public', summary: 'Public msg' }),
      makeInteraction({ interactionId: 'priv-1', visibility: 'internal', summary: 'Secret note' }),
    ];
    render(
      <ConversationThread interactions={interactions} visibility="public" theme={MEMBER_THEME} />,
    );
    expect(screen.getByText('Public msg')).toBeInTheDocument();
    expect(screen.queryByText('Secret note')).not.toBeInTheDocument();
  });

  it('shows "You" label when interaction is from currentContactId', () => {
    const interactions = [
      makeInteraction({
        interactionId: 'mine-1',
        contactId: 'contact-42',
        direction: 'inbound',
        summary: 'My question',
      }),
    ];
    render(
      <ConversationThread
        interactions={interactions}
        visibility="all"
        theme={MEMBER_THEME}
        currentContactId="contact-42"
      />,
    );
    expect(screen.getByText('You')).toBeInTheDocument();
  });
});
