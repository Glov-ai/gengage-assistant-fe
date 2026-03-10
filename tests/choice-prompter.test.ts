/**
 * Tests for ChoicePrompter component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChoicePrompter, isChoicePrompterDismissed } from '../src/chat/components/ChoicePrompter.js';

const THREAD_A = 'thread-aaa';
const THREAD_B = 'thread-bbb';

beforeEach(() => {
  sessionStorage.clear();
});

describe('createChoicePrompter', () => {
  it('renders heading, suggestion, CTA, and dismiss button', () => {
    const el = createChoicePrompter({
      heading: 'Kararsız mı kaldın?',
      suggestion: 'Ürünleri seçip karşılaştırabilirsin',
      ctaLabel: 'Seç ve Karşılaştır',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });

    expect(el.className).toBe('gengage-chat-choice-prompter');
    expect(el.querySelector('.gengage-chat-choice-prompter-heading')?.textContent).toBe('Kararsız mı kaldın?');
    expect(el.querySelector('.gengage-chat-choice-prompter-suggestion')?.textContent).toBe(
      'Ürünleri seçip karşılaştırabilirsin',
    );
    expect(el.querySelector('.gengage-chat-choice-prompter-cta')?.textContent).toBe('Seç ve Karşılaştır');
    expect(el.querySelector('.gengage-chat-choice-prompter-dismiss')).not.toBeNull();
  });

  it('calls onCtaClick and removes itself on CTA click', () => {
    const onCtaClick = vi.fn();
    const parent = document.createElement('div');
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick,
    });
    parent.appendChild(el);

    const cta = el.querySelector('.gengage-chat-choice-prompter-cta') as HTMLElement;
    cta.click();

    expect(onCtaClick).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(0);
  });

  it('calls onDismiss and removes itself on dismiss click', () => {
    const onDismiss = vi.fn();
    const parent = document.createElement('div');
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
      onDismiss,
    });
    parent.appendChild(el);

    const dismiss = el.querySelector('.gengage-chat-choice-prompter-dismiss') as HTMLElement;
    dismiss.click();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(0);
  });

  it('marks as dismissed for the given threadId on CTA click', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });

    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);

    const cta = el.querySelector('.gengage-chat-choice-prompter-cta') as HTMLElement;
    cta.click();

    expect(isChoicePrompterDismissed(THREAD_A)).toBe(true);
  });

  it('marks as dismissed for the given threadId on dismiss click', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });

    const dismiss = el.querySelector('.gengage-chat-choice-prompter-dismiss') as HTMLElement;
    dismiss.click();

    expect(isChoicePrompterDismissed(THREAD_A)).toBe(true);
  });
});

describe('isChoicePrompterDismissed (per-thread)', () => {
  it('returns false when not dismissed for any thread', () => {
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
  });

  it('returns true only for the dismissed thread', () => {
    // Dismiss thread A via CTA click
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    el.querySelector<HTMLElement>('.gengage-chat-choice-prompter-cta')!.click();

    expect(isChoicePrompterDismissed(THREAD_A)).toBe(true);
    expect(isChoicePrompterDismissed(THREAD_B)).toBe(false);
  });

  it('supports dismissing multiple threads independently', () => {
    const elA = createChoicePrompter({
      heading: 'A',
      suggestion: 'A',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    elA.querySelector<HTMLElement>('.gengage-chat-choice-prompter-cta')!.click();

    const elB = createChoicePrompter({
      heading: 'B',
      suggestion: 'B',
      ctaLabel: 'Go',
      threadId: THREAD_B,
      onCtaClick: vi.fn(),
    });
    elB.querySelector<HTMLElement>('.gengage-chat-choice-prompter-dismiss')!.click();

    expect(isChoicePrompterDismissed(THREAD_A)).toBe(true);
    expect(isChoicePrompterDismissed(THREAD_B)).toBe(true);
  });

  it('handles corrupted sessionStorage gracefully', () => {
    sessionStorage.setItem('gengage_choice_prompter_dismissed', 'not-json');
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
  });

  it('handles legacy "1" value gracefully (does not crash)', () => {
    sessionStorage.setItem('gengage_choice_prompter_dismissed', '1');
    // Legacy "1" is not valid JSON array, should return false gracefully
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
  });
});
