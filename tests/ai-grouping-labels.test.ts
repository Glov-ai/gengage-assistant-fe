import { describe, it, expect } from 'vitest';
import { renderAIGroupingCards } from '../src/chat/components/AIGroupingCards.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

describe('AIGroupingCards labels rendering', () => {
  const ctx: ChatUISpecRenderContext = {
    onAction: () => {},
  };

  it('renders the first 2 labels as separate chips', () => {
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
    const labels = result.querySelectorAll('.gengage-chat-grouping-card-label');
    expect(labels).toHaveLength(2);
    expect(labels[0]!.textContent).toBe('Under 10K');
    expect(labels[1]!.textContent).toBe('Student');
  });

  it('renders all labels when 2 or fewer', () => {
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
    const labels = result.querySelectorAll('.gengage-chat-grouping-card-label');
    expect(labels).toHaveLength(2);
    expect(labels[0]!.textContent).toBe('High FPS');
    expect(labels[1]!.textContent).toBe('RGB');
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
