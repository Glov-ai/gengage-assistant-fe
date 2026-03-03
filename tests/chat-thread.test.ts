/**
 * Tests for the chat thread system.
 *
 * Validates thread ID assignment, visibility filtering, branch deletion,
 * and rollback behavior.
 */

import { describe, it, expect } from 'vitest';
import { uuidv7 } from '../src/common/uuidv7.js';
import type { ChatMessage } from '../src/chat/types.js';

// Minimal helpers to simulate the thread logic from GengageChat without
// importing the full widget (which needs DOM/ShadowRoot).

function createMessage(role: 'user' | 'assistant', content: string, threadId?: string): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: Date.now(),
    status: 'done',
    threadId,
  };
}

function getVisibleMessages(messages: ChatMessage[], currentThreadId: string | null): ChatMessage[] {
  if (!currentThreadId) return messages;
  return messages.filter((m) => !m.threadId || m.threadId <= currentThreadId);
}

describe('Thread ID assignment', () => {
  it('user and bot messages in the same request share a threadId', () => {
    const threadId = uuidv7();
    const userMsg = createMessage('user', 'Hello', threadId);
    const botMsg = createMessage('assistant', 'Hi there', threadId);

    expect(userMsg.threadId).toBe(threadId);
    expect(botMsg.threadId).toBe(threadId);
    expect(userMsg.threadId).toBe(botMsg.threadId);
  });

  it('different request cycles get different threadIds', async () => {
    const t1 = uuidv7();
    await new Promise((r) => setTimeout(r, 2));
    const t2 = uuidv7();

    expect(t1).not.toBe(t2);
    expect(t1 < t2).toBe(true);
  });
});

describe('Visibility filtering', () => {
  it('shows all messages when no thread cursor is set', () => {
    const messages = [
      createMessage('user', 'q1', 'aaa'),
      createMessage('assistant', 'a1', 'aaa'),
      createMessage('user', 'q2', 'bbb'),
      createMessage('assistant', 'a2', 'bbb'),
    ];

    const visible = getVisibleMessages(messages, null);
    expect(visible).toHaveLength(4);
  });

  it('filters out messages with threadId > currentThreadId', () => {
    const messages = [
      createMessage('user', 'q1', 'aaa'),
      createMessage('assistant', 'a1', 'aaa'),
      createMessage('user', 'q2', 'bbb'),
      createMessage('assistant', 'a2', 'bbb'),
      createMessage('user', 'q3', 'ccc'),
      createMessage('assistant', 'a3', 'ccc'),
    ];

    const visible = getVisibleMessages(messages, 'bbb');
    expect(visible).toHaveLength(4);
    expect(visible.every((m) => !m.threadId || m.threadId <= 'bbb')).toBe(true);
  });

  it('keeps messages without threadId (pre-thread messages)', () => {
    const messages = [
      createMessage('user', 'legacy message'), // no threadId
      createMessage('user', 'q1', 'aaa'),
      createMessage('assistant', 'a1', 'aaa'),
    ];

    const visible = getVisibleMessages(messages, 'aaa');
    expect(visible).toHaveLength(3);
  });
});

describe('Branch deletion', () => {
  it('removes messages after the cutoff when branching', () => {
    const messages = [
      createMessage('user', 'q1', 'aaa'),
      createMessage('assistant', 'a1', 'aaa'),
      createMessage('user', 'q2', 'bbb'),
      createMessage('assistant', 'a2', 'bbb'),
      createMessage('user', 'q3', 'ccc'),
      createMessage('assistant', 'a3', 'ccc'),
    ];

    // Simulate rewinding to 'aaa' then typing new message
    const currentThreadId = 'aaa';
    const lastThreadId = 'ccc';

    // Detect branch point
    expect(lastThreadId > currentThreadId).toBe(true);

    // Delete future messages
    const pruned = messages.filter((m) => !m.threadId || m.threadId <= currentThreadId);
    expect(pruned).toHaveLength(2);
    expect(pruned.every((m) => m.threadId === 'aaa')).toBe(true);
  });
});

describe('Rollback hides correct messages', () => {
  it('rollback to thread hides later messages', () => {
    const t1 = '019xxxxx-0001-7000-8000-000000000001';
    const t2 = '019xxxxx-0002-7000-8000-000000000002';
    const t3 = '019xxxxx-0003-7000-8000-000000000003';

    const messages = [
      createMessage('user', 'q1', t1),
      createMessage('assistant', 'a1', t1),
      createMessage('user', 'q2', t2),
      createMessage('assistant', 'a2', t2),
      createMessage('user', 'q3', t3),
      createMessage('assistant', 'a3', t3),
    ];

    // Rollback to t2
    const visible = getVisibleMessages(messages, t2);
    expect(visible).toHaveLength(4);

    // Messages with t3 are hidden
    const hidden = messages.filter((m) => m.threadId && m.threadId > t2);
    expect(hidden).toHaveLength(2);
    expect(hidden.every((m) => m.threadId === t3)).toBe(true);
  });
});
