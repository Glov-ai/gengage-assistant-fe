import { describe, it, expect, vi } from 'vitest';
import { renderGroundingReviewCard } from '../src/chat/components/GroundingReviewCard.js';
import type { UIElement } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    i18n: {
      productCtaLabel: 'İncele',
      aiTopPicksTitle: 'Top',
      roleWinner: 'W',
      roleBestValue: 'BV',
      roleBestAlternative: 'BA',
      viewDetails: 'View',
      groundingReviewCta: 'Yorumları Oku',
      groundingReviewSubtitle: '{count} yorum mevcut',
      variantsLabel: 'Varyantlar',
      sortRelated: 'Önerilen',
      sortPriceAsc: 'Fiyat ↑',
      sortPriceDesc: 'Fiyat ↓',
      compareSelected: 'Karşılaştır',
      panelTitleProductDetails: 'Ürün Detayı',
      panelTitleSimilarProducts: 'Benzer Ürünler',
      panelTitleComparisonResults: 'Karşılaştırma',
      panelTitleCategories: 'Kategoriler',
      panelTitleSearchResults: 'Arama Sonuçları',
      inStockLabel: 'Stokta',
      outOfStockLabel: 'Tükendi',
      findSimilarLabel: 'Benzerlerini Bul',
      viewMoreLabel: 'Daha Fazla Göster',
      similarProductsLabel: 'Benzer Ürünler',
      addToCartButton: 'Sepete Ekle',
      shareButton: 'Paylaş',
      productInfoTab: 'Ürün Bilgileri',
      specificationsTab: 'Teknik Özellikler',
      recommendedChoiceLabel: 'Önerilen Seçim',
      highlightsLabel: 'Öne Çıkanlar',
      keyDifferencesLabel: 'Temel Farklar',
      specialCasesLabel: 'Özel Durumlar',
      emptyReviewsMessage: 'Henüz yorum yok',
      closeAriaLabel: 'Kapat',
      startChatLabel: 'Sohbet Başlat',
      handoffHeading: 'Canlı Destek',
      customerReviewsTitle: 'Müşteri Yorumları',
      addToFavoritesLabel: 'Favorilere ekle',
    },
    ...overrides,
  };
}

describe('renderGroundingReviewCard', () => {
  it('renders card with title and review count', () => {
    const el: UIElement = {
      type: 'GroundingReviewCard',
      props: {
        title: 'Müşteri Yorumları',
        reviewCount: '123',
        action: { title: 'Show', type: 'reviewSummary', payload: { sku: 'S1' } },
      },
    };
    const dom = renderGroundingReviewCard(el, makeContext());

    expect(dom.classList.contains('gengage-chat-grounding-review')).toBe(true);
    expect(dom.classList.contains('gds-evidence-card')).toBe(true);
    expect(dom.querySelector('.gengage-chat-grounding-review-title')?.textContent).toBe('Müşteri Yorumları');
    expect(dom.querySelector('.gengage-chat-grounding-review-subtitle')?.textContent).toBe('123 yorum mevcut');
    expect(dom.querySelector('.gengage-chat-grounding-review-cta')?.textContent).toContain('Yorumları Oku');
  });

  it('dispatches action on click', () => {
    const onAction = vi.fn();
    const action = { title: 'Show', type: 'reviewSummary', payload: { sku: 'S1' } };
    const el: UIElement = { type: 'GroundingReviewCard', props: { action } };
    const dom = renderGroundingReviewCard(el, makeContext({ onAction }));
    dom.click();
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('renders default title when none provided', () => {
    const el: UIElement = {
      type: 'GroundingReviewCard',
      props: { action: { title: 'X', type: 'reviewSummary' } },
    };
    const dom = renderGroundingReviewCard(el, makeContext());
    expect(dom.querySelector('.gengage-chat-grounding-review-title')?.textContent).toBe('Müşteri Yorumları');
  });

  it('does not render subtitle when reviewCount is absent', () => {
    const el: UIElement = {
      type: 'GroundingReviewCard',
      props: { action: { title: 'X', type: 'reviewSummary' } },
    };
    const dom = renderGroundingReviewCard(el, makeContext());
    expect(dom.querySelector('.gengage-chat-grounding-review-subtitle')).toBeNull();
  });

  it('is not clickable when action is absent', () => {
    const el: UIElement = { type: 'GroundingReviewCard', props: {} };
    const dom = renderGroundingReviewCard(el, makeContext());
    expect(dom.style.cursor).not.toBe('pointer');
  });
});
