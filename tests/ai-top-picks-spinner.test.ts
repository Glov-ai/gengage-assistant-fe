import { describe, it, expect, vi } from 'vitest';
import { renderAITopPicks } from '../src/chat/components/AITopPicks.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeCtx(overrides: Partial<ChatUISpecRenderContext> = {}): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    i18n: {
      aiTopPicksTitle: 'Top Picks',
      roleWinner: 'Winner',
      viewDetails: 'View Details',
    } as ChatUISpecRenderContext['i18n'],
    ...overrides,
  };
}

function makeSuggestion(productOverrides: Record<string, unknown> = {}) {
  return {
    product: {
      name: 'Test',
      price: '100 TL',
      imageUrl: 'https://example.com/img.jpg',
      sku: 'SKU1',
      ...productOverrides,
    },
    role: 'winner',
    action: { title: 'View', type: 'launchSingleProduct', payload: {} },
  };
}

describe('AITopPicks per-card spinner', () => {
  it('CTA click does not force a sticky spinner state on winner card', () => {
    const el = { type: 'AITopPicks', props: { suggestions: [makeSuggestion()] } };
    const result = renderAITopPicks(el as never, makeCtx());
    const cta = result.querySelector('.gengage-chat-ai-toppick-cta') as HTMLButtonElement;
    const spinner = result.querySelector('.gengage-chat-ai-toppick-spinner') as HTMLElement;
    expect(spinner.style.display).toBe('none');
    cta.click();
    expect(spinner.style.display).toBe('none');
  });

  it('spinner visible when topPicksLoadingSku matches card SKU', () => {
    const el = { type: 'AITopPicks', props: { suggestions: [makeSuggestion()] } };
    const result = renderAITopPicks(el as never, makeCtx({ topPicksLoadingSku: 'SKU1' }));
    const spinner = result.querySelector('.gengage-chat-ai-toppick-spinner') as HTMLElement;
    expect(spinner.style.display).toBe('');
  });

  it('spinner hidden when topPicksLoadingSku does not match', () => {
    const el = { type: 'AITopPicks', props: { suggestions: [makeSuggestion()] } };
    const result = renderAITopPicks(el as never, makeCtx({ topPicksLoadingSku: 'OTHER' }));
    const spinner = result.querySelector('.gengage-chat-ai-toppick-spinner') as HTMLElement;
    expect(spinner.style.display).toBe('none');
  });

  it('no spinner on card without action', () => {
    const el = {
      type: 'AITopPicks',
      props: {
        suggestions: [{ product: { name: 'Test', sku: 'SKU1' }, role: 'winner' }],
      },
    };
    const result = renderAITopPicks(el as never, makeCtx());
    expect(result.querySelector('.gengage-chat-ai-toppick-spinner')).toBeNull();
  });

  it('spinner renders on compact card too', () => {
    const el = {
      type: 'AITopPicks',
      props: {
        suggestions: [
          makeSuggestion(),
          {
            product: { name: 'Alt', sku: 'SKU2', price: '50 TL' },
            role: 'best_value',
            action: { title: 'View', type: 'test', payload: {} },
          },
        ],
      },
    };
    const result = renderAITopPicks(el as never, makeCtx({ topPicksLoadingSku: 'SKU2' }));
    const spinners = result.querySelectorAll('.gengage-chat-ai-toppick-spinner');
    expect(spinners.length).toBe(2);
    // First spinner (winner) hidden, second (compact) visible
    expect((spinners[0] as HTMLElement).style.display).toBe('none');
    expect((spinners[1] as HTMLElement).style.display).toBe('');
  });
});
