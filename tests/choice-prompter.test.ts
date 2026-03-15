/**
 * Tests for ChoicePrompter component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createChoicePrompter,
  isChoicePrompterDismissed,
  isChoicePrompterGloballyDismissed,
} from '../src/chat/components/ChoicePrompter.js';

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

describe('ChoicePrompter product view gating', () => {
  /**
   * The widget only shows the ChoicePrompter after 2+ unique products viewed.
   * We simulate the gating logic here (viewedProductSkus lives in GengageChat class).
   */
  function shouldShowPrompter(viewedCount: number, comparisonActive: boolean, threadId = THREAD_A): boolean {
    return (
      viewedCount >= 2 &&
      !comparisonActive &&
      !isChoicePrompterGloballyDismissed() &&
      !isChoicePrompterDismissed(threadId)
    );
  }

  it('does NOT show on first product view', () => {
    expect(shouldShowPrompter(1, false)).toBe(false);
  });

  it('shows on second product view', () => {
    expect(shouldShowPrompter(2, false)).toBe(true);
  });

  it('shows on third and subsequent product views', () => {
    expect(shouldShowPrompter(3, false)).toBe(true);
    expect(shouldShowPrompter(10, false)).toBe(true);
  });

  it('does NOT show when comparison mode is active', () => {
    expect(shouldShowPrompter(2, true)).toBe(false);
  });

  it('does NOT show when already dismissed for thread', () => {
    // Dismiss by clicking CTA (internally calls markDismissed)
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Try comparing',
      ctaLabel: 'Compare',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    el.querySelector<HTMLButtonElement>('.gengage-chat-choice-prompter-cta')!.click();
    expect(shouldShowPrompter(2, false)).toBe(false);
  });

  it('does NOT show on zero views', () => {
    expect(shouldShowPrompter(0, false)).toBe(false);
  });
});

describe('isChoicePrompterGloballyDismissed', () => {
  it('returns false when not dismissed', () => {
    expect(isChoicePrompterGloballyDismissed()).toBe(false);
  });

  it('returns true after CTA click', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    el.querySelector<HTMLElement>('.gengage-chat-choice-prompter-cta')!.click();
    expect(isChoicePrompterGloballyDismissed()).toBe(true);
  });

  it('returns true after dismiss click', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    el.querySelector<HTMLElement>('.gengage-chat-choice-prompter-dismiss')!.click();
    expect(isChoicePrompterGloballyDismissed()).toBe(true);
  });

  it('persists across threads — dismissing in thread A blocks thread B', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    el.querySelector<HTMLElement>('.gengage-chat-choice-prompter-cta')!.click();

    // Global dismiss prevents showing in any thread
    expect(isChoicePrompterGloballyDismissed()).toBe(true);
    expect(isChoicePrompterDismissed(THREAD_B)).toBe(false); // per-thread is still false
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
