/**
 * Tests for ChoicePrompter component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearChoicePrompterDismissState,
  createChoicePrompter,
  isChoicePrompterDismissed,
  recordChoicePrompterDismissedForThread,
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

    expect(el.classList.contains('gengage-chat-choice-prompter')).toBe(true);
    expect(el.classList.contains('gds-card')).toBe(true);
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

describe('ChoicePrompter grid gating (mirrors GengageChat)', () => {
  /** Widget shows when panel ProductGrid has 2+ children (same as sort/compare toolbar). */
  function shouldShowPrompter(
    gridChildCount: number,
    comparisonActive: boolean,
    threadId = THREAD_A,
  ): boolean {
    return gridChildCount > 1 && !comparisonActive && !isChoicePrompterDismissed(threadId);
  }

  it('does NOT show for a single product', () => {
    expect(shouldShowPrompter(1, false)).toBe(false);
  });

  it('shows when grid has 2+ products', () => {
    expect(shouldShowPrompter(2, false)).toBe(true);
  });

  it('shows for larger grids', () => {
    expect(shouldShowPrompter(10, false)).toBe(true);
  });

  it('does NOT show when comparison mode is active', () => {
    expect(shouldShowPrompter(2, true)).toBe(false);
  });

  it('does NOT show when already dismissed for thread', () => {
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

  it('does NOT show on empty grid', () => {
    expect(shouldShowPrompter(0, false)).toBe(false);
  });
});

describe('recordChoicePrompterDismissedForThread', () => {
  it('marks thread dismissed without rendering the card', () => {
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
    recordChoicePrompterDismissedForThread(THREAD_A);
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(true);
  });

  it('no-ops for empty threadId', () => {
    recordChoicePrompterDismissedForThread('');
    expect(sessionStorage.getItem('gengage_choice_prompter_dismissed')).toBeNull();
  });
});

describe('clearChoicePrompterDismissState', () => {
  it('clears per-thread dismiss list so prompter can show again', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      threadId: THREAD_A,
      onCtaClick: vi.fn(),
    });
    el.querySelector<HTMLElement>('.gengage-chat-choice-prompter-cta')!.click();
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(true);

    clearChoicePrompterDismissState();
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
  });

  it('removes legacy global dismiss key if present', () => {
    sessionStorage.setItem('gengage_choice_prompter_dismissed_global', '1');
    clearChoicePrompterDismissState();
    expect(sessionStorage.getItem('gengage_choice_prompter_dismissed_global')).toBeNull();
  });
});

describe('isChoicePrompterDismissed (per-thread)', () => {
  it('returns false when not dismissed for any thread', () => {
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
  });

  it('returns true only for the dismissed thread', () => {
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
    expect(isChoicePrompterDismissed(THREAD_A)).toBe(false);
  });
});
