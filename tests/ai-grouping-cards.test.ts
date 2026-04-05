import { describe, it, expect, vi } from 'vitest';
import { renderAIGroupingCards } from '../src/chat/components/AIGroupingCards.js';
import type { UIElement } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return { onAction: vi.fn(), ...overrides };
}

describe('renderAIGroupingCards', () => {
  it('renders cards for each entry with image, title, and no description', () => {
    const el: UIElement = {
      type: 'AIGroupingCards',
      props: {
        entries: [
          {
            name: 'Banyo',
            image: 'https://example.com/img.jpg',
            description: 'Banyo ürünleri',
            action: { title: 'Banyo', type: 'findSimilar', payload: { sku: '1' } },
          },
          { name: 'Mutfak', action: { title: 'Mutfak', type: 'findSimilar', payload: { sku: '2' } } },
        ],
      },
    };
    const dom = renderAIGroupingCards(el, makeContext());

    const cards = dom.querySelectorAll('.gengage-chat-grouping-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.querySelector('.gengage-chat-grouping-card-name')?.textContent).toBe('Banyo');
    expect(cards[0]!.querySelector('.gengage-chat-grouping-card-desc')).toBeNull();
    expect(cards[0]!.querySelector('.gengage-chat-grouping-card-img')).not.toBeNull();
    expect(cards[1]!.querySelector('.gengage-chat-grouping-card-img')).toBeNull();
  });

  it('dispatches action on card click', () => {
    const onAction = vi.fn();
    const action = { title: 'Banyo', type: 'findSimilar', payload: { sku: '1' } };
    const el: UIElement = {
      type: 'AIGroupingCards',
      props: { entries: [{ name: 'Banyo', action }] },
    };
    const dom = renderAIGroupingCards(el, makeContext({ onAction }));
    (dom.querySelector('.gengage-chat-grouping-card') as HTMLElement).click();
    expect(onAction).toHaveBeenCalledWith({
      title: 'Banyo',
      type: 'inputText',
      payload: { text: 'Banyo', sku: '1', is_suggested_text: 1 },
    });
  });

  it('preserves grouping search payload when converting findSimilar cards into search actions', () => {
    const onAction = vi.fn();
    const el: UIElement = {
      type: 'AIGroupingCards',
      props: {
        entries: [
          {
            name: 'Beyaz Renkli Kurutma Makinesi',
            action: {
              title: 'Beyaz Renkli Kurutma Makinesi',
              type: 'findSimilar',
              payload: { sku: '7188270150', input: 'Beyaz Model', group_skus: ['7188270150', '7184270120'] },
            },
          },
        ],
      },
    };
    const dom = renderAIGroupingCards(el, makeContext({ onAction }));
    (dom.querySelector('.gengage-chat-grouping-card') as HTMLElement).click();
    expect(onAction).toHaveBeenCalledWith({
      title: 'Beyaz Renkli Kurutma Makinesi',
      type: 'inputText',
      payload: {
        text: 'Beyaz Model',
        sku: '7188270150',
        group_skus: ['7188270150', '7184270120'],
        is_suggested_text: 1,
      },
    });
  });

  it('handles empty entries', () => {
    const el: UIElement = { type: 'AIGroupingCards', props: { entries: [] } };
    const dom = renderAIGroupingCards(el, makeContext());
    expect(dom.children).toHaveLength(0);
  });

  it('includes arrow element for mobile display', () => {
    const el: UIElement = {
      type: 'AIGroupingCards',
      props: { entries: [{ name: 'Test', action: { title: 'T', type: 'x' } }] },
    };
    const dom = renderAIGroupingCards(el, makeContext());
    expect(dom.querySelector('.gengage-chat-grouping-card-arrow')?.textContent).toBe('\u21B3');
  });

  it('rejects unsafe image URLs', () => {
    const el: UIElement = {
      type: 'AIGroupingCards',
      props: {
        entries: [{ name: 'Unsafe', image: 'javascript:alert(1)', action: { title: 'T', type: 'x' } }],
      },
    };
    const dom = renderAIGroupingCards(el, makeContext());
    expect(dom.querySelector('.gengage-chat-grouping-card-img')).toBeNull();
  });
});
