import { describe, it, expect, vi } from 'vitest';
import { renderAITopPicks } from '../src/chat/components/AITopPicks.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeCtx(overrides: Partial<ChatUISpecRenderContext> = {}): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    i18n: { aiTopPicksTitle: 'Top Picks', roleWinner: 'Winner', viewDetails: 'View Details' } as any,
    ...overrides,
  };
}

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    product: {
      name: 'Test Product',
      price: '100 TL',
      imageUrl: 'https://example.com/img.jpg',
      sku: 'SKU1',
      ...overrides,
    },
    role: 'winner',
    action: { title: 'View', type: 'launchSingleProduct', payload: {} },
  };
}

describe('AITopPicks discount badge', () => {
  it('winner card renders discount badge when discountPercent > 0', () => {
    const el = { type: 'AITopPicks', props: { suggestions: [makeSuggestion({ discountPercent: 25 })] } };
    const result = renderAITopPicks(el as any, makeCtx());
    const badge = result.querySelector('.gengage-chat-ai-toppick-discount-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('%25');
  });

  it('compact card renders discount badge when discountPercent > 0', () => {
    const el = {
      type: 'AITopPicks',
      props: {
        suggestions: [
          makeSuggestion({ discountPercent: 10 }),
          {
            product: { name: 'Alt', price: '50 TL', discountPercent: 15, sku: 'SKU2' },
            role: 'best_value',
            action: { title: 'View', type: 'test', payload: {} },
          },
        ],
      },
    };
    const result = renderAITopPicks(el as any, makeCtx());
    const badges = result.querySelectorAll('.gengage-chat-ai-toppick-discount-badge');
    expect(badges.length).toBe(2);
    expect(badges[1]!.textContent).toBe('%15');
  });

  it('no badge when discountPercent is 0', () => {
    const el = { type: 'AITopPicks', props: { suggestions: [makeSuggestion({ discountPercent: 0 })] } };
    const result = renderAITopPicks(el as any, makeCtx());
    expect(result.querySelector('.gengage-chat-ai-toppick-discount-badge')).toBeNull();
  });

  it('no badge when discountPercent is undefined', () => {
    const el = { type: 'AITopPicks', props: { suggestions: [makeSuggestion()] } };
    const result = renderAITopPicks(el as any, makeCtx());
    expect(result.querySelector('.gengage-chat-ai-toppick-discount-badge')).toBeNull();
  });
});
