import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GengageChat } from '../src/chat/index.js';

describe('GengageChat attachment validation', () => {
  const errorEvents: Array<{ message: string; source: string }> = [];
  let handler: (e: Event) => void;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    errorEvents.length = 0;
    handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; source: string };
      errorEvents.push(detail);
    };
    window.addEventListener('gengage:global:error', handler);
    // Mock fetch to prevent real requests
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof globalThis.fetch;
    // Mock URL.createObjectURL for thumbnail rendering
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof URL.createObjectURL;
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    }
  });

  afterEach(() => {
    window.removeEventListener('gengage:global:error', handler);
  });

  it('dispatches error for invalid MIME type and does not stage', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    (chat as unknown as { _handleAttachment(f: File): void })._handleAttachment(file);

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]!.source).toBe('chat');
    // File should NOT be staged
    const drawer = (chat as unknown as { _drawer: { getPendingAttachment(): File | null } })._drawer;
    expect(drawer.getPendingAttachment()).toBeNull();
  });

  it('dispatches error for file too large and does not stage', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const bigData = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([bigData], 'big.jpg', { type: 'image/jpeg' });
    (chat as unknown as { _handleAttachment(f: File): void })._handleAttachment(file);

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]!.source).toBe('chat');
    const drawer = (chat as unknown as { _drawer: { getPendingAttachment(): File | null } })._drawer;
    expect(drawer.getPendingAttachment()).toBeNull();
  });

  it('stages valid file without error', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    (chat as unknown as { _handleAttachment(f: File): void })._handleAttachment(file);

    expect(errorEvents).toHaveLength(0);
    const drawer = (chat as unknown as { _drawer: { getPendingAttachment(): File | null } })._drawer;
    expect(drawer.getPendingAttachment()).toBe(file);
  });
});
