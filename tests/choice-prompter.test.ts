/**
 * Tests for ChoicePrompter component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChoicePrompter, isChoicePrompterDismissed } from '../src/chat/components/ChoicePrompter.js';

beforeEach(() => {
  sessionStorage.clear();
});

describe('createChoicePrompter', () => {
  it('renders heading, suggestion, CTA, and dismiss button', () => {
    const el = createChoicePrompter({
      heading: 'Kararsız mı kaldın?',
      suggestion: 'Ürünleri seçip karşılaştırabilirsin',
      ctaLabel: 'Seç ve Karşılaştır',
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
      onCtaClick: vi.fn(),
      onDismiss,
    });
    parent.appendChild(el);

    const dismiss = el.querySelector('.gengage-chat-choice-prompter-dismiss') as HTMLElement;
    dismiss.click();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(0);
  });

  it('marks as dismissed in sessionStorage on CTA click', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      onCtaClick: vi.fn(),
    });

    expect(isChoicePrompterDismissed()).toBe(false);

    const cta = el.querySelector('.gengage-chat-choice-prompter-cta') as HTMLElement;
    cta.click();

    expect(isChoicePrompterDismissed()).toBe(true);
  });

  it('marks as dismissed in sessionStorage on dismiss click', () => {
    const el = createChoicePrompter({
      heading: 'Test',
      suggestion: 'Test',
      ctaLabel: 'Go',
      onCtaClick: vi.fn(),
    });

    const dismiss = el.querySelector('.gengage-chat-choice-prompter-dismiss') as HTMLElement;
    dismiss.click();

    expect(isChoicePrompterDismissed()).toBe(true);
  });
});

describe('isChoicePrompterDismissed', () => {
  it('returns false when not dismissed', () => {
    expect(isChoicePrompterDismissed()).toBe(false);
  });

  it('returns true after dismissal', () => {
    sessionStorage.setItem('gengage_choice_prompter_dismissed', '1');
    expect(isChoicePrompterDismissed()).toBe(true);
  });
});
