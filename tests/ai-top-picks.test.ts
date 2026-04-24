/**
 * Tests for AI Top Picks component rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderAITopPicks } from '../src/chat/components/AITopPicks.js';
import type { UIElement } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    i18n: {
      productCtaLabel: 'İncele',
      aiTopPicksTitle: 'Sizin İçin En İyiler',
      roleWinner: 'Size Özel Seçimim',
      roleBestValue: 'En Uygun Fiyatlı',
      roleBestAlternative: 'En İyi Alternatif',
      viewDetails: 'Detayları Gör',
      groundingReviewCta: 'Yorumları Oku',
      variantsLabel: 'Varyantlar',
      sortRelated: 'Önerilen',
      sortPriceAsc: 'Fiyat ↑',
      sortPriceDesc: 'Fiyat ↓',
      compareSelected: 'Karşılaştır',
      panelTitleProductDetails: 'Ürün Detayı',
      panelTitleSimilarProducts: 'Benzer Ürünler',
      panelTitleComparisonResults: 'Karşılaştırma',
      panelTitleCategories: 'Kategoriler',
      inStockLabel: 'Stokta',
      outOfStockLabel: 'Tükendi',
      findSimilarLabel: 'Benzerlerini Bul',
      viewMoreLabel: 'Daha Fazla Göster',
      similarProductsLabel: 'Benzer Ürünler',
    },
    ...overrides,
  };
}

function makeElement(suggestions: unknown[]): UIElement {
  return {
    type: 'AITopPicks',
    props: { suggestions },
  };
}

describe('renderAITopPicks', () => {
  it('does not render a section title', () => {
    const el = makeElement([{ product: { sku: '1', name: 'Product A' }, role: 'winner' }]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    const title = dom.querySelector('.gengage-chat-ai-top-picks-title');
    expect(title).toBeNull();
  });

  it('wraps non-hero picks in ai-top-picks-rest for mobile horizontal scroll layout', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A' }, role: 'winner' },
      { product: { sku: '2', name: 'Product B' }, role: 'best_value' },
    ]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);
    const scroll = dom.querySelector('.gengage-chat-ai-top-picks-scroll');
    const rest = dom.querySelector('.gengage-chat-ai-top-picks-rest');
    expect(scroll?.children).toHaveLength(2);
    expect(rest).not.toBeNull();
    expect(rest?.querySelectorAll('.gengage-chat-ai-toppick-card')).toHaveLength(1);
  });

  it('first item gets winner class and badge', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A' }, role: 'winner' },
      { product: { sku: '2', name: 'Product B' }, role: 'best_value' },
    ]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    const cards = dom.querySelectorAll('.gengage-chat-ai-toppick-card');
    expect(cards).toHaveLength(2);

    const winner = cards[0]!;
    expect(winner.classList.contains('gengage-chat-ai-toppick-card--winner')).toBe(true);
    const badge = winner.querySelector('.gengage-chat-ai-toppick-badge');
    expect(badge?.textContent).toBe('Size Özel Seçimim');

    const compact = cards[1]!;
    expect(compact.classList.contains('gengage-chat-ai-toppick-card--compact')).toBe(true);
  });

  it('renders compact cards for non-winner roles', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A' }, role: 'winner' },
      { product: { sku: '2', name: 'Product B' }, role: 'best_value' },
      { product: { sku: '3', name: 'Product C' }, role: 'best_alternative' },
    ]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    const compactCards = dom.querySelectorAll('.gengage-chat-ai-toppick-card--compact');
    expect(compactCards).toHaveLength(2);

    // Role pills (same badge component as winner)
    expect(compactCards[0]!.querySelector('.gengage-chat-ai-toppick-badge')?.textContent).toBe('En Uygun Fiyatlı');
    expect(compactCards[1]!.querySelector('.gengage-chat-ai-toppick-badge')?.textContent).toBe('En İyi Alternatif');
  });

  it('keeps role labels locale-driven for English copy too', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A' }, role: 'winner' },
      { product: { sku: '2', name: 'Product B' }, role: 'best_value' },
    ]);
    const base = makeContext();
    const ctx = makeContext({
      i18n: {
        ...base.i18n,
        roleWinner: 'Top Pick',
        roleBestValue: 'Best Value',
        roleBestAlternative: 'Best Alternative',
      },
    });
    const dom = renderAITopPicks(el, ctx);
    const badges = dom.querySelectorAll('.gengage-chat-ai-toppick-badge');

    expect(badges[0]!.textContent).toBe('Top Pick');
    expect(badges[1]!.textContent).toBe('Best Value');
  });

  it('mobil kompaktta rol metni rozet yerine gövde içi satırda; CTA yok', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A' }, role: 'winner' },
      {
        product: { sku: '2', name: 'Product B', cartCode: 'C1', price: '10 TL' },
        role: 'best_value',
      },
    ]);
    const ctx = makeContext({ isMobile: true });
    const dom = renderAITopPicks(el, ctx);
    const compact = dom.querySelector('.gengage-chat-ai-toppick-card--compact')!;
    expect(compact.querySelector('.gengage-chat-ai-toppick-badge')).toBeNull();
    expect(compact.querySelector('.gengage-chat-ai-toppick-role-line')?.textContent).toBe('En Uygun Fiyatlı');
    expect(compact.querySelector('.gengage-chat-ai-toppick-cta')).toBeNull();
  });

  it('renders sentiment chips with correct data-sentiment', () => {
    const el = makeElement([
      {
        product: { sku: '1', name: 'Product A' },
        role: 'winner',
        labels: [
          { label: 'Dayanıklı', sentiment: 'positive' },
          { label: 'Pahalı', sentiment: 'negative' },
          { label: 'Normal boyut', sentiment: 'neutral' },
        ],
      },
    ]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    const chips = dom.querySelectorAll('.gengage-chat-ai-toppick-label');
    expect(chips).toHaveLength(3);

    expect((chips[0] as HTMLElement).dataset['sentiment']).toBe('positive');
    expect(chips[0]!.textContent).toBe('Dayanıklı');

    expect((chips[1] as HTMLElement).dataset['sentiment']).toBe('negative');
    expect(chips[1]!.textContent).toBe('Pahalı');

    expect((chips[2] as HTMLElement).dataset['sentiment']).toBe('neutral');
    expect(chips[2]!.textContent).toBe('Normal boyut');
  });

  it('CTA dispatches action on click', () => {
    const onAction = vi.fn();
    const action = { title: 'View', type: 'launchSingleProduct', payload: { sku: '1' } };
    const el = makeElement([{ product: { sku: '1', name: 'Product A' }, role: 'winner', action }]);
    const ctx = makeContext({ onAction });
    const dom = renderAITopPicks(el, ctx);

    const cta = dom.querySelector('.gengage-chat-ai-toppick-cta') as HTMLElement;
    expect(cta).not.toBeNull();
    cta.click();
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('CTA uses product drilldown instead of findSimilar when a SKU is present', () => {
    const onAction = vi.fn();
    const onProductClick = vi.fn();
    const action = { title: 'View', type: 'findSimilar', payload: { sku: '1' } };
    const el = makeElement([
      {
        product: { name: 'Product A', url: 'https://example.com/p/1' },
        role: 'winner',
        action,
      },
    ]);
    const ctx = makeContext({ onAction, onProductClick });
    const dom = renderAITopPicks(el, ctx);

    const cta = dom.querySelector('.gengage-chat-ai-toppick-cta') as HTMLElement;
    cta.click();
    expect(onProductClick).toHaveBeenCalledWith({ sku: '1', url: 'https://example.com/p/1', name: 'Product A' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('passes product name to onProductClick on card click', () => {
    const onProductClick = vi.fn();
    const el = makeElement([
      { product: { sku: 'P1', name: 'Wireless Mouse', url: 'https://example.com/mouse' }, role: 'winner' },
    ]);
    const ctx = makeContext({ onProductClick });
    const dom = renderAITopPicks(el, ctx);

    const card = dom.querySelector('.gengage-chat-ai-toppick-card') as HTMLElement;
    card.click();
    expect(onProductClick).toHaveBeenCalledWith({
      sku: 'P1',
      url: 'https://example.com/mouse',
      name: 'Wireless Mouse',
    });
  });

  it('omits name from onProductClick when product has no name', () => {
    const onProductClick = vi.fn();
    const el = makeElement([
      { product: { sku: 'P2', url: 'https://example.com/p2' }, role: 'winner' },
    ]);
    const ctx = makeContext({ onProductClick });
    const dom = renderAITopPicks(el, ctx);

    const card = dom.querySelector('.gengage-chat-ai-toppick-card') as HTMLElement;
    card.click();
    expect(onProductClick).toHaveBeenCalledWith({
      sku: 'P2',
      url: 'https://example.com/p2',
    });
    expect(onProductClick.mock.calls[0]![0]).not.toHaveProperty('name');
  });

  it('passes product name to onProductClick on findSimilar CTA click', () => {
    const onProductClick = vi.fn();
    const action = { title: 'View', type: 'findSimilar', payload: { sku: 'P3' } };
    const el = makeElement([
      { product: { name: 'Gaming Keyboard', url: 'https://example.com/kb' }, role: 'winner', action },
    ]);
    const ctx = makeContext({ onAction: vi.fn(), onProductClick });
    const dom = renderAITopPicks(el, ctx);

    const cta = dom.querySelector('.gengage-chat-ai-toppick-cta') as HTMLElement;
    cta.click();
    expect(onProductClick).toHaveBeenCalledWith({
      sku: 'P3',
      url: 'https://example.com/kb',
      name: 'Gaming Keyboard',
    });
  });

  it('does not render expert quality score line (redundant with product rating / labels)', () => {
    const el = makeElement([{ product: { sku: '1', name: 'Product A' }, role: 'winner', expertQualityScore: 8.5 }]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    expect(dom.querySelector('.gengage-chat-ai-toppick-score')).toBeNull();
  });

  it('renders review highlight in the winner evidence area', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A' }, role: 'winner', reviewHighlight: 'Great quality!' },
    ]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    const review = dom.querySelector('.gengage-chat-ai-toppick-review');
    expect(review?.textContent).toBe('Great quality!');
    expect(review?.tagName).toBe('DIV');
  });

  it('handles empty suggestions without crashing', () => {
    const el = makeElement([]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    expect(dom.className).toBe('gengage-chat-ai-top-picks');
    expect(dom.children).toHaveLength(0);
  });

  it('handles suggestion with missing product fields gracefully', () => {
    const el = makeElement([{ product: {}, role: 'winner' }]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);
    expect(dom).toBeTruthy();
    expect(dom.querySelector('.gengage-chat-ai-toppick-card')).not.toBeNull();
    // No name → no name element
    expect(dom.querySelector('.gengage-chat-ai-toppick-name')).toBeNull();
    // No price → no price row
    expect(dom.querySelector('.gengage-chat-ai-toppick-price')).toBeNull();
  });

  it('handles non-numeric price value without crashing', () => {
    const el = makeElement([{ product: { sku: '1', name: 'Product A', price: 'not-a-number' }, role: 'winner' }]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);
    // Price formatter returns raw string for non-numeric — should still render
    const price = dom.querySelector('.gengage-chat-ai-toppick-price');
    expect(price).not.toBeNull();
    expect(price?.textContent).toContain('not-a-number');
  });

  it('renders price with compact Turkish formatting', () => {
    const el = makeElement([
      { product: { sku: '1', name: 'Product A', price: '17990', originalPrice: '19990' }, role: 'winner' },
    ]);
    const ctx = makeContext();
    const dom = renderAITopPicks(el, ctx);

    const price = dom.querySelector('.gengage-chat-ai-toppick-price');
    expect(price?.textContent).toContain('17.990 TL');

    const orig = dom.querySelector('.gengage-chat-ai-toppick-original-price');
    expect(orig?.textContent).toBe('19.990 TL');
  });
});
