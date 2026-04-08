/**
 * Stub context factories for rendering components outside their widget lifecycle.
 * All callbacks log to console (visible in devtools).
 */

import type { ActionPayload } from '@gengage/assistant-fe/common';
import type { ChatUISpecRenderContext, ProductSortState } from '@gengage/assistant-fe/chat';
import type { QNAUISpecRenderContext } from '@gengage/assistant-fe/qna';
import type { SimRelUISpecRenderContext, SimilarProduct } from '@gengage/assistant-fe/simrel';

/** Noop chat context — logs all actions to console. */
export function createNoopChatContext(): ChatUISpecRenderContext {
  const i18n = {
    headerTitle: 'Ürün Uzmanı',
    inputPlaceholder: 'Ürün ara, soru sor',
    sendButton: 'Gönder',
    closeButton: 'Kapat',
    openButton: 'Sohbeti aç',
    newChatButton: 'Yeni sohbet',
    poweredBy: 'Powered by Gengage',
    errorMessage: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    retryButton: 'Tekrar Dene',
    loadingMessage: 'Düşünüyorum...',
    productCtaLabel: 'Satın Al',
    viewOnSiteLabel: 'Sitede Gör',
    attachImageButton: 'Resim ekle',
    removeAttachmentButton: 'Resmi kaldır',
    invalidFileType: 'Sadece JPEG, PNG ve WebP dosyaları destekleniyor.',
    fileTooLarge: "Dosya boyutu 5 MB'dan küçük olmalıdır.",
    aiTopPicksTitle: 'Sizin İçin En İyiler',
    roleWinner: 'En Beğendiğim',
    roleBestValue: 'En Uygun Fiyatlı',
    roleBestAlternative: 'En İyi Alternatif',
    viewDetails: 'Detayları Gör',
    groundingReviewCta: 'Yorumları Oku',
    groundingReviewSubtitle: '{count} yorum mevcut',
    variantsLabel: 'Varyantlar',
    sortRelated: 'Önerilen',
    sortPriceAsc: 'Fiyat \u2191',
    sortPriceDesc: 'Fiyat \u2193',
    sortToolbarAriaLabel: 'Ürünleri sırala',
    compareSelected: 'Karşılaştır',
    panelTitleProductDetails: 'Ürün Detayı',
    panelTitleSimilarProducts: 'Benzer Ürünler',
    panelTitleComparisonResults: 'Karşılaştırma Sonuçları',
    panelTitleCategories: 'Kategoriler',
    panelTitleSearchResults: 'Arama Sonuçları',
    inStockLabel: 'Stokta',
    outOfStockLabel: 'Tükendi',
    findSimilarLabel: 'Benzerlerini Bul',
    galleryPrevAriaLabel: 'Önceki görsel',
    galleryNextAriaLabel: 'Sonraki görsel',
    choicePrompterHeading: 'Kararsız mı kaldın?',
    choicePrompterSuggestion: 'Ürünleri seçip karşılaştırabilirsin',
    choicePrompterCta: 'Seç ve Karşılaştır',
    viewMoreLabel: 'Daha Fazla Göster',
    similarProductsLabel: 'Benzer Ürünler',
    addToCartButton: 'Sepete Ekle',
    addedToCartToast: 'Sepete eklendi',
    shareButton: 'Paylaş',
    productInfoTab: 'Ürün Bilgileri',
    specificationsTab: 'Teknik Özellikler',
    recommendedChoiceLabel: 'Önerilen Seçim',
    highlightsLabel: 'Öne Çıkan Özellikler',
    keyDifferencesLabel: 'Temel Farklar',
    specialCasesLabel: 'Özel Durumlar İçin',
    emptyReviewsMessage: 'Yorum özeti bulunamadı.',
    closeAriaLabel: 'Kapat',
    startChatLabel: 'Sohbete Başla',
    voiceButton: 'Sesli giriş',
    voiceListening: 'Dinleniyor...',
    voiceNotSupported: 'Sesli giriş bu tarayıcıda desteklenmiyor.',
    voicePermissionDenied: 'Mikrofon erişimi reddedildi.',
    voiceError: 'Sesli giriş hatası.',
    handoffHeading: 'Destek temsilcisine aktarılıyor',
  };

  return {
    onAction: (action: ActionPayload) => {
      console.log('[catalog] onAction:', action);
      appendToMiniConsole(`onAction: ${JSON.stringify(action)}`);
    },
    onProductClick: (params: { sku: string; url: string; name?: string }) => {
      console.log('[catalog] onProductClick:', params);
      appendToMiniConsole(`onProductClick: ${JSON.stringify(params)}`);
    },
    onAddToCart: (params: { sku: string; cartCode: string; quantity: number }) => {
      console.log('[catalog] onAddToCart:', params);
      appendToMiniConsole(`onAddToCart: ${JSON.stringify(params)}`);
    },
    onProductSelect: (product: Record<string, unknown>) => {
      console.log('[catalog] onProductSelect:', product);
      appendToMiniConsole(`onProductSelect: ${JSON.stringify(product)}`);
    },
    pricing: {
      currencySymbol: 'TL',
      currencyPosition: 'suffix',
      thousandsSeparator: '.',
      decimalSeparator: ',',
    },
    i18n: i18n as unknown as ChatUISpecRenderContext['i18n'],
    productSort: { type: 'related' as const },
    onSortChange: (sort: ProductSortState) => {
      console.log('[catalog] onSortChange:', sort);
    },
  };
}

