import { act } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '@vtt/shared';

import { ChatPanel } from './ChatPanel';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    campaignId: 'campaign-1',
    userId: 'user-1',
    username: 'Alice',
    text: 'Hello',
    type: 'chat',
    rollData: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const defaultProps = {
  campaignId: 'campaign-1',
  messages: [],
  isLoading: false,
  isConnected: true,
  onSend: vi.fn(),
  onDiceRoll: vi.fn(),
};

describe('ChatPanel', () => {
  describe('empty state', () => {
    it('shows empty state text when no messages', () => {
      render(<ChatPanel {...defaultProps} />);
      expect(screen.getByText('No messages yet.')).toBeDefined();
    });

    it('shows loading text while fetching', () => {
      render(<ChatPanel {...defaultProps} isLoading={true} />);
      expect(screen.getByText('Loading messages…')).toBeDefined();
    });
  });

  describe('message rendering', () => {
    it('renders chat messages with username and text', () => {
      const messages = [makeMessage({ username: 'Bob', text: 'Hey there' })];
      render(<ChatPanel {...defaultProps} messages={messages} />);
      expect(screen.getByText('Bob')).toBeDefined();
      expect(screen.getByText('Hey there')).toBeDefined();
    });

    it('renders system messages as centered italic text', () => {
      const messages = [
        makeMessage({ id: 'sys-1', type: 'system', text: 'Bob joined the session' }),
      ];
      render(<ChatPanel {...defaultProps} messages={messages} />);
      expect(screen.getByText('Bob joined the session')).toBeDefined();
      // username span is not rendered for system messages
      expect(screen.queryByText('Alice')).toBeNull();
    });

    it('renders multiple messages', () => {
      const messages = [
        makeMessage({ id: 'm1', username: 'Alice', text: 'First' }),
        makeMessage({ id: 'm2', username: 'Bob', text: 'Second' }),
      ];
      render(<ChatPanel {...defaultProps} messages={messages} />);
      expect(screen.getByText('First')).toBeDefined();
      expect(screen.getByText('Second')).toBeDefined();
    });
  });

  describe('connection status', () => {
    it('shows Connected when connected', () => {
      render(<ChatPanel {...defaultProps} isConnected={true} />);
      expect(screen.getByText('Connected')).toBeDefined();
    });

    it('shows Disconnected when not connected', () => {
      render(<ChatPanel {...defaultProps} isConnected={false} />);
      expect(screen.getByText('Disconnected')).toBeDefined();
    });

    it('disables textarea when disconnected', () => {
      render(<ChatPanel {...defaultProps} isConnected={false} />);
      const textarea = screen.getByRole('textbox');
      expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    });
  });

  describe('sending messages', () => {
    it('calls onSend with trimmed text on Enter', async () => {
      const onSend = vi.fn();
      render(<ChatPanel {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Hello world{Enter}');

      expect(onSend).toHaveBeenCalledWith('Hello world');
    });

    it('clears textarea after sending', async () => {
      const onSend = vi.fn();
      render(<ChatPanel {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await userEvent.type(textarea, 'test message{Enter}');

      expect(textarea.value).toBe('');
    });

    it('does not send on Shift+Enter — inserts newline', async () => {
      const onSend = vi.fn();
      render(<ChatPanel {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'line one{Shift>}{Enter}{/Shift}line two');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send empty or whitespace-only messages', async () => {
      const onSend = vi.fn();
      render(<ChatPanel {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, '   {Enter}');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send when disconnected', async () => {
      const onSend = vi.fn();
      render(<ChatPanel {...defaultProps} isConnected={false} onSend={onSend} />);

      // textarea is disabled so userEvent won't type into it, which is correct behavior
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.disabled).toBe(true);
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('error banner', () => {
    it('shows error banner when message exceeds limit and can be dismissed', async () => {
      const onSend = vi.fn();
      const { container } = render(<ChatPanel {...defaultProps} onSend={onSend} />);

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      // Bypass the maxLength HTML attribute by firing a synthetic change event
      act(() => {
        fireEvent.change(textarea, { target: { value: 'x'.repeat(2001) } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      });

      expect(screen.getByRole('alert')).toBeDefined();
      expect(onSend).not.toHaveBeenCalled();

      await userEvent.click(screen.getByLabelText('Dismiss error'));
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('dice roll commands', () => {
    it('calls onDiceRoll instead of onSend when text starts with /roll', async () => {
      const onSend = vi.fn();
      const onDiceRoll = vi.fn();
      render(<ChatPanel {...defaultProps} onSend={onSend} onDiceRoll={onDiceRoll} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, '/roll 3d6+4{Enter}');

      expect(onDiceRoll).toHaveBeenCalledWith('3d6+4');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('calls onDiceRoll with advantage formula', async () => {
      const onDiceRoll = vi.fn();
      render(<ChatPanel {...defaultProps} onDiceRoll={onDiceRoll} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, '/roll d20 advantage{Enter}');

      expect(onDiceRoll).toHaveBeenCalledWith('d20 advantage');
    });

    it('clears textarea after /roll command', async () => {
      const onDiceRoll = vi.fn();
      render(<ChatPanel {...defaultProps} onDiceRoll={onDiceRoll} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await userEvent.type(textarea, '/roll d6{Enter}');

      expect(textarea.value).toBe('');
    });

    it('renders roll message with formula and total', () => {
      const rollData = {
        formula: '3d6+4',
        count: 3,
        sides: 6,
        rolls: [3, 5, 2],
        keptRolls: [3, 5, 2],
        modifier: 4,
        advantage: false,
        disadvantage: false,
        total: 14,
      };
      const messages = [
        makeMessage({ id: 'roll-1', username: 'Alice', type: 'roll', text: '3d6+4', rollData }),
      ];
      render(<ChatPanel {...defaultProps} messages={messages} />);

      expect(screen.getByText('rolled 3d6+4')).toBeDefined();
      expect(screen.getByText('14')).toBeDefined();
    });

    it('renders roll message username', () => {
      const rollData = {
        formula: 'd20',
        count: 1,
        sides: 20,
        rolls: [15],
        keptRolls: [15],
        modifier: 0,
        advantage: false,
        disadvantage: false,
        total: 15,
      };
      const messages = [makeMessage({ type: 'roll', text: 'd20', rollData, username: 'Bob' })];
      render(<ChatPanel {...defaultProps} messages={messages} />);
      expect(screen.getByText('Bob')).toBeDefined();
    });
  });
});
