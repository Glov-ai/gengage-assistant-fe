import { describe, it, expect, vi } from 'vitest';
import { renderAISuggestedSearchCards } from '../src/chat/components/AISuggestedSearchCards.js';
import type { UIElement } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return { onAction: vi.fn(), ...overrides };
}

describe('renderAISuggestedSearchCards', () => {
  it('renders cards with visual title only in compact mode', () => {
    const el: UIElement = {
      type: 'AISuggestedSearchCards',
      props: {
        entries: [
          {
            shortName: 'Duvar boyası',
            detailedMessage: 'Su bazlı duvar boyaları',
            whyDifferent: 'Daha uzun ömürlü',
            image: 'https://example.com/img.jpg',
            action: { title: 'Ara', type: 'inputText', payload: { text: 'duvar boyası' } },
          },
        ],
      },
    };
    const dom = renderAISuggestedSearchCards(el, makeContext());

    const cards = dom.querySelectorAll('.gengage-chat-suggested-search-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.querySelector('.gengage-chat-suggested-search-card-name')?.textContent).toBe('Duvar boyası');
    expect(cards[0]!.querySelector('.gengage-chat-suggested-search-card-desc')).toBeNull();
    expect(cards[0]!.querySelector('.gengage-chat-suggested-search-card-diff')).toBeNull();
    expect(cards[0]!.querySelector('.gengage-chat-suggested-search-card-img')).not.toBeNull();
  });

  it('dispatches action on card click', () => {
    const onAction = vi.fn();
    const action = { title: 'Ara', type: 'inputText', payload: { text: 'boya' } };
    const el: UIElement = {
      type: 'AISuggestedSearchCards',
      props: { entries: [{ shortName: 'Boya', action }] },
    };
    const dom = renderAISuggestedSearchCards(el, makeContext({ onAction }));
    (dom.querySelector('.gengage-chat-suggested-search-card') as HTMLElement).click();
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('handles empty entries', () => {
    const el: UIElement = { type: 'AISuggestedSearchCards', props: { entries: [] } };
    const dom = renderAISuggestedSearchCards(el, makeContext());
    expect(dom.children).toHaveLength(0);
  });

  it('renders card without optional fields', () => {
    const el: UIElement = {
      type: 'AISuggestedSearchCards',
      props: {
        entries: [{ shortName: 'Test', action: { title: 'X', type: 'inputText' } }],
      },
    };
    const dom = renderAISuggestedSearchCards(el, makeContext());
    expect(dom.querySelector('.gengage-chat-suggested-search-card-desc')).toBeNull();
    expect(dom.querySelector('.gengage-chat-suggested-search-card-diff')).toBeNull();
    expect(dom.querySelector('.gengage-chat-suggested-search-card-img')).toBeNull();
  });

  it('rejects unsafe image URLs', () => {
    const el: UIElement = {
      type: 'AISuggestedSearchCards',
      props: {
        entries: [{ shortName: 'Unsafe', image: 'javascript:alert(1)', action: { title: 'T', type: 'x' } }],
      },
    };
    const dom = renderAISuggestedSearchCards(el, makeContext());
    expect(dom.querySelector('.gengage-chat-suggested-search-card-img')).toBeNull();
  });
});