/** Noop QNA context. */
export function createNoopQnaContext(): QNAUISpecRenderContext {
  return {
    onAction: (action: ActionPayload) => {
      console.log('[catalog] qna onAction:', action);
      appendToMiniConsole(`qna onAction: ${JSON.stringify(action)}`);
    },
    onOpenChat: () => {
      console.log('[catalog] qna onOpenChat');
      appendToMiniConsole('qna onOpenChat');
    },
    i18n: {
      quickQuestionsAriaLabel: 'Hızlı sorular',
      askQuestionAriaLabel: 'Soru sor',
      defaultInputPlaceholder: 'Sorunuzu yazın...',
      sendButton: 'Gönder',
      sendQuestionAriaLabel: 'Soruyu gönder',
      defaultCtaText: 'Başka bir şey sor',
      redirectingToChat: 'Sohbete yönlendiriliyor...',
      productContextQuickPillLabel: 'Bu ürün hakkında ne bilmeliyim?',
    },
  };
}

/** Noop SimRel context. */
export function createNoopSimrelContext(): SimRelUISpecRenderContext {
  return {
    onClick: (product: SimilarProduct) => {
      console.log('[catalog] simrel onClick:', product);
      appendToMiniConsole(`simrel onClick: ${JSON.stringify(product)}`);
    },
    onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => {
      console.log('[catalog] simrel onAddToCart:', params);
      appendToMiniConsole(`simrel onAddToCart: ${JSON.stringify(params)}`);
    },
    onAction: (action: ActionPayload) => {
      console.log('[catalog] simrel onAction:', action);
      appendToMiniConsole(`simrel onAction: ${JSON.stringify(action)}`);
    },
    i18n: {
      similarProductsAriaLabel: 'Similar Products',
      emptyStateMessage: 'No similar products found.',
      addToCartButton: 'Add to Cart',
      ctaLabel: 'View',
      outOfStockLabel: 'Out of Stock',
      decreaseLabel: 'Decrease',
      increaseLabel: 'Increase',
      errorLoadingMessage: 'Could not load similar products.',
      retryButtonText: 'Try again',
      priceSuffix: ' TL',
      scrollTabsLeft: 'Sola kaydır',
      scrollTabsRight: 'Sağa kaydır',
    },
    pricing: {
      currencySymbol: 'TL',
      currencyPosition: 'suffix',
      thousandsSeparator: '.',
      decimalSeparator: ',',
    },
  };
}

// ---------------------------------------------------------------------------
// Mini-console helper — appends log entries to the current card's console area
// ---------------------------------------------------------------------------
let _currentConsoleEl: HTMLElement | null = null;

export function setCurrentConsole(el: HTMLElement | null): void {
  _currentConsoleEl = el;
}

function appendToMiniConsole(text: string): void {
  if (!_currentConsoleEl) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  entry.textContent = `[${time}] ${text}`;
  _currentConsoleEl.appendChild(entry);
  _currentConsoleEl.scrollTop = _currentConsoleEl.scrollHeight;
}
