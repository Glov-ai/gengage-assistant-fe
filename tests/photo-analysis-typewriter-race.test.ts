/**
 * Regression test: PhotoAnalysisCard UISpec arriving after outputText final
 * must cancel any running typewriter before replacing the bubble content.
 *
 * Sequence under test (the race):
 *   1. outputText final arrives → typewriter starts animating multi-block HTML
 *   2. PhotoAnalysisCard UISpec arrives while typewriter is still running
 *   3. The stream handler must cancel the typewriter before rendering the card
 *
 * Without the fix, the typewriter keeps appending plain-text spans into/after
 * the photo-analysis card on timers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { typewriteHtml } from '../src/chat/components/typewriter.js';
import type { TypewriterHandle } from '../src/chat/components/typewriter.js';
import {
  createBeautyStreamState,
  handleBeautyUISpec,
} from '../src/chat/features/beauty-consulting/stream-handler.js';
import type { ChatMessage } from '../src/chat/types.js';

describe('PhotoAnalysisCard typewriter race', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('cancels running typewriter when PhotoAnalysisCard UISpec arrives after text', () => {
    // Step 1: Start a multi-block typewriter (simulates outputText final)
    const multiBlockHtml = '<p>First paragraph of analysis.</p><p>Second paragraph with details.</p><p>Third paragraph with more info.</p>';
    let activeTypewriter: TypewriterHandle | null = null;

    activeTypewriter = typewriteHtml({
      container,
      html: multiBlockHtml,
      delayMs: 50, // Slow enough that not all blocks reveal before UISpec arrives
    });

    // Typewriter should be running (multi-block content)
    expect(activeTypewriter.isRunning).toBe(true);

    // Step 2: PhotoAnalysisCard UISpec arrives — simulate the stream handler
    const beautyState = createBeautyStreamState();
    const botMsg: ChatMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Analysis text',
      status: 'done',
      threadId: 'thread-1',
    };

    const updateBotMessageMock = vi.fn();
    const cancelTypewriterMock = vi.fn(() => {
      activeTypewriter?.cancel();
      activeTypewriter = null;
    });

    const handled = handleBeautyUISpec(
      'PhotoAnalysisCard',
      {
        summary: 'Your skin looks dry.',
        clues: ['Redness observed', 'Wide pores'],
        next_question: 'Shall we recommend a moisturizer?',
      },
      beautyState,
      {
        drawer: {
          updateBotMessage: updateBotMessageMock,
          setBeautyPhotoStepCard: vi.fn(),
        },
        ensureRendered: vi.fn(),
        cancelTypewriter: cancelTypewriterMock,
        sendSkipMessage: vi.fn(),
        streamDone: false,
        beautyPhotoStepSkipMessage: 'Skip',
      },
      botMsg,
    );

    // Step 3: Verify the handler cancelled the typewriter and rendered the card
    expect(handled).toBe(true);
    expect(cancelTypewriterMock).toHaveBeenCalledOnce();
    expect(activeTypewriter).toBeNull(); // Typewriter was nulled out

    // botMsg should have photo analysis data attached
    expect(botMsg.renderHint).toBe('photo_analysis');
    expect(botMsg.photoAnalysis).toEqual({
      summary: 'Your skin looks dry.',
      clues: ['Redness observed', 'Wide pores'],
      nextQuestion: 'Shall we recommend a moisturizer?',
    });

    // updateBotMessage should have been called with photo_analysis hint
    expect(updateBotMessageMock).toHaveBeenCalledWith(
      'msg-1',
      'Analysis text',
      'photo_analysis',
      botMsg.photoAnalysis,
    );
  });

  it('typewriter timer does not corrupt container after cancel', async () => {
    // Start a slow multi-block typewriter
    let activeTypewriter: TypewriterHandle | null = typewriteHtml({
      container,
      html: '<p>Block one.</p><p>Block two.</p><p>Block three.</p>',
      delayMs: 100,
    });

    expect(activeTypewriter.isRunning).toBe(true);
    // First block is revealed immediately
    const initialChildCount = container.childNodes.length;
    expect(initialChildCount).toBeGreaterThanOrEqual(1);

    // Cancel the typewriter (simulates what the beauty handler does)
    activeTypewriter.cancel();
    activeTypewriter = null;

    // Replace container content (simulates updateBotMessage rendering the card)
    container.innerHTML = '<div class="gengage-chat-photo-analysis-card">Card content</div>';
    const cardHtml = container.innerHTML;

    // Wait long enough for any leaked timer to fire
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Container should still have only the card — no typewriter blocks appended
    expect(container.innerHTML).toBe(cardHtml);
    expect(container.querySelectorAll('.gengage-chat-typewriter-block').length).toBe(0);
    expect(container.querySelectorAll('.gengage-chat-photo-analysis-card').length).toBe(1);
  });

  it('does not cancel typewriter for non-beauty UISpec types', () => {
    const beautyState = createBeautyStreamState();
    const botMsg: ChatMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Some text',
      status: 'streaming',
      threadId: 'thread-1',
    };

    const cancelTypewriterMock = vi.fn();

    const handled = handleBeautyUISpec(
      'ProductCard',
      { product: { sku: '123', name: 'Test' } },
      beautyState,
      {
        drawer: {
          updateBotMessage: vi.fn(),
          setBeautyPhotoStepCard: vi.fn(),
        },
        ensureRendered: vi.fn(),
        cancelTypewriter: cancelTypewriterMock,
        sendSkipMessage: vi.fn(),
        streamDone: false,
        beautyPhotoStepSkipMessage: 'Skip',
      },
      botMsg,
    );

    // ProductCard is not handled by beauty stream handler
    expect(handled).toBe(false);
    expect(cancelTypewriterMock).not.toHaveBeenCalled();
  });

  it('handles UISpec-only stream (no prior text, no typewriter to cancel)', () => {
    const beautyState = createBeautyStreamState();
    const botMsg: ChatMessage = {
      id: 'msg-3',
      role: 'assistant',
      content: undefined,
      status: 'streaming',
      threadId: 'thread-1',
    };

    const cancelTypewriterMock = vi.fn();
    const ensureRenderedMock = vi.fn();
    const updateBotMessageMock = vi.fn();

    const handled = handleBeautyUISpec(
      'PhotoAnalysisCard',
      {
        summary: 'Skin analysis complete.',
        clues: ['Hydration low'],
      },
      beautyState,
      {
        drawer: {
          updateBotMessage: updateBotMessageMock,
          setBeautyPhotoStepCard: vi.fn(),
        },
        ensureRendered: ensureRenderedMock,
        cancelTypewriter: cancelTypewriterMock,
        sendSkipMessage: vi.fn(),
        streamDone: false,
        beautyPhotoStepSkipMessage: 'Skip',
      },
      botMsg,
    );

    expect(handled).toBe(true);
    // cancelTypewriter is still called (idempotent — safe even with no active typewriter)
    expect(cancelTypewriterMock).toHaveBeenCalledOnce();
    // ensureRendered creates the bubble for UISpec-only streams
    expect(ensureRenderedMock).toHaveBeenCalledOnce();
    // updateBotMessage renders the card with empty content fallback
    expect(updateBotMessageMock).toHaveBeenCalledWith('msg-3', '', 'photo_analysis', botMsg.photoAnalysis);
  });
});
