import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from '@/components/CommandPalette';

const makeCommands = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `cmd-${i}`,
    label: `Command ${i + 1}`,
    icon: '#',
    shortcut: i < 3 ? `G ${i + 1}` : undefined,
    category: i < 5 ? 'Navigation' : 'Actions',
    action: vi.fn(),
  }));

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette commands={makeCommands(9)} isOpen={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows all commands when opened', () => {
    const commands = makeCommands(16);
    render(
      <CommandPalette commands={commands} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByPlaceholderText('Type a command...')).toBeInTheDocument();
    expect(screen.getByText('16 commands')).toBeInTheDocument();
    for (const cmd of commands) {
      expect(screen.getByText(cmd.label)).toBeInTheDocument();
    }
  });

  it('filters commands by search query', () => {
    const commands = makeCommands(9);
    render(
      <CommandPalette commands={commands} isOpen={true} onClose={vi.fn()} />
    );
    const input = screen.getByPlaceholderText('Type a command...');
    fireEvent.change(input, { target: { value: 'Command 1' } });
    // "Command 1", "Command 10"-"Command 16" won't exist with 9, so only "Command 1"
    expect(screen.getByText('Command 1')).toBeInTheDocument();
    expect(screen.getByText('1 command')).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    const commands = makeCommands(3);
    render(
      <CommandPalette commands={commands} isOpen={true} onClose={vi.fn()} />
    );
    // Arrow down should move selection
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    // Enter should execute the selected command
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(commands[2].action).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <CommandPalette commands={makeCommands(3)} isOpen={true} onClose={onClose} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows category headings', () => {
    const commands = makeCommands(9);
    render(
      <CommandPalette commands={commands} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
