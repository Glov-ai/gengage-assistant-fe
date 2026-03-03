import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { typewriteHtml } from '../src/chat/components/typewriter.js';

describe('typewriteHtml', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders single-block content immediately without animation', () => {
    const onComplete = vi.fn();
    const handle = typewriteHtml({
      container,
      html: '<p>Hello world</p>',
      onComplete,
    });

    expect(container.innerHTML).toBe('<p>Hello world</p>');
    expect(handle.isRunning).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('renders inline-only content immediately', () => {
    const handle = typewriteHtml({
      container,
      html: 'Just plain text',
    });
    expect(container.innerHTML).toBe('Just plain text');
    expect(handle.isRunning).toBe(false);
  });

  it('skips animation when content contains a table', () => {
    const html = '<p>Intro</p><table><tr><td>A</td></tr></table><p>End</p>';
    const handle = typewriteHtml({ container, html });

    // Browser may normalize table (e.g. add tbody), so check content rather than exact HTML
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('p')).toBeTruthy();
    expect(handle.isRunning).toBe(false);
  });

  it('reveals multi-block content with stagger', async () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const onComplete = vi.fn();

    const html = '<p>Block 1</p><p>Block 2</p><p>Block 3</p>';
    const handle = typewriteHtml({
      container,
      html,
      delayMs: 50,
      onTick,
      onComplete,
    });

    expect(handle.isRunning).toBe(true);
    // First block revealed immediately
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(1);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Advance to reveal second block
    await vi.advanceTimersByTimeAsync(50);
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(2);
    expect(onTick).toHaveBeenCalledTimes(2);

    // Advance to reveal third block
    await vi.advanceTimersByTimeAsync(50);
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(3);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(handle.isRunning).toBe(false);

    vi.useRealTimers();
  });

  it('complete() skips to end immediately', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    const html = '<p>A</p><p>B</p><p>C</p>';
    const handle = typewriteHtml({ container, html, delayMs: 100, onComplete });

    expect(handle.isRunning).toBe(true);
    handle.complete();

    expect(container.innerHTML).toBe(html);
    expect(handle.isRunning).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('cancel() stops animation mid-reveal', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    const html = '<p>A</p><p>B</p><p>C</p>';
    const handle = typewriteHtml({ container, html, delayMs: 100, onComplete });

    expect(handle.isRunning).toBe(true);
    handle.cancel();

    expect(handle.isRunning).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    // Only first block should be visible
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(1);

    vi.useRealTimers();
  });

  it('groups adjacent inline elements as a single block', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const html = '<strong>Bold</strong> and <em>italic</em><p>Then a paragraph</p>';
    const handle = typewriteHtml({ container, html, delayMs: 10, onComplete });

    // Should have 2 blocks (inline group + paragraph) — first revealed immediately
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(1);

    // Advance to reveal second block
    await vi.advanceTimersByTimeAsync(10);
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(2);
    expect(handle.isRunning).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('respects prefers-reduced-motion', () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const html = '<p>A</p><p>B</p><p>C</p>';
    const handle = typewriteHtml({ container, html });

    expect(container.innerHTML).toBe(html);
    expect(handle.isRunning).toBe(false);

    window.matchMedia = origMatchMedia;
  });

  it('handles empty html', () => {
    const handle = typewriteHtml({ container, html: '' });
    expect(container.innerHTML).toBe('');
    expect(handle.isRunning).toBe(false);
  });
});
