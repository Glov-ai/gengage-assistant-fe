import { describe, it, expect } from 'vitest';
import { renderAIGroupingCards } from '../src/chat/components/AIGroupingCards.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

describe('AIGroupingCards labels rendering', () => {
  const ctx: ChatUISpecRenderContext = {
    onAction: () => {},
  };

  it('renders first 3 labels joined with dot separator', () => {
    const el = {
      type: 'AIGroupingCards' as const,
      props: {
        entries: [
          {
            name: 'Budget Laptops',
            labels: ['Under 10K', 'Student', 'Light Use', 'Extra Label'],
            action: { title: 'Budget', type: 'searchProducts', payload: {} },
          },
        ],
      },
    };

    const result = renderAIGroupingCards(el, ctx);
    const labelsEl = result.querySelector('.gengage-chat-grouping-card-labels');
    expect(labelsEl).not.toBeNull();
    expect(labelsEl!.textContent).toBe('Under 10K \u00B7 Student \u00B7 Light Use');
  });

  it('renders all labels when 3 or fewer', () => {
    const el = {
      type: 'AIGroupingCards' as const,
      props: {
        entries: [
          {
            name: 'Gaming',
            labels: ['High FPS', 'RGB'],
            action: { title: 'Gaming', type: 'searchProducts', payload: {} },
          },
        ],
      },
    };

    const result = renderAIGroupingCards(el, ctx);
    const labelsEl = result.querySelector('.gengage-chat-grouping-card-labels');
    expect(labelsEl).not.toBeNull();
    expect(labelsEl!.textContent).toBe('High FPS \u00B7 RGB');
  });

  it('omits labels element when no labels array', () => {
    const el = {
      type: 'AIGroupingCards' as const,
      props: {
        entries: [
          {
            name: 'All Products',
            action: { title: 'All', type: 'searchProducts', payload: {} },
          },
        ],
      },
    };

    const result = renderAIGroupingCards(el, ctx);
    expect(result.querySelector('.gengage-chat-grouping-card-labels')).toBeNull();
  });

  it('omits labels element when labels array is empty', () => {
    const el = {
      type: 'AIGroupingCards' as const,
      props: {
        entries: [
          {
            name: 'Empty Labels',
            labels: [],
            action: { title: 'E', type: 'searchProducts', payload: {} },
          },
        ],
      },
    };

    const result = renderAIGroupingCards(el, ctx);
    expect(result.querySelector('.gengage-chat-grouping-card-labels')).toBeNull();
  });
});
